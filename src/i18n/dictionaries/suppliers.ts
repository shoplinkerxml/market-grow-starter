import type { Dictionary } from "../types";

export const suppliersDictionary: Dictionary = {
  menu_suppliers: { uk: "Постачальники", en: "Suppliers" },
  menu_store_templates: { uk: "Шаблони XML", en: "XML Templates" },
  suppliers_title: { uk: "Постачальники", en: "Suppliers" },
  suppliers_description: {
    uk: "Керування вашими постачальниками",
    en: "Manage your suppliers",
  },
  loading_suppliers: { uk: "Завантаження сторінки постачальників…", en: "Loading suppliers page…" },
  create_supplier: { uk: "Додати постачальника", en: "Add Supplier" },
  create_supplier_description: {
    uk: "Створення нового постачальника",
    en: "Create new supplier",
  },
  edit_supplier: { uk: "Редагувати постачальника", en: "Edit Supplier" },
  edit_supplier_description: {
    uk: "Редагування інформації про постачальника",
    en: "Edit supplier information",
  },
  add_supplier: { uk: "Додати постачальника", en: "Add Supplier" },
  back_to_suppliers: {
    uk: "Назад до постачальників",
    en: "Back to Suppliers",
  },
  no_suppliers: { uk: "Немає постачальників", en: "No Suppliers" },
  no_suppliers_description: {
    uk: "Додайте першого постачальника для початку роботи",
    en: "Add your first supplier to get started",
  },
  supplier_name: { uk: "Назва постачальника", en: "Supplier Name" },
  supplier_name_placeholder: {
    uk: "Введіть назву постачальника",
    en: "Enter supplier name",
  },
  website: { uk: "Сайт", en: "Website" },
  website_placeholder: {
    uk: "https://example.com",
    en: "https://example.com",
  },
  xml_feed_url: { uk: "Посилання на прайс", en: "Price Feed URL" },
  xml_feed_url_placeholder: {
    uk: "https://example.com/price.xml",
    en: "https://example.com/price.xml",
  },
  phone: { uk: "Телефон", en: "Phone" },
  phone_placeholder: {
    uk: "+380 XX XXX XX XX",
    en: "+380 XX XXX XX XX",
  },
  supplier_website_empty: {
    uk: "Додайте сайт постачальника",
    en: "Add supplier website",
  },
  supplier_xml_feed_empty: {
    uk: "Додайте посилання на прайс",
    en: "Add price feed URL",
  },
  supplier_phone_empty: {
    uk: "Додайте телефон постачальника",
    en: "Add supplier phone",
  },
  supplier_created: {
    uk: "Постачальника створено",
    en: "Supplier created",
  },
  supplier_updated: {
    uk: "Постачальника оновлено",
    en: "Supplier updated",
  },
  supplier_deleted: {
    uk: "Постачальника видалено",
    en: "Supplier deleted",
  },
  failed_save_supplier: {
    uk: "Помилка збереження постачальника",
    en: "Failed to save supplier",
  },
  failed_load_suppliers: {
    uk: "Помилка завантаження постачальників",
    en: "Failed to load suppliers",
  },
  failed_delete_supplier: {
    uk: "Помилка видалення постачальника",
    en: "Failed to delete supplier",
  },
  delete_supplier_confirm: {
    uk: "Видалити постачальника?",
    en: "Delete Supplier?",
  },
  suppliers_limit: { uk: "Постачальники", en: "Suppliers" },
  suppliers_limit_reached: {
    uk: "Досягнуто ліміту постачальників",
    en: "Supplier limit reached",
  },
  save_changes: { uk: "Зберегти зміни", en: "Save Changes" },
  supplier_is_active: { uk: "Постачальник активний", en: "Supplier active" },
  supplier_inactive_warning: { uk: "Всі товари постачальника стануть неактивними", en: "All supplier products will become inactive" },
  supplier_activated: { uk: "Постачальник активовано", en: "Supplier activated" },
  supplier_deactivated: { uk: "Постачальник деактивовано", en: "Supplier deactivated" },
  inactive: { uk: "Неактивний", en: "Inactive" },
  // XML Import
  xml_import_section: { uk: "Автоімпорт XML", en: "XML Auto-Import" },
  xml_import_enabled: { uk: "Увімкнути автоімпорт", en: "Enable auto-import" },
  xml_import_frequency: { uk: "Частота оновлення", en: "Update frequency" },
  xml_import_freq_off: { uk: "Вимкнено", en: "Off" },
  xml_import_freq_6h: { uk: "Кожні 6 годин", en: "Every 6 hours" },
  xml_import_freq_12h: { uk: "Кожні 12 годин", en: "Every 12 hours" },
  xml_import_freq_24h: { uk: "Раз на добу", en: "Daily" },
  xml_import_run_now: { uk: "Імпортувати зараз", en: "Import now" },
  xml_import_no_url: { uk: "Спочатку додайте посилання на прайс", en: "Add price feed URL first" },
  xml_import_queued: { uk: "Імпорт у черзі", en: "Import queued" },
  xml_import_failed_start: { uk: "Не вдалося запустити імпорт", en: "Failed to start import" },
  xml_import_last_run: { uk: "Останній імпорт", en: "Last import" },
  xml_import_never: { uk: "Ще не запускався", en: "Never run" },
  xml_import_status_queued: { uk: "У черзі", en: "Queued" },
  xml_import_status_running: { uk: "Виконується", en: "Running" },
  xml_import_status_succeeded: { uk: "Успішно", en: "Succeeded" },
  xml_import_status_failed: { uk: "Помилка", en: "Failed" },
  xml_import_status_cancelled: { uk: "Скасовано", en: "Cancelled" },
  xml_import_stats: { uk: "Створено / Оновлено / Помилок", en: "Created / Updated / Failed" },
};
