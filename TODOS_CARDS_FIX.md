# Loyalty Cards Fix - Progress Tracker

- [x] Update `LoyaltyCardVisual` to optionally show raw QR payload text under the QR (monospace) for customer cards only.
- [x] Update `CustomerCardCarousel` to:
  - [x] Pass `showQrPayloadText={true}` to `LoyaltyCardVisual`
  - [x] Render nav badge as exactly `Card X of Y`
  - [x] Sync carousel index when `selectedId` changes
- [x] Update `UserCardsPage` to add `+ Add Loyalty Card` button above the cards list, navigating to `/user/join`.
