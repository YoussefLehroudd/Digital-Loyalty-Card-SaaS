# Affiliate partners and commission accounting

This feature runs on the application's existing Neon database and uses the existing business-owner subscription activation workflow. It **does not** create or transfer funds automatically.

## Access and referral attribution

- Super administrators open `/admin/affiliates` to create partners with a name, email, unique referral code and commission rates per supported paid plan.
- On creation, the server generates a strong one-time password and returns it only once to the administrator. The administrator must deliver this password privately alongside the `/affiliate` portal URL; the partner should change it after login.
- The sharing URL is `/register?ref=<code>` (use the production origin). A valid code defaults the registration form to **Business**.
- A verified new business is attributed once, when the six-digit email verification succeeds. Attribution is immutable and cannot be reassigned through login, URL re-use, session changes or renewals. Only new businesses count; regular customer loyalty-card registrations do not count.
- Pausing a partner stops new attributions, partner access, and future commissions while retaining all historical payouts and obligations.

## Commission policy

Default starting rates are **15% for one month, 18% for three months, 20% for six months, 22% for twelve months**. Each affiliate's rates are editable. These are example gross-receipt commissions, not net-profit margins. Before changing rates or adding new plans, evaluate payment-processing costs, tax and product margins.

A commission is recorded only when a platform admin confirms that an actual payment was received in `/admin/businesses` subscription activation:
- The exact *recorded amount paid*, in centimes, is the commission base. Free activations, trials and renewal requests without confirmed payment do not earn commissions.
- The commission rate for the selected duration is snapshotted at payment time, in basis points, and commission is rounded to the nearest centime.
- The record is attached uniquely to `subscription_event_id`; retries cannot create duplicate commissions.
- Original business attribution persists for subsequently recorded paid renewals, as long as the affiliate remains active.
- Historical commissions do not change when the admin edits an affiliate's percentage.
- Commission month is the *confirmed payment date* in `Africa/Casablanca`, not the entire subscription service period.

### Calculations using current plan prices

| Duration | Listed price | Starting rate | Commission | Platform share before expenses |
| --- | ---: | ---: | ---: | ---: |
| 1 month | 149.00 MAD | 15% | 22.35 MAD | 126.65 MAD |
| 3 months | 399.00 MAD | 18% | 71.82 MAD | 327.18 MAD |
| 6 months | 749.00 MAD | 20% | 149.80 MAD | 599.20 MAD |
| 12 months | 1299.00 MAD | 22% | 285.78 MAD | 1013.22 MAD |

The application currently sells 1, 3, 6 and 12 calendar-month plans. A separate 2-month plan is **not currently offered** and needs its own product price and subscription-schema integration before affiliates can earn commissions from it.

## Private partner dashboard

Partners sign in to `/affiliate` using their email/password. Their reports include earned total, unsettled balance, monthly earnings, attributed businesses, confirmed payment events (business, duration, actual payment amount, frozen rate, commission), and payment settlements. Partner authentication uses random bearer tokens stored as SHA-256 hashes server-side with expiry; partner data is always scoped to their session.

## Monthly settlement

The administrator filters an affiliate and records a bank transfer or other manually performed payout for a given Morocco month using its transfer reference. The server atomically attaches *all still-unpaid commission rows in that month* to a payout, computes the exact sum, and records the transfer metadata. The portal marks those entries paid. A retry cannot duplicate payouts. **The API records the fact of an external transfer; it never sends the transfer.**

For corrections, returns or refunds, build a negative adjustment / reversals workflow before operating at scale; this initial implementation assumes admin-confirmed received amounts remain final. Never mark a payout until the external transfer is confirmed.

## Smoke-test checklist (staging database)

1. Create affiliate in admin; securely copy its one-time password and sign in to the portal.
2. Visit the generated referral URL in a fresh browser; register a business and verify its email OTP.
3. Verify that the new business appears in the partner's attributed-business list with zero earnings.
4. Activate a 1-month subscription with a real *test* payment record of 149 MAD; verify one 22.35 MAD commission, not two, including retry with the same activation UUID.
5. Repeat with 3-, 6-, and 12-month durations; verify rate snapshots and actual-paid amount (which may differ from plan list price).
6. Edit affiliate rates: old commissions must not change, future paid activations must use the new rate.
7. Pause the affiliate: previous earnings persist; no new referrals or new commissions are created.
8. Record a settlement for the relevant month with a transaction reference only after verifying the external payment; verify unpaid decreases, paid detail appears once, and retry is safe.
9. Verify unauthorized partners cannot access `/api/admin/affiliates` or each other's `/api/affiliate/report`.
10. Run `npm run build` from `frontend` and check Next.js / Vercel logs before merging to production.

