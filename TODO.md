# Customer App Production Completion TODO

## In Progress Plan (Approved)

- [x] Backend customer route architecture fixed (`/api/user/*`)
- [x] Backend customer API feature tests added
- [x] Backend test suite passing

## Frontend core already done

- [x] `/user/login`
- [x] `/user/register`
- [x] `/user/dashboard`
- [x] `/user/cards`
- [x] `/user/rewards`
- [x] `/user/activity`
- [x] customer auth provider + guard
- [x] customer layout with bottom navigation
- [x] loyalty card carousel base version

## Remaining implementation

- [ ] Implement `/user/profile`
- [ ] Implement `/user/settings`
- [ ] Implement `/user/notifications`
- [ ] Add editable profile fields (name/email/phone/avatar)
- [ ] Add change password flow
- [ ] Add notification preferences persistence (customer profile preferences)
- [ ] Add dark mode toggle in customer UX
- [ ] Add logout confirmation interaction
- [ ] Add multi-business switcher behavior
- [ ] Improve loyalty card animation polish
- [ ] Add pull-to-refresh utility and integrate on user pages
- [ ] Add reusable skeleton states
- [ ] Add reusable empty/error states
- [ ] Ensure QR card quick access from layout
- [ ] Keep Google Wallet placeholder ready for future integration
- [ ] Improve accessibility (labels/aria/focus keyboard flows)

## Final validation

- [ ] Run backend tests: `cd backend && php artisan test`
- [ ] Run frontend lint: `cd frontend && npm run lint`
- [ ] Run frontend build: `cd frontend && npm run build`
- [ ] Verify full flow:
  - [ ] Register
  - [ ] Login
  - [ ] Dashboard
  - [ ] Cards
  - [ ] Rewards
  - [ ] Activity
  - [ ] Profile
  - [ ] Settings
  - [ ] Notifications
  - [ ] Logout
