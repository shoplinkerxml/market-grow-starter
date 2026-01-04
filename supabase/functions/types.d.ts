declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void
}

declare module "npm:@supabase/supabase-js" {
  export function createClient(url: string, key: string, options?: any): any
}

declare module "npm:@aws-sdk/client-s3" {
  export class S3Client {
    constructor(cfg: any)
    send(command: any): Promise<any>
  }
  export class PutObjectCommand {
    constructor(cfg: any)
  }
}

declare type ImageData = { data: Uint8ClampedArray; width: number; height: number }

declare module "npm:@imagemagick/magick-wasm" {
  export const ImageMagick: any
  export function initializeImageMagick(wasm: Uint8Array | ArrayBuffer): Promise<void>
  export enum MagickFormat { WebP }
}
