export type ImageErrorCode =
  | 'unauthorized'
  | 'file_too_large'
  | 'invalid_file_type'
  | 'validation_error'
  | 'no_file'
  | 'no_product_id'
  | 'unknown';

export function mapImageErrorToToast(t: (key: string) => string, code?: string | null): string {
  const c = String(code || 'unknown');
  if (c === 'unauthorized') return t('unauthorized_upload') || 'Ошибка авторизации при загрузке';
  if (c === 'file_too_large') return t('file_too_large') || 'Файл слишком большой';
  if (c === 'invalid_file_type') return t('invalid_image_format') || 'Неверный формат изображения';
  if (c === 'validation_error') return t('failed_upload_image') || 'Ошибка загрузки изображения';
  if (c === 'no_file') return t('failed_upload_image') || 'Файл не выбран';
  if (c === 'no_product_id') return t('save_product_first') || 'Спочатку збережіть товар, потім завантажуйте фото';
  return t('failed_upload_image') || 'Ошибка загрузки изображения';
}
