// supabase/functions/_wrappers/stripe.ts

import Stripe from "https://esm.sh/stripe@14.21.0";

export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: "2023-10-16" });
}

export async function getSession(stripe: Stripe, sessionId: string) {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "customer"],
  });
}

export async function getPiDetails(stripe: Stripe, paymentIntentId: string): Promise<{
  latestChargeId: string | null;
  balanceTransactionId: string | null;
}> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["charges.data.balance_transaction"],
  });
  const charge = pi.charges?.data?.[0] ?? null; // newest
  const latestChargeId = charge?.id ?? null;
  const bt = charge?.balance_transaction as unknown;
  const balanceTransactionId = typeof bt === "string" ? bt : (bt as { id?: string } | null)?.id ?? null;
  return { latestChargeId, balanceTransactionId };
}

export function isSessionPaid(session: Stripe.Checkout.Session): boolean {
  return (
    session.payment_status === "paid" ||
    (session.status === "complete" && session.payment_status !== "unpaid")
  );
}
