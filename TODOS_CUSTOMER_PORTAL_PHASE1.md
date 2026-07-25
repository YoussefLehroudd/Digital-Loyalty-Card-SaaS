# Customer Portal — Phase 1 plan (token-based portal)

## Backend (Laravel)
1. Add DB + models for customer portal access tokens
   - Migration: `customer_portal_tokens`
   - Fields: `id`, `customer_id`, `business_id`, `token_hash`, `enabled`, `revoked_at`, timestamps
   - Model + relationships to `Customer`, `Business`, `CustomerLoyalty`, `LoyaltyCard`

2. Add middleware/guard to authenticate portal token
   - Middleware reads bearer token or query/header token (for Phase 1: use `Authorization: Bearer <token>` from frontend)
   - Verifies token_hash matches and enabled/not revoked
   - Attaches authenticated “portal customer scope” (customer + business)

3. Add API routes under `api.php`
   - `GET /api/customer/portal` (profile + membership status + totals)
   - `GET /api/customer/portal/cards` (Phase 1: single card for current schema)
   - `GET /api/customer/portal/cards/{id}` (card details + QR + barcode optional)
   - `GET /api/customer/portal/rewards`
   - `GET /api/customer/portal/activity`
   - `PATCH /api/customer/portal/profile` (name/phone/email/birthday/preferences)

4. Add controllers/serializers
   - Reuse existing logic from:
     - `PublicCustomerController::wallet()` for business/customer/loyalty card
     - `StampController` computations for stamps/reward unlocked logic
     - `BusinessCustomerController` aggregation patterns (visits + reward status + history)

5. Add authorization checks (policy-like, in middleware/controller)
   - Prevent access to other customers’ data by scoping everything by token’s `customer_id` and `business_id`

6. Google Wallet scaffolding (Phase 1: structure only)
   - Endpoint `GET /api/customer/portal/cards/{id}/google-wallet`
   - Returns pass URL placeholder (or real generation later)

## Frontend (Next.js)
1. Add route: `frontend/src/app/card/[token]/page.tsx`
2. Add API client functions in `frontend/src/lib/customerPortal.ts`
3. Add customer portal UI components (mobile-first, bottom nav)
   - Header (customer name + status)
   - Loyalty card card with QR + “Add to Google Wallet” button (hook to placeholder endpoint)
   - Rewards section
   - Activity section
   - Profile section
4. Build dashboard page `frontend/src/app/card/[token]/page.tsx`
   - Fetch `/api/customer/portal` + `/api/customer/portal/cards` + `/api/customer/portal/rewards` + `/api/customer/portal/activity`
   - Use token from route param to call API with `Authorization: Bearer <token>`

## Phase 1 QA
1. curl test for API authentication
2. Manual smoke test in browser:
   - `/card/{validToken}` renders dashboard
   - `/card/{invalidToken}` shows “access disabled/invalid”
3. Verify QR scan flow still works for business owner stamping (existing endpoints unchanged)

## Phase 2 (multi-business/cards)
- Adjust schema to allow multiple cards per customer identity
- Add switching UI and token-to-identity mapping
- Update queries + controllers accordingly
