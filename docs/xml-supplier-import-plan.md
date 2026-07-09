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
- [x] **Крок 3.** Edge function `supplier-import-start` + клієнтський `XmlImportService` (валідація supplier, guard від дублів, створення `supplier_import_runs`, відправка події `supplier/import.requested` через Inngest gateway з idempotency `import:<sid>:<minute>`).
- [x] **Крок 4.** Inngest-функція `supplier-import` зареєстрована в `supabase/functions/inngest/index.ts`: steps `acquire-lock` → `fetch-headers` (ETag/Last-Modified, 304 → succeeded) → стрімовий парс через `saxes` (YML-пресет, ліміт 100MB, таймаут 60с) → батчі по 500 у `upsert-batch-N` (RPC `supplier_import_upsert_batch` — буде створено на кроці 5) → `finalize` (оновлення `supplier_import_runs` + `user_suppliers.last_import_*`). Concurrency 1 per `supplier_id`, throttle 10/min per `user_id`, retries 3.
- [x] **Крок 5.** RPC `supplier_import_upsert_batch` + `supplier_import_replace_images` + `supplier_import_replace_params`. Upsert по `(supplier_id, external_id)`, per-row savepoint у `EXCEPTION`-блоку (помилкові рядки → `supplier_import_items`), категорія резолвиться через `store_categories(supplier_id, external_id)`. Зображення/параметри замінюються повністю по фіду; завантажені в R2 картинки (з `r2_key_*`) зберігаються.
- [x] **Крок 6.** UI в `SupplierForm`: секція "Автоімпорт XML" (switch + select 6/12/24h, збереження в `user_suppliers.import_enabled`/`import_frequency_hours`), кнопка "Імпортувати зараз" (виклик `XmlImportService.startImport`), індикатор останнього run з Realtime-підпискою на `supplier_import_runs` (фільтр по `supplier_id`). Розширено `Supplier` / `UpdateSupplierData` + edge `suppliers-update` приймає нові поля.
- [x] **Крок 7.** Сторінка `/user/xml-imports`: таблиця runs (постачальник, trigger, час, тривалість, статус, лічильники) з Realtime-оновленням; деталі run через `?run=<id>` — прогрес-бар, статистика (processed/created/updated/skipped/failed), помилки рядків з `supplier_import_items` (Realtime INSERT). `XmlImportService` отримав `listAllRuns` і `listRunItems`. Маршрут зареєстрований у `src/App.tsx`.
- [x] **Крок 8.** Inngest cron `supplier-import-scheduler` + `supplier-import-cleanup`.
- [x] **Крок 9.** i18n ключі в `src/i18n/dictionaries/suppliers.ts` (UK/EN).
- [x] **Крок 10.** Інвалідація `ProductService`/`PersistentCacheService` + realtime suppress 2-3с після фінішу.
- [x] **Крок 11.** Unit-тести для `handleImportRunFinish` (`src/test/xml-import-cache.test.ts`, 8 кейсів). E2E (Playwright) відкладено — потребує live Inngest та реального XML-фіда.
- [~] **Крок 12 (v2).** Редактор маппінгу, "позначити відсутні як недоступні", імпорт з файлу, gzip.
  - [x] 12.1 Редактор маппінгу XML (форма + JSON, версіонування, парсер читає активний маппінг з БД, посилання зі сторінки постачальника).
  - [ ] 12.2 Позначати відсутні external_id як `available=false` після імпорту.
  - [ ] 12.3 Імпорт з локального файлу (upload у storage → тригер).
  - [ ] 12.4 Підтримка gzip / стиснених фідів.

### Зроблено в кроці 11

- `src/test/xml-import-cache.test.ts` — 8 кейсів на `handleImportRunFinish`:
  - non-terminal статус → no-op;
  - `run == null` → no-op;
  - `error === "not-modified"` → no-op;
  - нульові лічильники created/updated/failed → no-op;
  - термінальний run зі змінами → викликає suppress + очищення `ProductCacheManager` + `PersistentCacheService.invalidateShops/Suppliers/AuthMe` + `ShopCountsService.invalidate`;
  - ідемпотентність (повторний виклик з тим самим `run.id + status` не дублює інвалідацію);
  - `failed`-run із частковими записами → інвалідує;
  - відсутній `userId` → fallback `"current"`.
- Всі 8 тестів проходять (`vitest run src/test/xml-import-cache.test.ts`).
- E2E-сценарій (Playwright: створити постачальника з XML → натиснути "Імпортувати зараз" → дочекатись `succeeded` → перевірити оновлення товарів) винесено в бэклог: потребує підключеного Inngest середовища й стабільного тестового XML-фіда — доцільніше зробити разом із CI-інтеграцією.

### Зроблено в кроці 1

- Підключено конектор `inngest` → з'явились `INNGEST_API_KEY`, `INNGEST_SIGNING_KEY` (плюс `LOVABLE_API_KEY` уже є).
- Створено `supabase/functions/inngest/index.ts` з клієнтом `id: "marketgrow"` і порожнім масивом `functions`.
- У `supabase/config.toml` додано `[functions.inngest] verify_jwt = false` (підпис перевіряє SDK через `INNGEST_SIGNING_KEY`).
- Після деплою URL ендпоінта: `https://ehznqzaumsnjkrntaiox.supabase.co/functions/v1/inngest` — потрібно один раз зробити Sync у Inngest Dashboard, щоб платформа підхопила застосунок (поки що без функцій).

### Зроблено в кроці 8

- Додано `supplierImportScheduler` (`*/15 * * * *`) у `supabase/functions/inngest/index.ts`:
  - `scan-suppliers` — вибирає `user_suppliers`, де `import_enabled = true` та `import_frequency_hours > 0`, фільтрує тих, у кого `last_import_at` відсутній або минуло достатньо часу.
  - `queue-imports` — для кожного постачальника створює `supplier_import_runs` у статусі `queued` (з guard від дублікатів) і відправляє подію `supplier/import.requested` через `inngest.send` з idempotency `import:<supplier_id>:<minute>`.
- Додано `supplierImportCleanup` (`0 3 * * *`) у `supabase/functions/inngest/index.ts`:
  - `cleanup-items` — видаляє рядки `supplier_import_items` старші 7 діб.
  - `cleanup-runs` — видаляє рядки `supplier_import_runs` старші 90 діб.
- Обидві функції зареєстровані в `serve({ functions: [supplierImport, supplierImportScheduler, supplierImportCleanup] })`.

### Зроблено в кроці 9

- Проаудитовано `src/i18n/dictionaries/suppliers.ts` — всі ключі, задіяні на кроках 6–8 (форма постачальника, сторінка `/user/xml-imports`, деталі run), уже мають переклади UK/EN:
  - Секція форми `xml_import_*` (17 ключів: section/enabled/frequency×4/run_now/no_url/queued/failed_start/last_run/never/status×5/stats).
  - Сторінка списку/деталей `xml_imports_*` (24 ключі: title/description/empty/колонки таблиці/статистика/помилки/пагінація).
  - Меню: `menu_xml_imports` + мапінги в `MenuItemWithIcon` та `MenuSection`.
- Додаткових перекладів на цьому кроці не потрібно; повернемось до словника, якщо в кроці 10 з'являться нові рядки (toasts інвалідації).

### Зроблено в кроці 10

- Додано хелпер `src/lib/xml-import-cache.ts` → `handleImportRunFinish(queryClient, userId, run)`:
  - Реагує лише на термінальні статуси (`succeeded`/`failed`/`cancelled`), ідемпотентний по `run.id + status` (in-memory `handledRuns` мапа).
  - Пропускає no-op прогон (`error === "not-modified"` або нульові лічильники created/updated/failed).
  - Викликає `ShopCountsService.suppressAllRealtimeForUser(uid, 3000)`.
  - Чистить `ProductCacheManager.clearAllProductsCaches()`, `PersistentCacheService.invalidateShops/Suppliers/AuthMe`.
  - Інвалідує react-query: `["auth","me"]`, `["user", uid, "shops"|"suppliers"|"dashboard-stats"]`, будь-які ключі, що містять `"products"`.
  - Викликає `ShopCountsService.invalidate(...)` (broadcast між вкладками).
- Розширено `src/lib/shop-counts.ts`: `suppressAllRealtimeForUser(userId, ms)` + `isRealtimeSuppressedForUser(userId)` (мапа `userId → expiresAt`).
- Реалтайм-хендлери тепер пропускають події під час вікна suppress:
  - `src/hooks/useProductsRealtime.ts` — `schedule()` виходить, якщо suppress активний.
  - `src/hooks/useShopRealtimeSync.ts` — усі три хендлери (`INSERT`/`DELETE`/`UPDATE` `store_product_links`) — early return.
- Підписки `supplier_import_runs` тепер викликають `handleImportRunFinish`:
  - `src/components/user/suppliers/SupplierForm.tsx` (канал `supplier-runs-<id>`).
  - `src/pages/user/XmlImports.tsx` (канал `xml-imports-list-<uid>`).