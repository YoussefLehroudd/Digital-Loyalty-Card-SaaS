import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The SHA-256 certificate fingerprint is public by design, but the keystore
 * must stay private in GitHub Actions secrets. Never expose a signing key.
 */
export async function GET() {
  const values = (process.env.LOYVANCE_ANDROID_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  const statements = values.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.loyvance.app",
      sha256_cert_fingerprints: values,
    },
  }] : [];
  return NextResponse.json(statements, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
