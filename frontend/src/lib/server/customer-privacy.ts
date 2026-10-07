import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

type Owner = { id: string; name: string; role: string };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function businessPrivacy(req: Request, sql: ReturnType<typeof getSql>, owner: Owner, business: { id: string; name: string } | null) {
  if (owner.role !== "business_owner" || !business) return reply({ message: "Business owner access required." }, 403);
  if (req.method === "GET") {
    const rows = await sql`SELECT admin_contact_access FROM businesses WHERE id = ${business.id}` as Array<{ admin_contact_access: boolean }>;
    return reply({ admin_contact_access: rows[0]?.admin_contact_access === true });
  }
  if (req.method !== "PATCH") return reply({ message: "Method not allowed." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.admin_contact_access !== "boolean") return reply({ message: "Choose whether to allow customer contact access." }, 422);
  // Lock and audit the change together, including concurrent updates. Never accept a tenant from the request body.
  await sql`WITH previous AS (
    SELECT id, admin_contact_access FROM businesses WHERE id = ${business.id} FOR UPDATE
  ), changed AS (
    UPDATE businesses b SET admin_contact_access = ${body.admin_contact_access}, updated_at = now()
    FROM previous p WHERE b.id = p.id AND p.admin_contact_access IS DISTINCT FROM ${body.admin_contact_access}
    RETURNING b.id
  ) INSERT INTO admin_audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, entity_name, reason)
    SELECT ${randomUUID()}, ${owner.id}, ${owner.name}, 'customer_privacy_change', 'business', id, ${business.name},
      ${body.admin_contact_access ? "Customer contact access enabled by business owner" : "Customer contact access disabled by business owner"} FROM changed`;
  return reply({ admin_contact_access: body.admin_contact_access, message: "Privacy preference saved." });
}
