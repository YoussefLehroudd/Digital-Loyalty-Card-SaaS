# Loyvance Real Web Push (PWA)

Real encrypted Web Push is integrated into the existing Loyvance Service Worker.

## Environment

Set these on the Vercel project for **production** (never commit private keys):

- `VAPID_PUBLIC_KEY`: URL-safe Base64 P-256 uncompressed public key (65 bytes)
- `VAPID_PRIVATE_KEY`: URL-safe Base64 P-256 private scalar (32 bytes), **encrypted**
- `VAPID_SUBJECT`: an HTTPS URL or mailto contact URL (e.g. `https://loyvance.vercel.app`)
- `CRON_SECRET`: existing server-only scheduler secret

VAPID keys must stay stable across new releases: rotating them invalidates previously subscribed devices; customers must enable again.

## Customer experience

1. Install the HTTPS PWA. On iOS 16.4+ Safari **Add to Home Screen**, then launch the installed web app. Android Chrome may show the install prompt.
2. Open **Customer → Settings → Real phone notifications → Enable on this device**.
3. Confirm the browser/OS notification permission.
4. The browser creates a device-specific endpoint and public encryption keys. They are saved for the authenticated customer only. No browser permission is requested before the user taps Enable.
5. Turn off the global Push switch and save to pause all push, or **Remove this device** to revoke the local subscription. Customer logout also unregisters the device.

Each customer's existing in-app notifications continue to work independently of Web Push.

## Delivery and timing

- Stamp / reward / owner campaign actions enqueue messages after the main HTTP response (Next.js `after`); the SQL queue deduplicates by notification ID and device.
- The existing **daily campaigns cron** runs the scheduled birthday and campaign workers and drains pending push (bounded batch).
- `GET /api/cron/push` is also available with `Authorization: Bearer <CRON_SECRET>` for an external authenticated scheduler if higher-volume/faster delivery is required. A short scheduler interval on a plan supporting it is recommended for large campaigns.
- Network failures retry with backoff; expired endpoints are removed on 404/410.
- Promotional push requires customer `promotions=true`. Birthday push requires `birthday_opt_in=true`. Global push and reward-alert preferences are always checked at delivery.

**Limits:** Delivery is best-effort. Browsers, push gateways, background battery rules, notification permissions, serverless cron cadence, and app installation can delay or suppress alerts. Vercel Hobby's existing once-daily cron is not enough for time-critical large campaign batches; upgrade scheduling/queue infrastructure when necessary.

## Security

- Allowlist standard Google, Mozilla, Apple and Windows push gateways (no arbitrary outbound URLs).
- Server encrypts payloads with RFC 8291 AES128GCM and signs requests with VAPID ES256.
- No user session token or customer geolocation is embedded in the subscription.
- Delivery joins notification owner and subscription owner, avoiding account crossover if the same browser is shared.
- Database records, endpoints and public keys are tenant-/user-scoped; the private VAPID key stays exclusively in Vercel encrypted environment variables.
- Do not expose sensitive financial or health details in lock-screen notification text.

## Validation

```bash
cd frontend
npm ci
node scripts/test-real-web-push.cjs
npm run build
```

The regression suite decrypts a real AES128GCM payload, checks VAPID transport and endpoint validation, checks user privacy and promotion consent, verifies one-time delivery and device revocation with PGlite. Real Android/iPhone device tests are still required after production deployment. Production must point to the new Git commit; adding VAPID keys alone does not update a stale deployed build.
