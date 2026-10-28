import {ImageResponse} from "next/og";

const appIcons={
  customer:{glyph:"W",label:"WALLET",accent:"#eab758",background:"#0b100c"},
  business:{glyph:"B",label:"BUSINESS",accent:"#56dbc2",background:"#0c1a18"},
  admin:{glyph:"A",label:"ADMIN",accent:"#a4acff",background:"#101225"}
} as const;

export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{role:string;size:string}>}){
  const {role,size}=await params;
  if(!(role in appIcons)||!["192","512"].includes(size)){
    return new Response("Icon not found",{status:404});
  }
  // Customer and business use the official platform logo, while keeping their own PWA IDs and scopes.
  if(role==="customer"||role==="business"){
    const url=new URL(`/pwa/icon-${size}.png`,_request.url);
    return Response.redirect(url,307);
  }
  const detail=appIcons[role as keyof typeof appIcons];
  const px=Number(size),scale=px/512;
  return new ImageResponse(
    <div style={{
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      width:"100%",height:"100%",color:"#fff",background:detail.background,
      borderRadius:Math.round(104*scale),border:`${Math.max(2,Math.round(5*scale))}px solid ${detail.accent}`,
      position:"relative",fontFamily:"sans-serif"
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",
        width:Math.round(282*scale),height:Math.round(282*scale),
        borderRadius:Math.round(78*scale),border:`${Math.max(3,Math.round(7*scale))}px solid ${detail.accent}`,
        background:"#1c2022",fontSize:Math.round(192*scale),fontWeight:900,color:detail.accent}}>
        {detail.glyph}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:Math.round(42*scale),fontWeight:900,letterSpacing:Math.round(3*scale),
        marginTop:Math.round(28*scale)}}>{detail.label}</div>
    </div>,
    {width:px,height:px,headers:{"Cache-Control":"public, max-age=86400, s-maxage=86400"}}
  );
}
