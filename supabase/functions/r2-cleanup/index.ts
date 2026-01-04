import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const TMP_PREFIX = "uploads/tmp/"
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
      },
    })
    const bucket = Deno.env.get('R2_BUCKET_NAME') ?? ''
    const now = Date.now()

    let continuationToken: string | undefined = undefined
    let deletedCount = 0

    while (true) {
      const listRes = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: TMP_PREFIX,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }))
      const objects = listRes.Contents || []
      const stale = objects.filter(o => {
        const lm = o.LastModified?.getTime?.() ?? 0
        return lm > 0 && (now - lm) > TTL_MS
      })
      if (stale.length) {
        const deleteRes = await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: stale.map(s => ({ Key: s.Key! })),
            Quiet: true,
          }
        }))
        deletedCount += (deleteRes.Deleted?.length || 0)
      }
      if (!listRes.IsTruncated) break
      continuationToken = listRes.NextContinuationToken
    }

    return new Response(JSON.stringify({ success: true, deleted: deletedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(JSON.stringify({ error: 'cleanup_failed', message: error.message || 'Failed to cleanup tmp uploads' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})