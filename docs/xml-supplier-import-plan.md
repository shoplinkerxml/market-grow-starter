# План: Система імпорту XML постачальників

## 1. Цілі та принципи

- Імпорт працює у фоні, не блокує UI, не вантажить БД.
- Надійне виконання: ретраї, ідемпотентність, відновлення після збоїв.
- Інтеграція в існуючу модель `user_suppliers` / `store_products` без дублювання сутностей.
- Per-supplier розклад автооновлення (вимкнено / 6 / 12 / 24 год) + ручний запуск.
- Гнучкий маппінг XML → поля товару (різні постачальники мають різну структуру).

## 2. Стек і архітектура

- **Inngest** (через Lovable-конектор) — durable jobs, steps, retries, concurrency, throttling, cron.
- **Supabase Edge Functions** — точки входу: запуск, сервінг Inngest-функцій, отримання статусу.
- **Supabase Postgres** — таблиці `supplier_import_runs`, `supplier_import_items`, `supplier_xml_mappings`; джерело даних — `user_suppliers.xml_feed_url`, цільова таблиця — `store_products` (+ `store_product_images`, `store_product_params`).
- **Realtime** — оновлення прогресу імпорту в UI без поллінгу.
- **Стрімінговий парсер XML** в edge-функції (saxes у потоковому режимі) — не тримаємо весь файл у пам'яті.

Високорівнева схема:

```text
UI (кнопка "Імпорт XML")
       │
       ▼
Edge: supplier-import-start ──► Inngest event "supplier/import.requested"
                                              │
                                              ▼
                              Inngest function "supplier-import"
                                ├─ step.run: завантажити XML (HEAD + GET, ETag)
                                ├─ step.run: визначити маппінг
                                ├─ step.run: парс + батчі по 500 рядків
                                ├─ step.run (concurrency=1 per supplier):
                                │     upsert батчу через RPC `supplier_import_upsert_batch`
                                └─ step.run: фіналізація, інвалідація кешів, realtime
Cron (Inngest schedules) ──► event "supplier/import.scheduled" для активних постачальників
```

## 3. UI / Меню

Обидва місця:

1. **В картці постачальника** (`src/components/user/suppliers/SupplierForm.tsx`):
   - Поле `xml_feed_url` (вже є).
   - Нова секція "Автоімпорт": перемикач + select частоти (off / 6h / 12h / 24h), збереження у `user_suppliers.import_frequency_hours`.
   - Кнопка "Імпортувати зараз" + останній статус (час, створено/оновлено/помилок).

2. **Окремий розділ меню "Імпорт XML"** (`/user/xml-imports`):
   - Таблиця всіх запусків (`supplier_import_runs`): постачальник, початок, тривалість, статус, лічильники, кнопка "Деталі".
   - Сторінка деталей run: прогрес-бар (realtime), помилки по рядках (з `supplier_import_items` де `status='failed'`), повторити невдалі рядки.

Меню додається через існуючий `menu_items` / `user_menu_items`.

## 4. Схема БД

Усі нові таблиці з RLS + GRANT-ами, прив'язка через `user_id` та `supplier_id`.

- `supplier_import_runs`
  - `id uuid pk`, `user_id uuid`, `supplier_id int fk user_suppliers`, `trigger text` (manual|scheduled), `status text` (queued|running|succeeded|failed|cancelled), `xml_url text`, `xml_etag text`, `xml_size_bytes bigint`, `total_rows int`, `processed_rows int`, `created_count int`, `updated_count int`, `skipped_count int`, `failed_count int`, `error text`, `started_at`, `finished_at`, `created_at`, `updated_at`.
- `supplier_import_items` (звіт по помилках)
  - `id uuid pk`, `run_id uuid fk`, `external_id text`, `status text`, `error text`, `payload jsonb`, `created_at`.
  - TTL-чистка cron-ом (7 днів).
- `supplier_xml_mappings`
  - `id uuid pk`, `user_id uuid`, `supplier_id int fk`, `version int`, `is_active bool`, `xpath_item text` (напр. `/yml_catalog/shop/offers/offer`), `fields jsonb`, `images jsonb`, `params jsonb`, `category jsonb`, `currency text`, `created_at`, `updated_at`.
- Розширення `user_suppliers`:
  - `import_frequency_hours int default 0`, `import_enabled bool default false`, `last_import_at timestamptz`, `last_import_run_id uuid`, `xml_etag text`, `xml_last_modified text`.

Unique index `(supplier_id, external_id)` на `store_products`. ENABLE Realtime для `supplier_import_runs`.

## 5. Inngest-функції

- `supplier-import` (event `supplier/import.requested`):
  1. `step.run("acquire-lock")` — створити `supplier_import_runs` зі статусом `running`; якщо вже є активний run для supplier — вийти.
  2. `step.run("fetch-xml")` — `fetch` із `If-None-Match`/`If-Modified-Since`; якщо 304 — позначити `skipped`, фініш.
  3. `step.run("parse")` — стрімовий парсер, формує батчі по 500 нормалізованих рядків, кожен батч у власному `step.run("upsert-batch-N")` -> RPC.
  4. `step.run("finalize")` — оновити лічильники, `last_import_at`, інвалідація Redis-кешу товарів, realtime подія.
  - `concurrency: { key: "event.data.supplier_id", limit: 1 }` — один імпорт на постачальника одночасно.
  - `throttle: { limit: 10, period: "1m", key: "event.data.user_id" }`.
  - `retries: 3` із експоненційним бекофом.

- `supplier-import-scheduler` (Inngest cron `*/15 * * * *`):
  - SELECT постачальники, де `import_enabled` і `now() - last_import_at >= import_frequency_hours`.
  - Для кожного — `inngest.send("supplier/import.requested", { trigger: "scheduled" })`.

- `supplier-import-cleanup` (cron `0 3 * * *`):
  - DELETE `supplier_import_items` старші 7 днів; DELETE `supplier_import_runs` старші 90 днів.

## 6. Стратегія upsert у `store_products`

Ключ зіставлення: `(user_id, supplier_id, external_id)`.

Серверна RPC `supplier_import_upsert_batch(p_run_id uuid, p_rows jsonb)`:
- Усе в одній транзакції на батч (500 рядків).
- `INSERT ... ON CONFLICT (supplier_id, external_id) DO UPDATE SET price, price_old, price_promo, stock_quantity, available, currency_code, name, name_ua, description, vendor, article, updated_at`.
- Не чіпаємо `store_id`, `is_active`, кастомні поля в `store_product_links`.
- Інкрементуємо лічильники через RETURNING.
- Помилкові рядки → `supplier_import_items` (status=`failed`), `SAVEPOINT` per row.

Зображення та параметри — окремі дочірні `step.run` після основного upsert, через RPC `supplier_import_upsert_images` / `..._params` (by `(product_id, url)` / `(product_id, name)`).

Товари, які зникли з фіда: **не видаляємо** автоматично.

## 7. Безпека та продуктивність

- RLS на нових таблицях: `auth.uid() = user_id`. GRANT-и: `authenticated` SELECT, `service_role` ALL. Edge-функції пишуть через service role.
- `verify_jwt = true` на `supplier-import-start`; `verify_jwt = false` на серв-ендпоінті Inngest (підпис перевіряє SDK).
- XML тільки `https://`, валідація URL, ліміт розміру (100 МБ), таймаут 60с на fetch.
- Батч 500 + concurrency 1 per supplier ⇒ постійне низьке навантаження на БД.
- Кеш товарів інвалідуємо одним викликом наприкінці run.

## 8. Маппінг XML

- За замовчуванням — пресет YML/Rozetka: `offers/offer`, `name`, `price`, `currencyId`, `picture`, `param`, `categoryId`.
- Якщо немає `supplier_xml_mappings`, перший імпорт виявляє формат і створює `version=1`.
- В UI постачальника — кнопка "Налаштувати маппінг" (v2).

## 9. Поетапні задачі

1. Підключити Inngest-конектор; додати `supabase/functions/inngest/index.ts` із порожнім сервером.
2. Міграція БД: нові таблиці + розширення `user_suppliers` + unique index на `store_products` + RLS + GRANT-и + Realtime.
3. Edge function `supplier-import-start` + клієнтський сервіс `XmlImportService`.
4. Inngest-функція `supplier-import` (fetch + парс + батчі + RPC upsert). Тільки YML-пресет.
5. RPC `supplier_import_upsert_batch` + RPC для images/params.
6. UI в `SupplierForm`: поля автоімпорту, кнопка "Імпортувати зараз", індикатор останнього run.
7. Сторінка `/user/xml-imports`: список runs + детальна сторінка з Realtime-прогресом і помилками.
8. Inngest cron `supplier-import-scheduler` + `supplier-import-cleanup`.
9. i18n ключі в `src/i18n/dictionaries/suppliers.ts` (UK/EN).
10. Інвалідація кешів `ProductService`/`PersistentCacheService` + realtime suppress 2-3с після фінішу.
11. Тести: unit для маппера/edge-функції; e2e (Playwright).
12. v2: редактор маппінгу, "позначити відсутні як недоступні", імпорт з файлу, gzip.

## 10. Технічні деталі

- Парсер: `saxes` (`npm:saxes`) — стрімінг у Deno.
- Inngest: `npm:inngest@^3`, серв через `inngest/deno`. Події — через connector gateway.
- Idempotency: `inngest.send({ id: "import:" + supplier_id + ":" + iso_minute, ... })`.
- Concurrency: supplier_id (1), user_id (3).
- Realtime канал: `supplier_import_runs:user_id=<uid>`, підписка в `useEffect` з cleanup.

## 11. Поза скоупом v1

- Не видаляємо товари, відсутні в фіді.
- Не редагуємо маппінг через UI.
- Не імпортуємо з файлу (тільки URL).
- Без diff-перегляду перед застосуванням.

## 12. Прогрес виконання

Чеклист реалізації — оновлюється після кожного кроку.

- [x] **Крок 1.** Підключено Inngest-конектор + скаффолд `supabase/functions/inngest/index.ts` (порожній serve-ендпоінт), `verify_jwt = false` у `supabase/config.toml`.
- [x] **Крок 2.** Міграція БД: створено `supplier_import_runs`, `supplier_import_items`, `supplier_xml_mappings`; розширено `user_suppliers` (import_enabled, import_frequency_hours, last_import_at, last_import_run_id, xml_etag, xml_last_modified); додано unique index `(supplier_id, external_id)` на `store_products`; RLS + GRANT-и; Realtime для runs/items.
- [ ] **Крок 3.** Edge function `supplier-import-start` + клієнтський `XmlImportService`.
- [ ] **Крок 4.** Inngest-функція `supplier-import` (fetch + парс + батчі + RPC upsert), YML-пресет.
- [ ] **Крок 5.** RPC `supplier_import_upsert_batch` + RPC для images/params.
- [ ] **Крок 6.** UI в `SupplierForm`: автоімпорт, "Імпортувати зараз", індикатор останнього run.
- [ ] **Крок 7.** Сторінка `/user/xml-imports` (список + деталі з Realtime-прогресом).
- [ ] **Крок 8.** Inngest cron `supplier-import-scheduler` + `supplier-import-cleanup`.
- [ ] **Крок 9.** i18n ключі в `src/i18n/dictionaries/suppliers.ts` (UK/EN).
- [ ] **Крок 10.** Інвалідація `ProductService`/`PersistentCacheService` + realtime suppress 2-3с після фінішу.
- [ ] **Крок 11.** Тести: unit (маппер/edge) + e2e (Playwright).
- [ ] **Крок 12 (v2).** Редактор маппінгу, "позначити відсутні як недоступні", імпорт з файлу, gzip.

### Зроблено в кроці 1

- Підключено конектор `inngest` → з'явились `INNGEST_API_KEY`, `INNGEST_SIGNING_KEY` (плюс `LOVABLE_API_KEY` уже є).
- Створено `supabase/functions/inngest/index.ts` з клієнтом `id: "marketgrow"` і порожнім масивом `functions`.
- У `supabase/config.toml` додано `[functions.inngest] verify_jwt = false` (підпис перевіряє SDK через `INNGEST_SIGNING_KEY`).
- Після деплою URL ендпоінта: `https://ehznqzaumsnjkrntaiox.supabase.co/functions/v1/inngest` — потрібно один раз зробити Sync у Inngest Dashboard, щоб платформа підхопила застосунок (поки що без функцій).