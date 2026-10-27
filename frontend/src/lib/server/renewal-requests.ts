import { createHash, randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";
import { subscriptionPlan } from "@/lib/subscription";
type Sql = ReturnType<typeof getSql>;
type RowsSql=(parts:TemplateStringsArray,...values:unknown[])=>Promise<Array<Record<string,unknown>>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (data: unknown, status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function renewalProof(database: Sql, id: string, businessId?: string) {
  const sql=database as unknown as RowsSql;
  if (!uuid.test(id)) return reply({message:"Invalid request identifier."},422);
  const rows = await sql`SELECT encode(proof_data,'base64') AS data,proof_mime FROM subscription_renewal_requests WHERE id=${id} AND (${businessId ?? null}::uuid IS NULL OR business_id=${businessId ?? null}::uuid)`;
  if (!rows[0]) return reply({message:"Request not found."},404);
  return new Response(new Uint8Array(Buffer.from(String(rows[0].data),"base64")),{headers:{"Content-Type":String(rows[0].proof_mime),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline; filename=payment-proof","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
export async function submitRenewal(database: Sql, req: Request, businessId: string) {
  const sql=database as unknown as RowsSql;
  const form=await req.formData().catch(()=>null);
  const id=String(form?.get("request_id")??""), plan=subscriptionPlan(Number(form?.get("duration_months")));
  const note=String(form?.get("note")??"").trim(),reference=String(form?.get("reference")??"").trim(),file=form?.get("proof");
  const mode=String(form?.get("mode")??"");
  if (!uuid.test(id)||!plan||!["extend","replace"].includes(mode)||note.length>1000||reference.length>200||!(file instanceof File)||!file.size||file.size>2*1024*1024) return reply({message:"Select a duration and attach a JPG, PNG or WebP payment proof (maximum 2 MB)."},422);
  const bytes=Buffer.from(await file.arrayBuffer());
  const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"image/png":bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"image/jpeg":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"image/webp":null;
  if (!mime) return reply({message:"The proof must be a valid JPG, PNG or WebP image."},422);
  const hash=createHash("sha256").update(bytes).digest("hex");
  const existing=await sql`SELECT business_id,duration_months,mode,note,reference,proof_hash FROM subscription_renewal_requests WHERE id=${id}`;
  if(existing[0])return existing[0].business_id===businessId&&existing[0].duration_months===plan.months&&existing[0].mode===mode&&existing[0].note===note&&existing[0].reference===reference&&existing[0].proof_hash===hash?reply({message:"Renewal request submitted. The administrator will review your payment."}):reply({message:"This request identifier has already been used."},409);
  const rows=await sql`INSERT INTO subscription_renewal_requests(id,business_id,duration_months,mode,plan_price_dh,note,reference,proof_data,proof_mime,proof_hash)
    VALUES(${id},${businessId},${plan.months},${mode},${plan.price},${note},${reference},decode(${bytes.toString("base64")},'base64'),${mime},${hash}) ON CONFLICT DO NOTHING RETURNING id`;
  if(!rows.length) return reply({message:"A renewal request is already pending. Please wait for the administrator's review."},409);
  return reply({message:"Renewal request submitted. Your access changes only after administrator approval."},201);
}
export async function rejectRenewal(database: Sql, id: string, req: Request, actor: {id:string;name:string}) {
  const sql=database as unknown as RowsSql;
  if(!uuid.test(id))return reply({message:"Invalid request identifier."},422);
  const body=await req.json().catch(()=>({}));const note=typeof body.note==="string"?body.note.trim():"";
  if(!note||note.length>1000)return reply({message:"Add the reason for rejecting this request."},422);
  const result=await sql`WITH rejected AS (UPDATE subscription_renewal_requests SET status='rejected',reviewed_at=now(),actor_id=${actor.id},actor_name=${actor.name},review_note=${note} WHERE id=${id} AND status='pending' RETURNING business_id),audit AS (
    INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
    SELECT ${randomUUID()},${actor.id},${actor.name},'renewal_rejected','business',r.business_id,b.name,${note} FROM rejected r JOIN businesses b ON b.id=r.business_id RETURNING id
  ) SELECT id FROM audit`;
  return result.length?reply({message:"Renewal request rejected. The business can read your reason and submit a new request."}):reply({message:"This request has already been reviewed."},409);
}
