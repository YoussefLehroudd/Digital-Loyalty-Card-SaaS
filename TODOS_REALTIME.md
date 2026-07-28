# Realtime Loyalty System - Implementation Checklist

## 1. Investigation (completed / in progress)
- [x] Confirm existing endpoints for realtime sources:
  - [x] Stamp add/redeem: `backend/app/Http/Controllers/StampController.php`
  - [x] Join by QR: `POST /api/user/join-by-qr` → `backend/app/Http/Controllers/CustomerAuthController.php::joinByQr`
  - [x] Delete card: `DELETE /api/user/cards/{membershipId}` → `backend/app/Http/Controllers/CustomerDashboardController.php::deleteCard`
- [x] Confirm current realtime stack is missing:
  - [x] `backend/config/` has no broadcasting/reverb/echo configs
  - [x] `backend/composer.json` has no broadcasting/reverb packages
  - [x] `frontend/package.json` has no Echo/Pusher packages

## 2. Backend: Broadcasting setup
- [ ] Install Laravel Reverb + broadcasting dependencies (composer)
- [ ] Add broadcasting config files if missing (broadcasting.php, reverb.php, etc.)
- [ ] Add/verify BroadcastServiceProvider (Laravel 11/12 compatible)
- [ ] Create `routes/channels.php` with channel authorization rules:
  - [ ] business_* channel
  - [ ] customer_* channel (per business+customer)
- [ ] Configure env keys for Reverb/Pusher:
  - [ ] `BROADCAST_CONNECTION`, `REVERB_*` (or equivalent)
  - [ ] document required `.env` values

## 3. Backend: Events
- [ ] Create event classes (implement ShouldBroadcast):
  - [ ] StampAdded
  - [ ] RewardRedeemed
  - [ ] MembershipCreated
  - [ ] MembershipDeleted
  - [ ] MembershipUpdated
  - [ ] BusinessCardUpdated
  - [ ] BusinessBrandUpdated
- [ ] Decide broadcast payload shape to match frontend state updates:
  - [ ] stamp/current_stamps/required_stamps/progress_percent
  - [ ] reward status (unlocked/redeemed + description)
  - [ ] membership list/card list deltas
- [ ] Dispatch events AFTER successful DB commit in:
  - [ ] `StampController@store`
  - [ ] `StampController@redeemReward`
  - [ ] `CustomerAuthController@joinByQr`
  - [ ] `CustomerDashboardController@deleteCard`
  - [ ] business controllers for logo/hero/colors/reward/card design

## 4. Frontend: Echo client + subscriptions
- [ ] Add dependencies:
  - [ ] `laravel-echo`
  - [ ] `pusher-js` (or Reverb-compatible WS client)
- [ ] Add a single websocket connection provider (client component):
  - [ ] token handling (auth headers / private channels)
  - [ ] reconnect strategy
  - [ ] connection status toast (non-blocking)
- [ ] Add subscriptions for:
  - [ ] `user/cards` page (cards list + selected card live)
  - [ ] rewards page
  - [ ] activity page
  - [ ] business preview/dashboard pages
- [ ] Update React state immediately on event receipt (no reload required):
  - [ ] patch local state (cards, stamp counters, progress bar, rewards)
  - [ ] fallback refetch only when websocket is disconnected/unavailable

## 5. Testing & verification (thorough)
- [ ] QR scan → stamps/progress update instantly
- [ ] Reward redemption → reward state updates instantly
- [ ] Add/Delete card → immediate UI updates
- [ ] Business edits → user card design updates instantly
- [ ] User dashboard, My Cards, Rewards, Activity
- [ ] Business dashboard and preview
- [ ] Multi-tab synchronization
- [ ] Websocket disconnect/reconnect resynchronization
- [ ] Backend failure handling (UI toasts, no break)

## Notes
- No polling except as a fallback when websocket is disconnected.
- No manual refresh or full page reload for realtime updates.
