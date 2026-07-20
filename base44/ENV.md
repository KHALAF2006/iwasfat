# Backend Environment Variables

All variables are configured in the Base44 dashboard (function environment
variables / app secrets). Nothing secret belongs in the repo.

## Required for Stripe billing

| Variable | Used by | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | createCheckoutSession, createPortalSession, stripeWebhook | `sk_live_...` / `sk_test_...` from Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | stripeWebhook | `whsec_...` from Stripe dashboard → Developers → Webhooks → the endpoint pointing at the `stripeWebhook` function URL |
| `APP_BASE_URL` | createCheckoutSession, createPortalSession | Public app URL used for Stripe success/cancel/return URLs, e.g. `https://iwasfat.base44.app` |

**Untested locally:** all Stripe calls require verification with the Stripe CLI
or dashboard, e.g. `stripe listen --forward-to <stripeWebhook URL>` then
`stripe trigger checkout.session.completed`. Webhook signature verification is
implemented with WebCrypto HMAC-SHA256 over `t.<rawBody>` — confirm it accepts
a real event and rejects a tampered one before going live.

## Required for Telegram

| Variable | Used by | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | telegramWebhook, sendDailyReminders | Token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | generateTelegramLink | Bot username without `@`, e.g. `iwasfat_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | telegramWebhook (optional but recommended) | Random string; pass it as `secret_token` when calling `setWebhook`. The function then requires the `X-Telegram-Bot-Api-Secret-Token` header. |

**Untested locally:** Telegram binding requires a real bot and a public
webhook URL (`setWebhook` pointing at the `telegramWebhook` function).

## Required for scheduled jobs

| Variable | Used by | Notes |
|---|---|---|
| `CRON_SECRET` | sendDailyReminders, sweepTrials | Random string. Scheduled callers must send header `x-cron-secret: <CRON_SECRET>`. Admin users can also invoke manually without the header. |

## Optional

| Variable | Used by | Notes |
|---|---|---|
| `ALLOWED_FILE_HOSTS` | analyzeFoodImage | Comma-separated host suffix allowlist for uploaded file URLs. Defaults to `.base44.app,.supabase.co`. **Verify the real upload host after a production UploadFile call and set this explicitly.** |

## Rate limiting design note

LLM functions (`estimateMealCalories`, `analyzeFoodImage`,
`generateShoppingList`) are limited to 20 calls/hour per user via the
`RateLimit` entity: one row per `action:email:YYYY-MM-DDTHH` key with a
counter. Known trade-offs (accepted as pragmatic protection):

- A burst exactly at an hour boundary can slightly exceed 20/hour.
- Concurrent calls can race the read-modify-write and both pass.

A stricter design would need atomic increments, which the entity API does not
provide.

## PDF export limitation

jsPDF's bundled fonts cannot shape Arabic script. `exportShoppingPDF` and
`exportSubscribersPDF` therefore generate **English exports** with Arabic text
transliterated to Latin script. The UI labels these as "English PDF export".
