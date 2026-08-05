# Notification System Implementation TODO

## Step 1 (Backend DB)
- [ ] Create migration + model for persistent in-app notifications (`system_notifications`)
- [ ] Ensure migration indexes support unread counts + pagination

## Step 2 (Notification infrastructure)
- [ ] Implement reusable notification infrastructure:
  - Laravel Notifications-based classes (DB + queued mail via Resend + broadcast payload)
  - queued delivery
  - error handling + logging
- [ ] Add broadcast event(s) for notifications (Reverb/Echo)

## Step 3 (Integrate into business flows)
- [ ] Reward Earned: wire into `StampController::store` where `RewardRedemption` becomes `earned`
- [ ] RewardRedeemed: wire into `StampController::redeemReward`
- [ ] MembershipDeleted: wire into membership deletion flow
- [ ] StampAdded: wire into `StampController::store`
- [ ] Loyalty card updates: wire into `LoyaltyCardController` updates
- [ ] Business updates: wire into relevant business controllers

## Step 4 (Notification APIs)
- [ ] Add API endpoints:
  - Customer center: list, unread count, mark read, mark all read
  - Business center
  - Admin center

## Step 5 (Frontend)
- [ ] Notification bell + unread badge (customer + business + admin)
- [ ] Notification center UI with pagination
- [ ] Realtime updates via Echo (persisted after refresh via API)
