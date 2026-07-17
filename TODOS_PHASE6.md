# Phase 6 — Customer System + QR Code

- [x] Review tenant isolation, loyalty card system, auth patterns, frontend dashboard patterns

## Backend
- [ ] Add migration to align customers schema (first_name, last_name, phone, email nullable, qr_code unique)
- [ ] Add migration for customer_loyalties table
- [ ] Add migration for business slug (minimal support for public pages/register)
- [ ] Add CustomerLoyalty model
- [ ] Update Customer model relations/fillable
- [ ] Update LoyaltyCard model relations
- [ ] Update Business model relations/fillable (slug support)
- [ ] Add customer request validations (manual + public register)
- [ ] Add business customer controller (list/search/show/manual create/delete)
- [ ] Add public customer controller (public business view, register, wallet by qr)
- [ ] Add QR generator helper/service
- [ ] Register new API routes (authenticated + public)

## Frontend
- [ ] Add public business page `/{business_slug}`
- [ ] Add customer wallet page `/customer/{qr_code}`
- [ ] Add reusable loyalty/public components
- [ ] Add API client helpers/types for Phase 6 endpoints
- [ ] Add loading states, error handling, validation

## Tests & Verification
- [ ] Add backend feature tests for Phase 6 endpoints and tenant isolation
- [ ] Run frontend build
- [ ] Run backend tests (if DB available)
- [ ] Provide changed-files summary + verification report
