# `prismaAdmin` Allowlist

`prismaAdmin` bypasses RLS. New usages require security review, explicit
resource scoping, and a misuse test.

## Approved Foundations

| Path | Purpose | Required scope |
|---|---|---|
| `lib/api/auth.ts`, `lib/tenant/current.ts`, `lib/auth/session.ts` | Resolve the authenticated user's active membership before RLS claims exist. | Supabase user ID, active membership, selected institution ID. |
| `lib/audit/server.ts` | Append audit records even after the user transaction fails. | Actor, institution, fixed action, minimized metadata. |
| `lib/security/rate-limit.ts` | Update opaque hashed abuse-control buckets. | Hashed subject only; no PII stored. |
| `lib/prisma/admin.ts` | Lazy privileged client factory. | Server-only import. |

## Approved Trusted Flows

| Path/group | Purpose | Preconditions and scope |
|---|---|---|
| `app/api/onboarding/route.ts` | Bootstrap first institution and owner membership. | Authenticated user; transaction creates only the new institution/membership. |
| `app/api/invitations/accept/route.ts` | Accept a bearer invitation before membership exists. | Authenticated matching email; random token; expiry; atomic single use; invitation institution only. |
| `app/api/push/send/route.ts` | Internal administrative push delivery. | Mandatory internal token; explicit institution and member recipients; rate limit. |
| `app/api/push/subscribe/route.ts` | Store the authenticated user's browser subscription. | Authenticated user; endpoint belongs to that user. |
| `app/api/communications/webhook/route.ts` | Apply Meta WhatsApp delivery receipts without a user session. | Valid `x-hub-signature-256`; provider message ID lookup only; monotonic status updates; no message body logging. |
| `app/api/staff/*` | Auth administration and membership maintenance. | Owner/admin; target membership in current institution; no owner escalation by admins. |
| `app/p/[token]/*` | Private parent bearer portal. | Valid student token; every related query scoped to that student/institution/class. |
| `app/parent/page.tsx`, `lib/parent/children.ts` | Verified parent portal. | Verified guardian phone/session; returned children derived from guardian links. |
| `lib/tenant/academic-year.ts`, `app/api/academic-years/*` | Academic-year bootstrap and audit support. | Authenticated owner/admin and explicit institution ID. Normal CRUD should prefer RLS. |

## Deferred Payment Usages

- `app/api/fees/invoices/[id]/receipt/route.ts`
- `app/api/razorpay/webhook/route.ts`

These remain open under `PAY-001` through `PAY-004`. They are not approved as
production-ready by this document.

## Review Requirements

1. Explain why `withRls` cannot support the flow.
2. Authenticate the caller or verify the external signature.
3. Check role and active membership.
4. Scope by institution and resource ID in the same query.
5. Avoid returning privileged records wholesale.
6. Add negative cross-tenant and wrong-role tests.
