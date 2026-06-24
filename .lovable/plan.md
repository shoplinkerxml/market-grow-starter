# Крок 1 з плану імпорту XML: підключення Inngest

## Що робимо в цьому кроці

Це найперший пункт із розділу "9. Поетапні задачі" в `docs/xml-supplier-import-plan.md`:

> 1. Підключити Inngest-конектор; додати `supabase/functions/inngest/index.ts` із порожнім сервером.

Окремо: я додам у файл `docs/xml-supplier-import-plan.md` секцію-чеклист "Прогрес виконання" (12 пунктів з v1 + v2), щоб відмічати ✅ після кожного завершеного кроку і не загубити стан між сесіями. І відкрию цей файл, щоб ви бачили його вміст.

## Дії

1. **Підключити конектор Inngest** через `standard_connectors--connect` (connector_id: `inngest`). Після підключення в проєкті стануть доступні `LOVABLE_API_KEY`, `INNGEST_API_KEY`, `INNGEST_SIGNING_KEY` — інших секретів не потрібно.
2. **Створити edge-функцію `supabase/functions/inngest/index.ts`** — порожній сервер на `inngest/deno`:
   - Клієнт `new Inngest({ id: "marketgrow" })`.
   - `serve({ client, functions: [] })` як default export.
   - `verify_jwt = false` у `supabase/config.toml` для цієї функції (підпис перевіряє SDK через `INNGEST_SIGNING_KEY`).
3. **Деплой** цієї функції через `supabase--deploy_edge_functions(["inngest"])`.
4. **Оновити `docs/xml-supplier-import-plan.md`** — додати в кінці секцію "## 12. Прогрес виконання" з чеклистом усіх 12 кроків і відмітити крок 1 як ✅ після успішного деплою.
5. Дати посилання на edge-функцію в дашборді Supabase, щоб ви могли зробити Sync у Inngest dashboard (один раз).

## Що НЕ робимо в цьому кроці

- Не створюємо таблиці БД (це крок 2).
- Не пишемо саму функцію імпорту (крок 4).
- Не змінюємо UI.

## Файли

- new: `supabase/functions/inngest/index.ts`
- edit: `supabase/config.toml` (додати `[functions.inngest] verify_jwt = false`)
- edit: `docs/xml-supplier-import-plan.md` (додати секцію "Прогрес виконання")

Підтвердьте — і я виконаю.
