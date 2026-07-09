# Крок 12.1: Редактор маппінгу XML

Мета — дати користувачу керувати тим, як XML-фід постачальника перекладається у поля товару, замість hardcoded YML-пресета. Маппінг зберігається у вже існуючій таблиці `supplier_xml_mappings` (версіонована, `is_active`), і використовується Inngest-функцією замість фіксованих імен тегів.

## 1. Модель маппінгу (jsonb у `supplier_xml_mappings`)

Не змінюємо схему БД (колонки вже є: `xpath_item`, `fields`, `images`, `params`, `category`, `currency`, `version`, `is_active`). Формалізуємо структуру:

```jsonc
{
  "xpath_item": "offer",                    // ім'я тега рядка (case-insensitive)
  "id_attr": "id",                          // атрибут з external_id
  "available_attr": "available",            // атрибут з available (опц.)
  "fields": {
    "name":         { "tag": "name" },
    "name_ua":      { "tag": "name_ua" },
    "description":  { "tag": "description" },
    "price":        { "tag": "price",     "type": "number" },
    "price_old":    { "tag": "oldprice",  "type": "number" },
    "currency_code":{ "tag": "currencyId" },
    "vendor":       { "tag": "vendor" },
    "article":      { "tag": "vendorCode" },
    "stock_quantity":{"tag": "stock_quantity", "type": "number" }
  },
  "images":   { "tag": "picture" },
  "params":   { "tag": "param", "name_attr": "name", "unit_attr": "unit" },
  "category": { "tag": "categoryId" },
  "currency": "UAH"                         // fallback
}
```

Default (YML-пресет) — константа в `src/lib/xml-mapping-defaults.ts`, використовується і фронтом (плейсхолдери/reset), і бекендом (fallback, якщо активної версії нема).

## 2. Backend (`supabase/functions/inngest/index.ts`)

- Перед парсом (у новому `step.run("load-mapping")`) вибрати з `supplier_xml_mappings` активний рядок за `(supplier_id, is_active=true)` з найбільшою `version`. Якщо нема — YML-пресет.
- `streamParseYml` перейменувати на `streamParseWithMapping(body, mapping, onBatch, onProgress)` і замінити hardcoded `switch (name)` на побудований з `mapping.fields`/`images`/`params`/`category` словник `tagName → handler`. Атрибути `offer.id`/`offer.available` — з `id_attr`/`available_attr`.
- Логіка батчів/лімітів/таймаутів/суфіксу currency лишається як є.

## 3. Клієнтський сервіс (`src/lib/xml-mapping-service.ts`)

- `list(supplierId)` — SELECT з `supplier_xml_mappings` desc by version.
- `getActive(supplierId)` — активна версія або `null`.
- `saveDraft(supplierId, payload)` — новий рядок (version = max+1, is_active=false).
- `activate(supplierId, mappingId)` — транзакційно (одним UPDATE через RPC): `is_active = (id = ?)`.
- Використовує `supabase` клієнт напряму (RLS вже пише user_id через default або тригер — треба перевірити; якщо ні, передавати `auth.uid()` явно, або додати edge-функцію `supplier-mapping-upsert` для service_role write).

Технічна нотатка: `supplier_xml_mappings` має RLS, але політик мало. Перевірю через `supabase--read_query` і, якщо нема INSERT/UPDATE політик для `authenticated`, додам їх окремою міграцією.

## 4. UI (`src/components/user/suppliers/`)

Нова секція у `SupplierForm` — кнопка "Налаштувати маппінг XML" → відкриває маршрут `/user/suppliers/:id/mapping` (або dialog). Реалізуємо як окрему сторінку `SupplierMapping.tsx`:

- Заголовок: постачальник, поточна активна версія + селектор попередніх версій (read-only перегляд).
- Форма з полями:
  - `xpath_item`, `id_attr`, `available_attr`, `currency` (fallback).
  - Секція "Поля товару" — таблиця (name/name_ua/description/price/price_old/currency_code/vendor/article/stock_quantity): `tag` + `type` (text|number).
  - Секція "Зображення" — `tag`.
  - Секція "Параметри" — `tag`, `name_attr`, `unit_attr`.
  - Секція "Категорія" — `tag`.
- Кнопки: "Скинути до пресета", "Зберегти чернетку", "Активувати".
- (Опційно, у цьому кроці не робимо) — превʼю з живого XML.

Дизайн — узгоджений з рештою кабінету: `PageHeader`, `Card`, `Input`, `Select`, `Button`; іконки Lucide; `p-6 space-y-6`.

## 5. i18n

Додати блок `xml_mapping_*` (~25 ключів) у `src/i18n/dictionaries/suppliers.ts` (UK/EN): назви секцій, полів, кнопок, тостів.

## 6. Тести

- Unit: `streamParseWithMapping` (Deno-тест у `supabase/functions/inngest/`) з двома фікстурами — стандартний YML + кастомний (інші імена тегів + `id_attr`), перевірка коректного маппінгу.
- Unit (vitest): `xml-mapping-service.saveDraft/activate` з мок Supabase.

## 7. Файли

- new: `src/lib/xml-mapping-defaults.ts`
- new: `src/lib/xml-mapping-service.ts`
- new: `src/pages/user/SupplierMapping.tsx`
- edit: `src/App.tsx` (маршрут)
- edit: `src/components/user/suppliers/SupplierForm.tsx` (кнопка "Маппінг")
- edit: `supabase/functions/inngest/index.ts` (load-mapping step + generic parser)
- edit: `src/i18n/dictionaries/suppliers.ts`
- (можливо) міграція: додати INSERT/UPDATE RLS-політики для `supplier_xml_mappings`, якщо їх нема
- edit: `docs/xml-supplier-import-plan.md` (позначити 12.1 ✅)

## Поза скоупом цього підкроку

- Live-превʼю парсингу з XML (потребує окремої edge-функції; винесемо в 12.1b).
- Автоматичне визначення формату при першому імпорті.

Підтвердіть — і я реалізую.
