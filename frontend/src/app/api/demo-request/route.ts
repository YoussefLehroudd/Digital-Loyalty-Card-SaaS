import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/server/db";
import { ensureVisitorAnalyticsSchema } from "@/lib/server/visitor-analytics";

export const runtime = "nodejs";
const clean = (v:unknown,max:number)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max):"";
const validEmail=(s:string)=>s.length<=150&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);
const validCode=(s:string)=>/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(s);
const html=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request){
 try{
   const origin=req.headers.get("origin");
   if(origin && new URL(origin).host!==new URL(req.url).host) return json({message:"Please submit from the LOYVANCE website."},403);
   if(Number(req.headers.get("content-length")||0)>4096)return json({message:"Request too large."},413);
   const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
   if(!body||Array.isArray(body))return json({message:"Invalid request."},422);
   if(clean(body.website,100))return json({ok:true},201);
   const name=clean(body.contact_name,100),business=clean(body.business_name,120);
   const email=clean(body.email,150).toLowerCase(),message=clean(body.message,1200);
   const slug=clean(body.campaign_code,48).toLowerCase();
   if(body.consent!==true||name.length<2||business.length<2||!validEmail(email))
     return json({message:"Please provide your name, business, valid email and consent."},422);
   const sql=getSql();
   await ensureVisitorAnalyticsSchema(sql);
   const previous=await sql`SELECT count(*)::int AS count FROM visitor_demo_requests
     WHERE email=${email} AND created_at>now()-interval '24 hours'`;
   if(Number(previous[0]?.count||0)>=3)return json({message:"Too many requests. Please contact us directly by email."},429);
   const codes=validCode(slug)?await sql`SELECT a.campaign_code FROM visitor_analytics_campaign_aliases a
     JOIN visitor_analytics_campaigns c ON c.code=a.campaign_code
     WHERE a.slug=${slug} AND c.archived_at IS NULL LIMIT 1`:[];
   const campaign=codes.length?String(codes[0].campaign_code):null;
   const id=randomUUID();
   await sql`INSERT INTO visitor_demo_requests(id,contact_name,business_name,email,message,campaign_code)
     VALUES(${id}::uuid,${name},${business},${email},${message},${campaign})`;
   // A saved lead remains available to administrators if email delivery fails.
   if(process.env.RESEND_API_KEY){
     try{
       const from=process.env.RESEND_FROM_EMAIL||"LOYVANCE <hello@"+(process.env.RESEND_DOMAIN||"youssefhrd.com")+">";
       const content="<h2>New LOYVANCE demo request</h2>"+
         "<p><b>Name:</b> "+html(name)+"</p><p><b>Business:</b> "+html(business)+"</p>"+
         "<p><b>Email:</b> "+html(email)+"</p><p><b>Campaign:</b> "+html(campaign||"Direct")+" </p>"+
         "<p><b>Message:</b></p><p style='white-space:pre-wrap'>"+html(message||"(none)")+"</p>"+
         "<p><a href='https://loyvance.vercel.app/admin/visitors'>Open Admin Visitors</a></p>";
       const sent=await fetch("https://api.resend.com/emails",{
         method:"POST",
         headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"loyvance-demo-"+id},
         body:JSON.stringify({from,to:["youssefhrdd@gmail.com"],reply_to:email,subject:"LOYVANCE demo request - "+business,html:content,tags:[{name:"category",value:"support"}]}),
         signal:AbortSignal.timeout(10000),
       });
       if(sent.ok)await sql`UPDATE visitor_demo_requests SET emailed=true WHERE id=${id}::uuid`;
       else console.error("Demo request notification failed",sent.status);
     }catch{console.error("Demo request notification unavailable");}
   }
   return json({ok:true},201);
 }catch{return json({message:"Unable to submit. Please try WhatsApp or email."},503);}
}
