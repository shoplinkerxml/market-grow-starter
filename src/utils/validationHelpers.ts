export function isNonEmptyString(s: string) {
  return typeof s === 'string' && s.trim().length > 0;
}
export function isPositiveNumber(n: number) {
  return typeof n === 'number' && isFinite(n) && n > 0;
}
export function validateProductForm(form: any) {
  const errors: string[] = [];
  if (!isNonEmptyString(form.name)) errors.push('name');
  if (!isNonEmptyString(form.vendor)) errors.push('vendor');
  if (!isNonEmptyString(form.article)) errors.push('article');
  if (!isNonEmptyString(form.supplier_id)) errors.push('supplier_id');
  if (!isNonEmptyString(form.currency_code)) errors.push('currency_code');
  if (!isPositiveNumber(form.price)) errors.push('price');
  return { ok: errors.length === 0, errors };
}
