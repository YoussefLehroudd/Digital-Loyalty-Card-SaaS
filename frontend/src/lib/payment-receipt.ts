import { money, PAYMENT_METHODS, subscriptionDate, subscriptionDuration, type SubscriptionEvent } from "./subscription";

export async function createPaymentReceipt(event: SubscriptionEvent, businessName: string) {
  if (!event.receipt_number || !event.amount_centimes || !event.paid_at) throw Error("This activation has no recorded payment receipt.");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.09, .12, .10), muted = rgb(.43, .47, .44), gold = rgb(.69, .49, .18);
  const pale = rgb(.97, .96, .93), border = rgb(.88, .89, .86);
  let page = pdf.addPage([595.28, 841.89]);
  const safe = (text: string) => text.replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  function text(value: string, x: number, y: number, size = 11, strong = false, color = ink) {
    page.drawText(safe(value), { x, y, size, font: strong ? bold : regular, color });
  }
  function wrapped(value: string, x: number, y: number, width: number, size = 11, strong = false) {
    const font = strong ? bold : regular;
    let remaining = safe(value);
    while (remaining.length) {
      let n = remaining.length;
      while (n > 1 && font.widthOfTextAtSize(remaining.slice(0, n), size) > width) n--;
      if (n < remaining.length) { const space = remaining.lastIndexOf(" ", n); if (space > 0) n = space; }
      text(remaining.slice(0, n), x, y, size, strong);
      y -= size + 6;
      remaining = remaining.slice(n).trimStart();
    }
    return y;
  }
  const footer = () => {
    page.drawLine({ start: { x: 44, y: 78 }, end: { x: 551, y: 78 }, thickness: .6, color: border });
    text("LOYVANCE", 44, 58, 10, true, gold);
    text("Renewal assistance  |  0644819899", 331, 58, 9, false, muted);
    text("Payment confirmed by LOYVANCE. All dates are in Morocco time.", 44, 40, 8, false, muted);
  };
  pdf.setTitle(`LOYVANCE payment receipt - ${event.receipt_number}`);
  pdf.setAuthor("LOYVANCE");
  page.drawRectangle({ x: 0, y: 715, width: 595.28, height: 127, color: ink });
  text("LOYVANCE", 44, 792, 23, true, rgb(.93, .76, .43));
  text("PAYMENT RECEIPT", 44, 755, 11, true, rgb(.96, .96, .93));
  text("PAID", 495, 792, 11, true, rgb(.61, .85, .68));
  text("ISSUED TO", 44, 682, 9, true, muted);
  const nameEnd = wrapped(businessName, 44, 658, 507, 21, true);
  let y = nameEnd - 12;
  text("Receipt number", 44, y, 9, false, muted);
  y = wrapped(event.receipt_number, 44, y - 17, 507, 10, true) - 12;
  page.drawRectangle({ x: 44, y: y - 80, width: 507, height: 80, color: pale });
  text("AMOUNT RECEIVED", 62, y - 23, 9, true, muted);
  text(money(event.amount_centimes), 62, y - 59, 28, true, gold);
  y -= 112;
  text("SUBSCRIPTION COVERAGE", 44, y, 10, true, gold);
  y -= 25;
  text("Starts", 44, y, 9, false, muted); text("Ends", 305, y, 9, false, muted);
  text(subscriptionDate(event.started_at), 44, y - 20, 11, true);
  text(subscriptionDate(event.ends_at), 305, y - 20, 11, true);
  y -= 52;
  const rows = [
    ["Subscription plan", subscriptionDuration(event.duration_months)],
    ["Plan price", event.amount_dh != null ? `${event.amount_dh.toLocaleString("en-GB")} DH` : "Not recorded"],
    ["Payment date", subscriptionDate(event.paid_at)],
    ["Payment method", PAYMENT_METHODS.find(method => method.value === event.payment_method)?.label || event.payment_method || "Not recorded"],
    ["Payment reference", event.reference || "Not provided"],
  ];
  for (const [label, value] of rows) {
    // Long references continue cleanly on another page without colliding with the footer.
    const font = bold, size = 11, width = 318;
    const estimatedHeight = Math.ceil(font.widthOfTextAtSize(safe(value), size) / width) * 17 + 22;
    if (y - estimatedHeight < 110) { footer(); page = pdf.addPage([595.28, 841.89]); y = 780; text("PAYMENT RECEIPT - continued", 44, 808, 10, true, gold); }
    page.drawLine({ start: { x: 44, y: y + 9 }, end: { x: 551, y: y + 9 }, thickness: .6, color: border });
    text(label, 44, y - 9, 10, false, muted);
    const end = wrapped(value, 233, y - 9, width, size, true);
    y = Math.min(y - 38, end - 14);
  }
  footer();
  return pdf.save();
}

export async function downloadPaymentReceipt(event: SubscriptionEvent, businessName: string) {
  const bytes = await createPaymentReceipt(event, businessName);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.receipt_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
