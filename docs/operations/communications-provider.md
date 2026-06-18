# Communications Provider

EduOps sends WhatsApp messages through Meta WhatsApp Cloud API. There is no
console or simulated-success provider.

## Required environment variables

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION` (optional; defaults to `v25.0`)

The webhook URL is:

`https://<app-host>/api/communications/webhook`

Configure Meta to send message status webhooks to this URL. The GET challenge
uses `WHATSAPP_VERIFY_TOKEN`; POST requests require a valid
`x-hub-signature-256` generated with `WHATSAPP_APP_SECRET`.

## Delivery semantics

- `QUEUED`: Meta accepted the API request and returned a provider message ID.
- `SENT`, `DELIVERED`, `READ`: set only by signed provider webhooks.
- `FAILED`: the provider request failed or a signed failure webhook arrived.

Apply `prisma/migrations/phase10_communications_delivery.sql` before enabling
the provider or webhook in staging.
