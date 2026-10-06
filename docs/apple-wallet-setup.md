# Apple Wallet activation

The implementation is deployed but disabled until a paid Apple Developer membership and production certificates are available.

## Vercel environment variables

Set these as **server-only** production environment variables. Never use a NEXT_PUBLIC prefix or commit certificate/private-key contents.

| Variable | Value |
| --- | --- |
| APPLE_WALLET_ENABLED | Set to true only when the following credentials are ready |
| APPLE_WALLET_PASS_TYPE_ID | Pass Type ID, for example pass.com.loyvance.loyalty |
| APPLE_WALLET_TEAM_ID | Apple Developer Team ID |
| APPLE_WALLET_SIGNER_CERT | Pass Type ID signing certificate in PEM format |
| APPLE_WALLET_SIGNER_KEY | Corresponding private key in PEM format |
| APPLE_WALLET_WWDR_CERT | Matching Apple Worldwide Developer Relations intermediate certificate in PEM format |
| APPLE_WALLET_KEY_PASSPHRASE | Optional, if the private key is encrypted |
| APPLE_WALLET_BASE_URL | Public HTTPS origin; defaults to https://digital-loyalty-card-saa-s.vercel.app |

Multiline PEM values and values containing literal backslash-n line separators are supported. The signer certificate must match the Pass Type ID, Team ID, private key, and WWDR intermediate; expired or mismatched credentials keep the feature unavailable.

1. Enroll in Apple Developer Program and create a Pass Type ID.
2. Generate a private key and CSR, request its Pass Type ID certificate, and download the correct Apple WWDR intermediate.
3. Convert downloaded DER certificates to PEM if needed. Keep the private key and encrypted backups secure.
4. Set the variables above in Vercel and redeploy.
5. Open My Cards. The Coming soon label changes to the active Add to Apple Wallet action.
6. Add a pass on a real iPhone. On desktop/Android the button shows a private download QR; on iPhone/iPad/Mac it opens the signed pass directly.
7. Scan at the business: confirm the Wallet balance increases, the reward unlocks at the threshold, and redemption resets progress. Confirm the customer notification flow continues to work.

## Implemented flow

- Authenticated GET /api/user/wallet/apple/status exposes only availability.
- Authenticated POST /api/user/wallet/apple/{membershipId} checks ownership and issues an unguessable download link valid for 15 minutes.
- GET /api/apple-wallet/download/{ticket} returns application/vnd.apple.pkpass. Download tickets are hashed in the database; stable pass authentication tokens are not placed in download URLs.
- Passes contain the business identity, member name, reward, balance, status, current membership QR, and the update service URL.
- Apple update service implements registration, unregistration, changed serial numbers, authenticated pass retrieval, and diagnostic acknowledgement under /api/apple-wallet/v1.
- Registration and pass retrieval require ApplePass authorization. The device library identifier scopes changed-pass requests as required by Apple's protocol.
- Update tags use a PostgreSQL sequence, so multiple changes within a second remain distinct. Pass retrieval always returns current data rather than relying on second-resolution If-Modified-Since.
- Stamp, redemption, business/card changes and customer profile updates advance the pass tag and schedule APNs refresh pushes using the same pass signing certificate. Invalid push tokens are removed.
- Certificate, private key and pass authorization tokens stay on the server.

## Validation before activation

Development checks verified ownership, disabled/invalid-credential handling, stable pass credentials, ticket expiration, device registration and unregistration, changed-pass tags, and stamp/unlock/redemption changes using PostgreSQL-compatible PGlite.

Four generated .pkpass files were unpacked and their manifests and detached CMS signatures independently verified with OpenSSL using test certificates. APNs request construction was tested with a mock HTTP/2 connection.

**Pending until subscription:** real Apple-issued signing certificates, addition of the pass on iPhone, and actual APNs delivery. The simulator can test pass layout but does not register for push updates. Signing certificate renewal requires replacing the PEM values and redeploying, while preserving the same Pass Type ID and Team ID.

## References and artwork

- https://developer.apple.com/wallet/get-started/
- https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates
- https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html
- https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
- https://github.com/alexandercerutti/passkit-generator

The Apple-provided Illustrator badge artwork is retained unchanged in public/images/add-to-apple-wallet.svg (distribution copy: https://ecom.assets.acimacredit.com/add-to-apple-wallet.svg). The image keeps its original aspect ratio and is not dimmed or recolored. Apple and Apple Wallet are trademarks of Apple Inc.
