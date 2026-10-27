# LOYVANCE Smart Campaigns — delivery and safety

This system extends existing customer notifications and Customer Settings. It does **not** replace loyalty/reward events or the existing bell.

## Business-owner workflow
- Visit `/dashboard/campaigns` to create a draft with a title, plain-text body and target segment.
- Segments: all opted-in business members, members inactive 30+ days, members 1 stamp away from their reward, or members created in the last 7 days.
- The audience preview returns a **count**, never customer contact information.
- After sending, selecting a campaign shows **Notified customers**: the names of actual in-app recipients linked to this business, their delivery timestamp, read status and coarse email queue state. No email address or phone is exposed.
- Review eligible audience before **Send now**, or choose a scheduled date. Sending in-app notifications occurs immediately for manually sent campaigns; scheduled campaigns run on the Vercel daily processing job.
- The business owner can optionally select **In-app + Email**, review sent/viewed/email queue statistics, cancel scheduled campaigns, or delete drafts.
- Automation rules are **paused by default** and may be explicitly enabled with 7/14/30-day cadence. Up to five automations per business.
- Marketing automation never edits stamps or redeems rewards; it only creates campaign notifications and opt-in emails.

## Customer experience
- Existing Customer bell and Notifications page display campaign messages alongside stamp/reward events.
- Existing Settings → Notifications → **Promotions** preference is off by default; only explicit `promotions=true` customers are eligible. To receive promotional emails, **Email updates** must also be enabled.
- Emails have a one-click-link **confirmation page** to unsubscribe (GET only previews a form; POST changes Promotions to false). Essential account notifications remain unchanged.

## Authentication, tenancy and consent
- Only authenticated `business_owner` sessions can read/edit campaigns, using the backend-derived business ID. Cross-business reads/writes fail.
- Each recipient MUST be a platform customer login with a membership tied to this business; stale orphan emails and unrelated customer records never qualify.
- Consent is rechecked at audience preparation, in-app insertion, and before email send. No marketing is sent when the business subscription is expired or business is suspended.
- Never export audience email addresses to the Business UI. Contacts are resolved inside the server for the verified Resend sender only.
- Delivered-recipient names are only available after notification creation, behind authenticated business-owner, campaign ownership, matching membership-business and notification record checks. The listing cannot be used to discover an audience before sending.
- A maximum of **500 matched users per campaign**, **3 broadcasts per business per day**, and 8 draft creations per day. Delivery suppresses repeat promotional messages to a user from the same business within 7 days, and across all businesses within 48 hours.
- Email recipients, claim states and provider idempotency keys are stored in the DB; hourly/daily retries have a 15-minute claim expiry, at most 3 attempts. Unsubscribe tokens are random and stored hashed only. Do not put actual customer data in repository docs.
- No arbitrary HTML/links accepted as campaign message input; HTML content in emails is escaped.

## Schema / endpoints
Additive tables: `marketing_campaigns`, `marketing_campaign_recipients`, `marketing_automations`, `marketing_unsubscribe_tokens`. Uses existing `customer_notifications` and `customer_notification_reads`.

```text
GET    /api/campaigns/business
POST   /api/campaigns/business
GET    /api/campaigns/business/:id
GET    /api/campaigns/business/:id/audience
GET    /api/campaigns/business/:id/recipients  (delivered recipient names, no contact details)
POST   /api/campaigns/business/:id/send
POST   /api/campaigns/business/:id/schedule
POST   /api/campaigns/business/:id/cancel
DELETE /api/campaigns/business/:id

POST   /api/campaigns/automations
PATCH  /api/campaigns/automations/:id
DELETE /api/campaigns/automations/:id

GET    /api/campaigns/unsubscribe?token=...
POST   /api/campaigns/unsubscribe
GET    /api/cron/campaigns  (Bearer CRON_SECRET)
```

## Deployment / scheduling
- `frontend/vercel.json` schedules a **daily** cron at 08:15 UTC, separately from existing subscription reminders at 08:00 UTC.
- This is a *daily polling scheduler*, NOT exact-to-the-minute delivery. Scheduled campaigns will run on or after their requested time during the next daily cron. Email queue sends a paced batch (35 each daily execution); pending email counts remain visible on Analytics. For high-volume/precise scheduling, deploy an external queue/worker or Vercel plan with a more frequent cron after evaluating deliverability and cost.
- Needs `CRON_SECRET`, `RESEND_API_KEY`, and a verified sender configured via `RESEND_FROM_EMAIL` or platform's existing fallback `LOYVANCE <hello@youssefhrd.com>`. Verify the sending domain with Resend before allowing real customer emails.
- The provider API must be configured for transactional-style marketing emails with unsubscribe, deliverability monitoring and your applicable marketing consent rules. Resend is not guaranteed to deliver all requests.
- Visits within 7 days after notification are shown as *observed activity*; they do not establish that the campaign caused a visit.

## Pre-production checklist (required)
1. Back up the Neon database. Use a **staging** DB, not production, for writing test customers/campaigns.
2. Create separate business owner A and B and three test customers with linked memberships; verify that A never sees/sends to B's members.
3. Explicitly enable Promotions only on one test customer. Assert disabled customer receives **no** in-app or email campaign.
4. Test one-stamp-away and inactive segment SQL against controlled cards/visits. Verify the 7-day and 48-hour caps, dedupe, and retries.
5. Use a test Resend sender/inbox. Check unsubscribe GET does not change consent; confirm POST prevents future sends.
6. Schedule a test campaign (next daily window), cancel another, enable/disable automation, inspect analytics and email failures.
7. Verify expired/suspended business cannot create/send, and that email queue rechecks status and consent.
8. Test mobile dashboard, history, Customer notification bell, translated UI labels, and Vercel build.

Important: A successful compile does **not** substitute for a database integration test or verified Resend delivery.
