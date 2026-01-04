import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type GenerateBody = { store_id: string; format: 'xml' | 'csv' };

type XMLFieldConfig = { path: string };
type XMLConfig = { root?: string; fields?: XMLFieldConfig[] };
type StoreRow = { id: string; user_id?: string; store_name?: string; store_company?: string | null; store_url?: string | null; xml_config?: XMLConfig };
type Product = {
  id: string;
  external_id?: string;
  name?: string;
  name_ua?: string;
  description?: string;
  description_ua?: string;
  docket?: string;
  docket_ua?: string;
  vendor?: string;
  category_id?: string;
  category_external_id?: string;
  currency_code?: string;
  price?: number;
  price_old?: number;
  price_promo?: number;
  stock_quantity?: number;
  available?: boolean;
  slug?: string;
};
type LinkRow = {
  store_products?: Product;
  custom_external_id?: string;
  custom_price?: number;
  custom_name?: string;
  custom_description?: string;
  custom_category_id?: string;
  custom_available?: boolean;
  custom_stock_quantity?: number;
};
type ImageRow = { product_id: string; url?: string; order_index: number };
type ParamRow = { product_id: string; name?: string; value?: string; order_index: number; paramid?: string; valueid?: string };

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeXmlStart(xml: string): string {
  const noBom = xml.replace(/^\uFEFF/, '');
  return noBom.replace(/^[\r\n\t ]+/, '');
}

function cleanText(text: string): string {
  return String(text || '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCSV(records: Array<Record<string, unknown>>, fields: string[]): string {
  const header = fields.join(',');
  const rows = records.map((r) => fields.map((f) => {
    const v = (r as Record<string, unknown>)[f];
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\n');
  return `${header}\n${rows}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey || anonKey, { global: { headers: authHeader ? { Authorization: authHeader } : {} } });

    const body = await req.json() as GenerateBody;
    if (!body?.store_id || !body?.format) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: linkRow, error: linkErr } = await supabase
      .from('store_export_links')
      .select('id,store_id,format,token,object_key,is_active')
      .eq('store_id', body.store_id)
      .eq('format', body.format)
      .maybeSingle();
    if (linkErr) return new Response(JSON.stringify({ error: 'link_fetch_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!linkRow || linkRow.is_active !== true) {
      return new Response(JSON.stringify({ error: 'link_not_active' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: storeRow, error: storeErr } = await supabase
      .from('user_stores')
      .select('id,user_id,store_name,store_company,store_url,xml_config')
      .eq('id', body.store_id)
      .maybeSingle();
    if (storeErr) return new Response(JSON.stringify({ error: 'store_fetch_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const xmlConfig = storeRow?.xml_config ?? {};
    const rawFields: XMLFieldConfig[] = Array.isArray(xmlConfig?.fields) ? (xmlConfig.fields as XMLFieldConfig[]) : [];
    let fieldPaths: string[] = rawFields.map((x) => String(x?.path || '')).filter((p) => p.length > 0);
    const storeName = String((storeRow as StoreRow)?.store_name || '').toLowerCase();
    if (storeName === 'rozetka') {
      const extra: string[] = [
        'shop.currencies',
        'shop.categories',
        'offers.offer.price',
        'offers.offer.price_old',
        'offers.offer.price_promo',
        'offers.offer.currencyId',
        'offers.offer.categoryId',
        'offers.offer.vendor',
        'offers.offer.article',
        'offers.offer.name',
        'offers.offer.name_ua',
        'offers.offer.description',
        'offers.offer.description_ua',
        'offers.offer.state',
        'offers.offer.docket',
        'offers.offer.docket_ua',
        'offers.offer.stock_quantity',
        'offers.offer.picture[0]',
        'offers.offer.picture[1]',
        'offers.offer.picture[2]',
        'offers.offer.picture[3]',
        'offers.offer.picture[4]',
        'offers.offer.picture[5]',
        'offers.offer.picture[6]',
        'offers.offer.picture[7]',
        'offers.offer.picture[8]',
        'offers.offer.picture[9]',
        'offers.offer.param[0]',
        'offers.offer.param[1]',
        'offers.offer.param[2]',
        'offers.offer.param[3]',
        'offers.offer.param[4]',
        'offers.offer.param[5]',
        'offers.offer.param[6]',
        'offers.offer.param[7]',
        'offers.offer.param[8]',
        'offers.offer.param[9]',
        'offers.offer.param[10]',
        'offers.offer.param[11]',
        'offers.offer.param[12]',
        'offers.offer.param[13]',
        'offers.offer.param[14]',
        'offers.offer.param[15]',
        'offers.offer.param[16]',
        'offers.offer.param[17]',
        'offers.offer.param[18]',
        'offers.offer.param[19]'
      ];
      const set = new Set(fieldPaths);
      for (const p of extra) set.add(p);
      fieldPaths = Array.from(set);
    }
    const offerFieldPaths = fieldPaths.filter((p) => p.includes('offers.offer.'));
    const hasConfiguredOfferFields = offerFieldPaths.length > 0;
    const mandatoryFields = new Set(['price','currencyId','name','categoryId']);
    const cfgRoot = typeof xmlConfig?.root === 'string' ? String(xmlConfig.root).trim() : '';
    const rootTag = /^[A-Za-z_][\w.-]*$/.test(cfgRoot) ? cfgRoot : 'yml_catalog';

    let currenciesXml = '';
    let categoriesXml = '';
    const needCurrencies = fieldPaths.some((p) => p.toLowerCase().includes('shop.currencies') || p.toLowerCase().includes('currenc'));
    const needCategories = fieldPaths.some((p) => p.toLowerCase().includes('shop.categories') || p.toLowerCase().includes('categor'));

    if (needCurrencies) {
      const { data: curRows } = await supabase
        .from('store_currencies')
        .select('code,rate,is_base')
        .eq('store_id', body.store_id);
      const items = ((curRows || []) as Array<{ code: string; rate: number; is_base: boolean | null }>).
        map((c) => {
          const id = String(c.code || '').toUpperCase();
          const rate = c.is_base ? 1 : Number(c.rate || 1);
          return `<currency id="${xmlEscape(id)}" rate="${xmlEscape(String(rate))}"/>`;
        }).join('');
      currenciesXml = items ? `<currencies>${items}</currencies>` : '';
    }

    if (needCategories) {
      const { data: catRows } = await supabase
        .from('store_store_categories')
        .select('id,store_id,category_id,custom_name,is_active,external_id,rz_id_value, store_categories:category_id(id,external_id,name,parent_external_id,rz_id)')
        .eq('store_id', body.store_id)
        .eq('is_active', true);
      const items = ((catRows || []) as Array<any>).map((row) => {
        const sc = row.store_categories || {};
        const id = String(row.external_id ?? sc.external_id ?? '');
        const name = String(row.custom_name ?? sc.name ?? '');
        const rz = row.rz_id_value ? ` rz_id="${xmlEscape(String(row.rz_id_value))}"` : '';
        return `<category id="${xmlEscape(id)}"${rz}>${xmlEscape(name)}</category>`;
      }).join('');
      categoriesXml = items ? `<categories>${items}</categories>` : '';
    }

    const { data: linksData, error: lpErr } = await supabase
      .from('store_product_links')
      .select('*,store_products(*)')
      .eq('store_id', body.store_id);
    if (lpErr) return new Response(JSON.stringify({ error: 'links_fetch_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: activeCats } = await supabase
      .from('store_store_categories')
      .select('category_id')
      .eq('store_id', body.store_id)
      .eq('is_active', true);
    const activeCategoryIds = new Set(((activeCats || []) as Array<{ category_id: number }>).map((r) => String(r.category_id)));

    const productIds: string[] = (linksData || []).map((row: LinkRow) => String(row.store_products?.id || '')).filter((id: string) => id.length > 0);
    const { data: imagesData } = await supabase
      .from('store_product_images')
      .select('*')
      .in('product_id', productIds)
      .order('order_index');
    const { data: paramsData } = await supabase
      .from('store_product_params')
      .select('*')
      .in('product_id', productIds)
      .order('order_index');

    const r2PublicHost = Deno.env.get('R2_PUBLIC_HOST') ?? '';
    const accountIdEnv = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';
    const bucketEnv = Deno.env.get('R2_BUCKET_NAME') ?? '';
    const makePublicUrlFromKey = (key: string): string => {
      const k = String(key || '');
      if (!k) return '';
      if (r2PublicHost && bucketEnv) return `https://${r2PublicHost}/${bucketEnv}/${k}`;
      if (accountIdEnv && bucketEnv) return `https://${bucketEnv}.${accountIdEnv}.r2.cloudflarestorage.com/${k}`;
      return k;
    };

    const offersXml = (linksData || [])
      .filter((row: LinkRow) => {
        const base: Product = row.store_products || ({} as Product);
        const catId = String(base.category_id || '');
        return !catId || activeCategoryIds.has(catId);
      })
      .map((row: LinkRow) => {
      const base: Product = row.store_products || ({} as Product);
      const imgs: ImageRow[] = ((imagesData || []) as any[]).filter((i) => String(i.product_id) === String(base.id));
      const prms: ParamRow[] = ((paramsData || []) as any[]).filter((p) => String(p.product_id) === String(base.id));
      const docketUaVal = String((prms.find((p) => p.name === 'docket_ua')?.value) ?? base.description_ua ?? base.docket_ua ?? '');
      const docketVal = String((prms.find((p) => p.name === 'docket')?.value) ?? base.description ?? base.docket ?? '');

      const getVal = (name: string): string => {
        if (name === 'id') return row.custom_external_id ?? base.external_id ?? base.id;
        if (name === 'price') return String(row.custom_price ?? base.price ?? '');
        if (name === 'price_old') return String(base.price_old ?? '');
        if (name === 'price_promo') return String(base.price_promo ?? '');
        if (name === 'currencyId') return String(base.currency_code ?? '');
        if (name === 'name') return String(row.custom_name ?? base.name ?? base.name_ua ?? docketUaVal ?? '');
        if (name === 'name_ua') return String(base.name_ua ?? '');
        if (name === 'description') return String(row.custom_description ?? base.description ?? base.description_ua ?? '');
        if (name === 'description_ua') return String(base.description_ua ?? '');
        if (name === 'url') {
          const su = String(storeRow?.store_url || '').replace(/\/$/, '');
          const slug = base.slug || base.external_id || base.id;
          return `${su}/product/${slug}`;
        }
        if (name === 'vendor') return String(base.vendor ?? '');
        if (name === 'categoryId') return String(row.custom_category_id ?? base.category_external_id ?? base.category_id ?? '');
        if (name === 'available') return (row.custom_available ?? base.available ?? true) ? 'true' : 'false';
        if (name === 'stock_quantity') return String(row.custom_stock_quantity ?? base.stock_quantity ?? '');
        if (name === 'docket_ua') return docketUaVal;
        if (name === 'docket') return docketVal;
        const bv = (base as Record<string, unknown>)[name];
        const lv = (row as Record<string, unknown>)[`custom_${name}`];
        return String(bv ?? lv ?? '');
      };

      const configuredSimpleSet = (() => {
        const s = new Set<string>();
        for (const p of fieldPaths) {
          if (!p.startsWith('offers.offer.')) continue;
          const m = p.match(/^offers\.offer\.([A-Za-z0-9_:-]+)(?:\[\d+\])?$/);
          const key = m?.[1] || '';
          if (!key || key === 'picture' || key === 'param') continue;
          s.add(key);
        }
        return s;
      })();
      const defaultSimple = ['price','price_old','price_promo','currencyId','name','name_ua','description','description_ua','vendor','article','state','categoryId','stock_quantity','docket','docket_ua','url'];
      const simpleFields = Array.from(new Set<string>([...defaultSimple, ...configuredSimpleSet]));
      const excludedForRozetka = storeName === 'rozetka' ? new Set(['url']) : new Set<string>();
      const shouldInclude = (sf: string) => {
        if (sf === 'docket' || sf === 'docket_ua') return true;
        return !excludedForRozetka.has(sf) && (mandatoryFields.has(sf) || fieldPaths.some((p) => p.includes(`offers.offer.${sf}`)));
      };
      const simpleXml = simpleFields
        .filter((sf) => {
          if (!shouldInclude(sf)) return false;
          const v = cleanText(getVal(sf));
          return v.length > 0;
        })
        .map((sf) => `<${sf}>${xmlEscape(cleanText(getVal(sf)))}</${sf}>`)
        .join('');

      const picturesXml = (() => {
        const picPaths = fieldPaths.filter((p) => p.match(/offers\.offer\.picture\[\d+\]$/));
        const includePics = (imgs.length > 0) || (picPaths.length > 0);
        if (!includePics) return '';
        return imgs.map((img: any) => {
          const key = img?.r2_key_original as string | undefined;
          const u = key ? makePublicUrlFromKey(key) : String(img?.url || '');
          return `<picture>${xmlEscape(cleanText(u))}</picture>`;
        }).join('');
      })();

      const paramsXml = (() => {
        const paramPaths = fieldPaths.filter((p) => p.match(/offers\.offer\.param\[\d+\]/));
        const prmsFiltered = prms.filter((pm) => pm.name !== 'docket_ua' && pm.name !== 'docket');
        const includeParams = (prmsFiltered.length > 0) || (paramPaths.length > 0);
        if (!includeParams) return '';
        return prmsFiltered.map((pm: ParamRow) => {
          const attrs: string[] = [];
          if (pm.name) attrs.push(`name="${xmlEscape(String(pm.name))}"`);
          if (pm.paramid) attrs.push(`paramid="${xmlEscape(String(pm.paramid))}"`);
          if (pm.valueid) attrs.push(`valueid="${xmlEscape(String(pm.valueid))}"`);
          const val = xmlEscape(cleanText(String(pm.value ?? '')));
          const attrsStr = attrs.length ? ' ' + attrs.join(' ') : '';
          return `<param${attrsStr}>${val}</param>`;
        }).join('');
      })();

      const offerAttrsList: string[] = [];
      const idAttr = xmlEscape(getVal('id'));
      if (idAttr) offerAttrsList.push(`id="${idAttr}"`);
      const availableAttr = getVal('available') === 'true' ? 'true' : 'false';
      offerAttrsList.push(`available="${availableAttr}"`);
      const offerAttrs = offerAttrsList.length ? ' ' + offerAttrsList.join(' ') : '';
      return `<offer${offerAttrs}>${simpleXml}${picturesXml}${paramsXml}</offer>`;
    }).join('');

    const shopName = cleanText(String((storeRow as StoreRow)?.store_name || ''));
    const shopCompany = cleanText(String((storeRow as StoreRow)?.store_company || ''));
    const shopUrl = cleanText(String((storeRow as StoreRow)?.store_url || ''));

    const two = (n: number) => (n < 10 ? `0${n}` : String(n));
    const now = new Date();
    const dateAttr = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`;

    const header = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    const xmlContentRaw = `${header}<${rootTag} date="${xmlEscape(dateAttr)}"><shop><name>${xmlEscape(shopName)}</name><company>${xmlEscape(shopCompany)}</company><url>${xmlEscape(shopUrl)}</url>${currenciesXml}${categoriesXml}<offers>${offersXml}</offers></shop></${rootTag}>`;
    const xmlContent = sanitizeXmlStart(xmlContentRaw);

    const content = body.format === 'xml' ? xmlContent : toCSV([], []);
    const contentType = body.format === 'xml' ? 'application/xml' : 'text/csv';

    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';
    const bucket = Deno.env.get('R2_BUCKET_NAME') ?? '';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      return new Response(JSON.stringify({ error: 'server_misconfig' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const s3 = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
    let objectKey = String(linkRow.object_key || '')
    if (!objectKey) {
      objectKey = `exports/stores/${body.store_id}/${body.format}/${String(linkRow.token)}.${body.format}`
    }
    const put = new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: new TextEncoder().encode(content), ContentType: `${contentType}; charset=UTF-8` });
    await s3.send(put);

    await supabase
      .from('store_export_links')
      .update({ object_key: objectKey, last_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', linkRow.id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message || '') : '';
    return new Response(JSON.stringify({ error: 'generate_failed', message: msg || 'failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
