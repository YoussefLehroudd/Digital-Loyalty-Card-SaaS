export type PremiumApprovalRequest = {
  business_id: string;
  business_name: string;
  feature: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
};
export type PremiumDecision = { business_id: string; feature: string; status: "approved" | "rejected" };
export const PREMIUM_DECISION_EVENT = "loyvance:premium-decision";
const pendingStates = new Set(["pending", "requested", "awaiting", "awaiting_review", "awaiting_approval"]);
export function isPremiumPending(row: {status:string}):boolean {
  return pendingStates.has(String(row.status).trim().toLowerCase());
}
export function premiumKey(row: {business_id:string;feature:string}):string {
  return JSON.stringify([row.business_id,row.feature]);
}
export function notifyPremiumDecision(decision:PremiumDecision) {
  if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PremiumDecision>(PREMIUM_DECISION_EVENT, {detail:decision}));
}
