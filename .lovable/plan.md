
# План: Система імпорту XML постачальників

Документ також буде збережено у репозиторії як `docs/xml-supplier-import-plan.md` для подальшої поетапної реалізації.

## 1. Цілі та принципи

- Імпорт працює у фоні, не блокує UI, не вантажить БД.
- Надійне виконання: ретраї, ідемпотентність, відновлення після збоїв.
- Інтеграція в існуючу модель `user_suppliers` / `store_products` без дублювання сутностей.
- Per-supplier розклад автооновлення (вимкнено / 6 / 12 / 24 год) + ручний запуск.
- Гнучкий маппінг XML → поля товару (різні постачальники мають різну структуру).

## 2. Стек і архітектура (короткo)

- **Inngest** (через Lovable-конектор) — durable jobs, steps, retries, concurrency, throttling, cron.
- **Supabase Edge Functions** — точки входу: запуск, сервінг Inngest-функцій, отримання статусу.
- **Supabase Postgres** — таблиці `supplier_import_runs`, `supplier_import_items`, `supplier_xml_mappings`; джерело даних — `user_suppliers.xml_feed_url`, цільова таблиця — `store_products` (+ `store_product_images`, `store_product_params`).
- **Realtime** — оновлення прогресу імпорту в UI без поллінгу.
- **Стрімінговий парсер XML** в edge-функції (saxes / fast-xml-parser у потоковому режимі) — не тримаємо весь файл у пам'яті.

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
                                ├─ step.run (паралельно з concurrency=2):
                                │     upsert батчу через RPC `supplier_import_upsert_batch`
                                └─ step.run: фіналізація, інвалідція кешів, realtime
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

Меню додається через існуючий `menu_items` / `user_menu_items` (як інші пункти).

## 4. Схема БД (нові таблиці)

Усі з RLS + GRANT-ами, прив'язка через `user_id` та `supplier_id`.

- `supplier_import_runs`
  - `id uuid pk`, `user_id uuid`, `supplier_id int fk user_suppliers`, `trigger text` (manual|scheduled), `status text` (queued|running|succeeded|failed|cancelled), `xml_url text`, `xml_etag text`, `xml_size_bytes bigint`, `total_rows int`, `processed_rows int`, `created_count int`, `updated_count int`, `skipped_count int`, `failed_count int`, `error text`, `started_at`, `finished_at`, `created_at`, `updated_at`.
- `supplier_import_items` (для звіту по помилках)
  - `id uuid pk`, `run_id uuid fk`, `external_id text`, `status text`, `error text`, `payload jsonb` (мін.), `created_at`.
  - Партиціонування за `created_at` помісячно або TTL-чистка cron-ом (7 днів зберігання за замовч.).
- `supplier_xml_mappings`
  - `id uuid pk`, `user_id uuid`, `supplier_id int fk`, `version int`, `is_active bool`, `xpath_item text` (напр. `/yml_catalog/shop/offers/offer`), `fields jsonb` (схема: `{external_id:'@id', name:'name', price:'price', ...}`), `images jsonb`, `params jsonb`, `category jsonb`, `currency text`, `created_at`, `updated_at`.
- Розширення `user_suppliers`:
  - `import_frequency_hours int default 0`, `import_enabled bool default false`, `last_import_at timestamptz`, `last_import_run_id uuid`, `xml_etag text`, `xml_last_modified text`.

ENABLE Realtime для `supplier_import_runs`.

## 5. Inngest-функції

- `supplier-import` (event `supplier/import.requested`):
  1. `step.run("acquire-lock")` — створити `supplier_import_runs` зі статусом `running`; якщо вже є активний run для supplier — вийти (idempotency key = `supplier_id`).
  2. `step.run("fetch-xml")` — `fetch` із `If-None-Match`/`If-Modified-Since`; якщо 304 — позначити `skipped`, фініш.
  3. `step.run("parse")` — стрімовий парсер, формує батчі по 500 нормалізованих рядків, кожен батч зберігається як `step.run("upsert-batch-N")` -> RPC.
  4. `step.run("finalize")` — оновити лічильники, `last_import_at`, інвалідація Redis-кешу товарів, відправити realtime подію.
  - `concurrency: { key: "event.data.supplier_id", limit: 1 }` — один імпорт на постачальника одночасно.
  - `throttle: { limit: 10, period: "1m", key: "event.data.user_id" }` — лімітуємо навантаження на користувача.
  - `retries: 3` із експоненційним бекофом для мережевих помилок.

- `supplier-import-scheduler` (Inngest cron `*/15 * * * *`):
  - SELECT постачальники, де `import_enabled` і `now() - last_import_at >= import_frequency_hours`.
  - Для кожного — `inngest.send("supplier/import.requested", { trigger: "scheduled" })`.

- `supplier-import-cleanup` (cron `0 3 * * *`):
  - DELETE `supplier_import_items` старші 7 днів; DELETE `supplier_import_runs` старші 90 днів.

## 6. Стратегія upsert у `store_products`

Ключ зіставлення: `(user_id, supplier_id, external_id)` — додати **unique index** для коректного `ON CONFLICT`.

Серверна RPC `supplier_import_upsert_batch(p_run_id uuid, p_rows jsonb)`:
- Усе в одній транзакції на батч (500 рядків).
- `INSERT ... ON CONFLICT (supplier_id, external_id) DO UPDATE SET price, price_old, price_promo, stock_quantity, available, currency_code, name, name_ua, description, vendor, article, updated_at` — оновлюються лише поля з фіда.
- Не чіпаємо `store_id`, `is_active`, кастомні поля користувача в `store_product_links`.
- Інкрементуємо лічильники `created_count` / `updated_count` через RETURNING.
- Помилкові рядки → `supplier_import_items` зі статусом `failed` (не валять весь батч — `SAVEPOINT` per row для проблемних).

Зображення та параметри — окремі дочірні `step.run` після основного upsert, теж батчами, через RPC `supplier_import_upsert_images` / `..._params` (теж by `(product_id, url)` / `(product_id, name)`).

Товари, які зникли з фіда: **не видаляємо** автоматично (обрано "За (supplier_id, external_id)"). Залишаємо як є; користувач може окремо запустити "позначити відсутні як недоступні" пізніше.

## 7. Безпека та продуктивність

- RLS на нових таблицях: `auth.uid() = user_id`. GRANT-и: `authenticated` SELECT, service_role ALL. Edge-функції пишуть через service role.
- Inngest signing key + `verify_jwt = true` на `supplier-import-start`, `verify_jwt = false` на серв-ендпоінті Inngest (підпис перевіряє SDK).
- XML тільки з `https://`, валідація URL, ліміт розміру (наприклад 100 МБ), таймаут 60с на fetch.
- Розмір батча 500 + concurrency 1 per supplier ⇒ постійне навантаження на БД низьке.
- Кеш товарів інвалідуємо одним викликом наприкінці run, не на кожному батчі.

## 8. Маппінг XML (для різних постачальників)

- За замовчуванням — пресет YML/Rozetka (вже найпоширеніший в UA): `offers/offer`, `name`, `price`, `currencyId`, `picture`, `param`, `categoryId`.
- Якщо немає `supplier_xml_mappings`, перший імпорт виявляє формат за тегами і створює запис `version=1`.
- В UI постачальника — кнопка "Налаштувати маппінг" → редактор JSON-полів (на майбутнє, у v2).

## 9. Поетапні задачі (для подальшої реалізації)

Кожен крок — окрема ітерація, можна мерджити незалежно.

1. Підключити Inngest-конектор; перевірити secrets, додати `supabase/functions/inngest/index.ts` із порожнім сервером.
2. Міграція БД: нові таблиці + розширення `user_suppliers` + unique index `(supplier_id, external_id)` на `store_products` + RLS + GRANT-и + Realtime.
3. Edge function `supplier-import-start` (валідація, `inngest.send`) + клієнтський сервіс `XmlImportService`.
4. Inngest-функція `supplier-import` (fetch + парс + батчі + RPC upsert). Тільки YML-пресет.
5. RPC `supplier_import_upsert_batch` + RPC для images/params.
6. UI в `SupplierForm`: поля автоімпорту, кнопка "Імпортувати зараз", індикатор останнього run.
7. Сторінка `/user/xml-imports`: список runs + детальна сторінка з Realtime-прогресом і помилками.
8. Inngest cron `supplier-import-scheduler` + `supplier-import-cleanup`.
9. i18n: додати ключі в `src/i18n/dictionaries/suppliers.ts` (UK/EN). Без хардкодів.
10. Інвалідація кешів `ProductService`/`PersistentCacheService` + realtime suppress 2-3с після фінішу (за core-правилом проєкту).
11. Тести: unit для маппера, edge-функції; e2e (Playwright) — запуск імпорту, поява в таблиці.
12. v2 (опційно): редактор маппінгу, "позначити відсутні як недоступні", імпорт з файлу (upload), підтримка gzip.

## 10. Технічні деталі (для розробника)

- Парсер: `saxes` (npm) — стрімінг, працює в Deno через `npm:` спецификатор.
- Inngest: `npm:inngest@^3`, серв через `inngest/deno`. Події надсилаються через connector gateway за існуючими інструкціями.
- Idempotency: `inngest.send({ id: "import:" + supplier_id + ":" + iso_minute, ... })` запобігає дублюючим запускам у короткому вікні.
- Concurrency keys: `event.data.supplier_id` (1) і `event.data.user_id` (3) — не більше 3 паралельних імпортів на користувача.
- Realtime канал: `supplier_import_runs:user_id=<uid>` — UI підписується через `useEffect` із cleanup (за існуючою інструкцією проєкту).

## 11. Що НЕ робимо в v1

- Не видаляємо товари, відсутні в фіді.
- Не редагуємо маппінг через UI (тільки авто-детект YML).
- Не імпортуємо з файлу (тільки URL).
- Не робимо diff-перегляд перед застосуванням.
