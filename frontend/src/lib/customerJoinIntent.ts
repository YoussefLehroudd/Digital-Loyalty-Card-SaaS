const JOIN_INTENT_STORAGE_KEY = "digital_loyalty_customer_join_qr_intent";

type JoinIntentPayload = {
  qr: string;
  createdAt: number;
};

export function saveCustomerJoinIntent(qr: string) {
  if (typeof window === "undefined") return;
  const payload: JoinIntentPayload = {
    qr: qr.trim(),
    createdAt: Date.now(),
  };
  window.localStorage.setItem(JOIN_INTENT_STORAGE_KEY, JSON.stringify(payload));
}

export function readCustomerJoinIntent(maxAgeMs = 1000 * 60 * 60 * 24) {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(JOIN_INTENT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<JoinIntentPayload>;
    const qr = typeof parsed.qr === "string" ? parsed.qr.trim() : "";
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;

    if (!qr || !createdAt) {
      clearCustomerJoinIntent();
      return null;
    }

    if (Date.now() - createdAt > maxAgeMs) {
      clearCustomerJoinIntent();
      return null;
    }

    return qr;
  } catch {
    clearCustomerJoinIntent();
    return null;
  }
}

export function clearCustomerJoinIntent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(JOIN_INTENT_STORAGE_KEY);
}
