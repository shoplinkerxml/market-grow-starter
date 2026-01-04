export function productToForm(product: any) {
  return {
    name: product?.name || '',
    name_ua: product?.name_ua || '',
    description: product?.description || '',
    description_ua: product?.description_ua || '',
    docket: product?.docket || '',
    docket_ua: product?.docket_ua || '',
    vendor: product?.vendor || '',
    article: product?.article || '',
    external_id: product?.external_id || '',
    supplier_id: String(product?.supplier_id || ''),
    category_id: String(product?.category_id || ''),
    category_external_id: String(product?.category_external_id || ''),
    currency_code: product?.currency_code || 'UAH',
    price: product?.price || 0,
    price_old: product?.price_old || 0,
    price_promo: product?.price_promo || 0,
    stock_quantity: product?.stock_quantity || 0,
    available: product?.available ?? true,
    state: product?.state || 'new',
    store_id: product?.store_id || ''
  };
}
export function formToProduct(form: any) {
  return { ...form };
}
export function deepEqual(a: any, b: any) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
export function sanitizeForm(form: any) {
  const result: any = {};
  Object.keys(form || {}).forEach(k => {
    const v = (form as any)[k];
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    result[k] = v;
  });
  return result;
}
