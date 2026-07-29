# Realtime updates (Laravel Reverb) - Implementation checklist

## Backend
- [ ] Make all realtime events broadcast on **private channels**:
  - [ ] StampAdded -> private customer.{customerId} + business.{businessId}
  - [ ] RewardRedeemed -> private customer.{customerId} + business.{businessId}
  - [ ] MembershipCreated -> private customer.{customerId} + business.{businessId}
  - [ ] MembershipDeleted -> private customer.{customerId} + business.{businessId}
  - [ ] BusinessBrandUpdated -> private business.{businessId}
  - [ ] BusinessCardUpdated -> private business.{businessId}
- [ ] Ensure events are **queued** (websocket send via queue worker):
  - [ ] Update all above events to implement `ShouldQueue` (and optionally `$broadcastQueue`)
- [ ] Verify each action dispatches the correct event:
  - [ ] QR scan -> StampAdded (in StampController@store)
  - [ ] Reward redemption -> RewardRedeemed (in StampController@redeemReward)
  - [ ] Loyalty card join -> MembershipCreated (in CustomerMembershipService@registerForBusiness)
  - [ ] Loyalty card delete -> MembershipDeleted (in BusinessCustomerController@destroy)
  - [ ] Business profile update -> BusinessBrandUpdated (in BusinessProfileController)
  - [ ] Business card settings update -> BusinessCardUpdated (in LoyaltyCardController)
- [ ] Railway readiness:
  - [ ] Ensure `BROADCAST_DRIVER=reverb`
  - [ ] Ensure `REVERB_*` env vars are set
  - [ ] Ensure queue worker runs in deployment

## Frontend
- [ ] Remove `setInterval` polling from `PublicCustomerWalletPage`
- [ ] Subscribe to private channel(s) for:
  - [ ] StampAdded -> update stamps/progress/rewardUnlocked immediately
  - [ ] RewardRedeemed -> update redeemed state immediately
  - [ ] MembershipDeleted (or missing wallet) -> clear/mark wallet unavailable immediately
- [ ] Add BusinessDashboard realtime:
  - [ ] Subscribe to private business.{businessId}
  - [ ] Patch metrics and customer/reward-related UI instantly on events
- [ ] Connection loss handling:
  - [ ] Expose reconnection state in UI (optional)
  - [ ] Ensure Echo reconnect works automatically (no refresh)

## Testing (critical path first)
- [ ] Local: customer wallet realtime on QR scan
- [ ] Local: customer wallet realtime on reward redemption
- [ ] Local: membership created/deleted affects wallet list/availability
- [ ] Local: business dashboard updates on stamps/rewards/memberships
- [ ] Railway: verify Reverb connectivity + private channel auth + queued broadcasting
- [ ] Railway: verify reconnect after websocket disconnect
