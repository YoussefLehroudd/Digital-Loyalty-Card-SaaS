# Business subscriptions

Business owners may sign in and read their records after expiration. Workspace mutations are blocked by the API and the dashboard; subscription information, renewal requests, private proof viewing, recovery, contact and logout remain available. Suspension is independent of subscription expiration.

## Plans and dates

| Calendar months | Total plan price |
| --- | --- |
| 1 | 149 DH |
| 3 | 399 DH |
| 6 | 749 DH |
| 12 | 1,299 DH |

The admin subscription form defaults to **Renew / Extend**: append the selected calendar months to an unexpired trial or paid period. Expired periods restart at confirmation. **Start now / Replace** discards remaining time and starts immediately. Dates use calendar arithmetic in UTC; the interface displays Africa/Casablanca time. Original trial dates and immutable activation history remain preserved. Legacy API calls without a mode retain replace behavior.

## Payments and receipts

Administrators explicitly confirm that a payment was received and record the actual amount in integer centimes, method, date, reference and note. Plan price and received amount are separate. Recorded payments create a unique PDF receipt; historical or complimentary activations without actual payment records do not create receipts or count toward payments. The overview reports recorded payments in the current Morocco calendar month, paid subscriptions, periods ending within three days and pending requests.

Activation requires a current revision and unique request UUID. Identical retries return the existing result. Conflicting revisions, reused UUIDs or reviewed requests return 409. Subscription update, activation event, audit, request approval and renewal-email outbox are committed together.

## Renewal requests

Owners select a plan and submit a private JPG, PNG or WebP proof, maximum 2 MB, with an optional note and reference. One pending request per business is allowed. Submission never restores access. Proof retrieval requires the owning business or a platform administrator, uses no-store responses and is never included in listing payloads.

Admin > Businesses contains pending, approved and rejected renewal requests. Approval opens the subscription form for payment verification and extends the requested duration. Rejection requires a reason visible to the owner and permits a new request. The business directory supports trial, subscribed, ending-soon and expired filters.

## Notifications

A protected Vercel cron calls `/api/cron/subscription-reminders` daily at 08:00 UTC in production. `CRON_SECRET` must be configured. Daily scans enqueue one warning for each period within three days and one expiration message. The dashboard warning and red countdown update immediately without waiting for email. Successful admin activation also attempts its renewal email immediately; failed delivery remains queued.

`RESEND_API_KEY` and a verified sender are required by the existing email service. Jobs have unique business/kind/expiry keys, provider idempotency keys, stale-claim recovery and a maximum of six attempts. Obsolete or overdue upcoming-expiry reminders are skipped. Each scheduled run processes up to 40 jobs; larger installations should increase processing capacity or scheduling frequency according to their hosting plan.

The demonstration account's test expiration is independent of this rollout and is not reset by schema initialization or deployment.
