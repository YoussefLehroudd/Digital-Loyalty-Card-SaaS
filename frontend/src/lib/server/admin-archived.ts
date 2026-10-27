import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string,unknown>;
type Query = (parts:TemplateStringsArray,...args:unknown[])=>Promise<Row[]>;

const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:{"Cache-Control":"no-store"}});

/**
 * Central view of recoverable accounts.
 *
 * Affiliates use real soft-archiving (archived_at).
 * Business and Customer accounts use reversible suspension; do not call them
 * permanently deleted records, and never try to reconstruct hard-deleted data.
 */
export async function adminArchived(req:Request,sql:Sql,path:string[]):Promise<Response>{
 if(req.method!=="GET")return reply({message:"Method not allowed."},405);
 if(path.length!==2)return reply({message:"Not found."},404);
 const params=new URL(req.url).searchParams;
 const type=params.get("type")||"all";
 if(!["all","business","customer","affiliate"].includes(type))return reply({message:"Invalid archive filter."},422);
 const pageNumber=Number(params.get("page")||"1");
 const page=Number.isFinite(pageNumber)?Math.max(1,Math.min(100000,Math.floor(pageNumber))):1;
 const offset=(page-1)*25;
 const search=(params.get("q")||"").trim().slice(0,100);
 const like="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
 const q=sql as unknown as Query;
 const result=await q`
   WITH recoverable AS (
     SELECT b.id::text AS id,'business'::text AS type,b.name::text AS name,
       b.email::text AS email,COALESCE(b.updated_at,b.created_at)::text AS changed_at,
       b.created_at::text AS created_at,'Suspended'::text AS state,
       (SELECT count(*)::int FROM customers c WHERE c.business_id=b.id) AS related_count
     FROM businesses b WHERE b.status='suspended'
     UNION ALL
     SELECT u.id::text AS id,'customer'::text AS type,u.name::text AS name,
       CASE WHEN NOT EXISTS(
         SELECT 1 FROM customers c JOIN businesses b ON b.id=c.business_id
         WHERE c.user_id=u.id AND b.admin_contact_private=true
       ) THEN u.email::text ELSE NULL END AS email,
       COALESCE(u.updated_at,u.created_at)::text AS changed_at,
       u.created_at::text AS created_at,'Suspended'::text AS state,
       (SELECT count(*)::int FROM customers c WHERE c.user_id=u.id) AS related_count
     FROM app_users u WHERE u.role='customer' AND u.status='suspended'
     UNION ALL
     SELECT p.id::text AS id,'affiliate'::text AS type,p.name::text AS name,
       p.email::text AS email,p.archived_at::text AS changed_at,
       p.created_at::text AS created_at,'Archived'::text AS state,
       (SELECT count(*)::int FROM affiliate_businesses ab WHERE ab.affiliate_id=p.id) AS related_count
     FROM affiliate_partners p WHERE p.archived_at IS NOT NULL
   ),
   matching AS (
     SELECT * FROM recoverable
     WHERE (${type}='all' OR type=${type})
       AND (name ILIKE ${like} OR COALESCE(email,'') ILIKE ${like})
   ),
   page_items AS (
     SELECT * FROM matching ORDER BY changed_at DESC,id LIMIT 25 OFFSET ${offset}
   )
   SELECT
     (SELECT count(*)::int FROM matching) AS total,
     (SELECT count(*)::int FROM businesses WHERE status='suspended') AS businesses,
     (SELECT count(*)::int FROM app_users WHERE role='customer' AND status='suspended') AS customers,
     (SELECT count(*)::int FROM affiliate_partners WHERE archived_at IS NOT NULL) AS affiliates,
     COALESCE((SELECT json_agg(row_to_json(p)) FROM page_items p),'[]'::json) AS data
 `;
 const output=result[0]||{};
 return reply({data:output.data||[],total:Number(output.total||0),
    counts:{business:Number(output.businesses||0),customer:Number(output.customers||0),affiliate:Number(output.affiliates||0)},
    page,per_page:25});
}
