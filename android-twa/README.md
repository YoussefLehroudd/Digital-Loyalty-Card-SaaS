# LOYVANCE Android APK

This is a Trusted Web Activity (TWA), not a standalone/offline copy of Next.js.
It opens https://loyvance.vercel.app/ with the existing login, API, Neon data,
QR scanning and supported Web Push. Android notification permission and browser
compatibility must still be tested on physical devices.

## Release signing (one-time, never commit the keystore)

Create a permanent release keystore with Android Studio or:
```sh
keytool -genkeypair -v -keystore loyvance-release.jks -alias loyvance -keyalg RSA -keysize 3072 -validity 10000
keytool -list -v -keystore loyvance-release.jks -alias loyvance
```
Back up the keystore and passwords securely. Losing them prevents signed APK
updates with the same Android package.

Set these GitHub Actions repository secrets:
- ANDROID_KEYSTORE_BASE64: Base64-encoded keystore file (no linebreaks)
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

From GitHub > Actions > Build Loyvance Android APK > Run workflow, provide a
version tag. The workflow builds and signs Loyvance-Android.apk and creates a
GitHub Release. The /download/android website page then offers the actual APK.
Never show a download button for a nonexistent release.

**Required for full-screen verification**:
- Copy the signing certificate's SHA-256 fingerprint printed by keytool.
- Set Vercel production environment variable LOYVANCE_ANDROID_SHA256 to it.
- Redeploy and verify https://loyvance.vercel.app/.well-known/assetlinks.json
  has package com.loyvance.app with the exact matching fingerprint.

Without this the TWA opens as a browser Custom Tab (with address bar), so do
not describe the app as fully configured until verified. Keep a stable signing
key for updates. For APK version upgrades, increase versionCode in
android-twa/app/build.gradle before building.

## Validation on physical Android

1. Download the signed APK from /download/android, verify app identity.
2. Sign in as customer and business; test cards, scanner permission, rewards.
3. Check Web Push with the device registered and actual lock-screen delivery.
4. Check Passkeys and navigation back stack. Ensure the TWA keeps website
   sessions and uses the expected browser.
5. Confirm offline behavior is not promised: server-dependent features need internet.
