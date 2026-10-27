# Affiliate program

Administrators manage partners at `/admin/affiliates`. This section follows the existing English, French and Arabic language selector and supports mobile layouts.

## Operating the program

1. Select **Add affiliate**, enter the person's name, optional contact email and commission percentage. Choose a unique link code or leave it empty to generate one. Copy the resulting `/r/code` URL.
2. A new business follows the link and completes email verification. The business is permanently assigned to that partner.
3. Record and confirm the business's received subscription payment using the existing subscription screen. Commission accrues automatically in the same database transaction, including renewals. A free activation or a submitted payment proof does not earn commission.
4. Select a statement month to see received payments, commissions earned, payouts recorded and the unpaid balance through that month. Open a partner's statement for payment receipts, subscription durations, rates, amounts, referred businesses and payout history. **Export month CSV** downloads the selected month's commission ledger.
5. Transfer money to the partner outside the platform, then choose **Record payout**, enter its reference and actual date, and confirm the exact reviewed amount. This records the transfer; it does not send money.

## Accounting and attribution

- Rates are required and configurable per person from 0.01% to 100%, with two decimal places. Payment amounts use integer MAD centimes; commission rounds once per payment to the nearest centime. Each commission snapshots its rate, business name, payment amount and receipt.
- All existing subscription durations are supported (currently 1, 3, 6 and 12 months). Commission is based on the actual confirmed amount, including discounts, rather than an inferred plan price. A multi-month payment earns its full commission in the month paid; it is not distributed across the subscription term.
- Statement months follow `Africa/Casablanca`. Unpaid totals include unsettled commissions from earlier months. Historical views show today's settlement status for payments through the selected month, rather than an immutable closing balance.
- A server-issued opaque HttpOnly cookie attributes a visit for 30 days. First touch wins during that window. The browser cannot assign arbitrary affiliate IDs through registration fields. Attribution survives the email verification step. It applies to newly registered businesses, not existing accounts. Clearing cookies, another browser or expiration can prevent attribution.
- An optional partner email prevents the same email from referring its own business registration. This is not a comprehensive fraud-detection system.
- Pausing a partner stops new referrals. Previously attributed businesses continue earning on renewals. Rate changes affect future recorded payments; historical commissions remain unchanged. Link codes stay fixed so distributed URLs remain valid.
- A refunded or incorrectly recorded **unpaid** commission can be voided with a reason. This removes it from the balance while retaining history. It does not refund the business. Paid commissions and payout records remain immutable in this interface; resolving a refund after payout requires a separate manual reconciliation.

## Implementation and verification

The additive database migration creates partner, visit, referral, commission and payout tables. An insert trigger on confirmed `subscription_events` atomically creates each commission. A unique event constraint prevents duplicates. Payout recording locks the exact reviewed commission rows, validates their count and total, and stores an idempotency fingerprint. Administrator authorization applies to every management and export route. Partner creation, edits, voids and payouts are audited. CSV text is escaped against spreadsheet formulas.

Run `npm run test:affiliates` for integration checks using the actual API handlers and a local PostgreSQL instance provided by PGlite. The test covers authorization, attribution and verification, supported plans, renewals, rounding, rate snapshots, duplicate requests, competing payouts, voids, month boundaries, carried balances, CSV escaping and expired cookies. Test emails and data stay local. PGlite is a development dependency and is not used by production routes.

When changing the public domain, update `NEXT_PUBLIC_SITE_URL` and redirect the former domain's `/r/*` URLs so already distributed links remain usable.
