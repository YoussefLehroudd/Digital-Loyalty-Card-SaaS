import { money, PAYMENT_METHODS, subscriptionDate, subscriptionDuration, type SubscriptionEvent } from "./subscription";
export async function downloadPaymentReceipt(event: SubscriptionEvent, businessName: string){
 if(!event.receipt_number||!event.amount_centimes||!event.paid_at)throw Error("This activation has no recorded payment receipt.");
 const {PDFDocument,StandardFonts,rgb}=await import("pdf-lib");
 const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=pdf.addPage([595.28,841.89]);
 const gold=rgb(.65,.46,.15),ink=rgb(.13,.15,.13),muted=rgb(.42,.44,.4);let y=700;
 // WinAnsi-safe text and wrapping keep long references, names and notes readable.
 const clean=(s:string)=>s.replace(/[^\x20-\x7E\xA0-\xFF]/g,"?");
 function line(text:string,size=11,strong=false,color=ink){const font=strong?bold:regular;let remaining=clean(text);while(remaining.length){let low=1,high=remaining.length,n=1;while(low<=high){const middle=Math.floor((low+high)/2);if(font.widthOfTextAtSize(remaining.slice(0,middle),size)<=490){n=middle;low=middle+1;}else high=middle-1;}if(n<remaining.length){const space=remaining.lastIndexOf(" ",n);if(space>0)n=space;}
  if(y<65){page=pdf.addPage([595.28,841.89]);y=780;}page.drawText(remaining.slice(0,n),{x:52,y,size,font,color});y-=size+7;remaining=remaining.slice(n).trimStart();}}
 page.drawRectangle({x:0,y:746,width:595.28,height:96,color:rgb(.08,.1,.08)});page.drawText("LOYVANCE",{x:52,y:799,size:23,font:bold,color:rgb(.91,.73,.39)});page.drawText("PAYMENT RECEIPT",{x:52,y:771,size:11,font:bold,color:rgb(.9,.9,.86)});
 line("Receipt "+event.receipt_number,10,true,gold);y-=8;line(businessName,20,true);y-=12;line("Amount received",11,false,muted);line(money(event.amount_centimes),30,true,gold);y-=18;
 for(const [label,value] of [["Payment date",subscriptionDate(event.paid_at)+" (Morocco time)"],["Payment method",PAYMENT_METHODS.find(m=>m.value===event.payment_method)?.label||event.payment_method||"Not recorded"],["Subscription duration",subscriptionDuration(event.duration_months)],["Plan price",String(event.amount_dh)+" DH"],["Coverage starts",subscriptionDate(event.started_at)],["Coverage ends",subscriptionDate(event.ends_at)],["Mode",event.mode==="extend"?"Renew / Extend":"Start now / Replace"],["Recorded by",event.actor_name],["Recorded at",subscriptionDate(event.created_at)],["Payment reference",event.reference||"Not provided"]]){line(label,9,false,muted);line(value,11,true);y-=5;}
 y-=10;line("Administrator note",9,false,muted);for(const part of event.note.split(/\r?\n/))line(part||" ",10);y-=14;line("LOYVANCE - Renewal assistance: 0644819899",10,true,gold);line("Record of the payment confirmed by the platform administrator.",9,false,muted);
 const bytes=await pdf.save();const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));const link=document.createElement("a");link.href=url;link.download=`${event.receipt_number}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
