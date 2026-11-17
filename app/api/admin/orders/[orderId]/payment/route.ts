import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
export const runtime = "nodejs";
const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";
type RouteContext = { params: Promise<{ orderId: string }> };
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.substring(7), true);
    if (decoded.uid !== ADMIN_UID) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
    const { orderId } = await context.params;
    if (!orderId || orderId.includes("/")) return NextResponse.json({ success: false, error: "Invalid order." }, { status: 400 });
    const { action } = await request.json();
    if (!["approve_payment", "reject_payment", "approve_later", "reject_later"].includes(action)) return NextResponse.json({ success: false, error: "Invalid payment action." }, { status: 400 });
    const ref = adminDb.collection("orders").doc(orderId);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref); if (!snap.exists) throw new Error("Order not found.");
      const order = snap.data()!; const now = new Date().toISOString();
      if (action === "approve_payment" || action === "reject_payment") {
        if (order.paymentStatus !== "Pending Verification") throw new Error("This payment is not awaiting verification.");
        if (action === "approve_payment") {
          if (!order.paymentTransactionId || !order.paymentSenderNumber) throw new Error("Payment details are incomplete.");
          tx.update(ref, { paymentStatus: "Verified", paymentVerifiedAt: now, paymentVerifiedBy: decoded.uid, ...(order.paymentChoice === "delivery" ? { deliveryChargePaid: true } : {}), updatedAt: now });
        } else tx.update(ref, { paymentStatus: "Rejected", paymentRejectedAt: now, paymentRejectedBy: decoded.uid, updatedAt: now });
      } else {
        if (order.deliveryChargeLaterStatus !== "Pending") throw new Error("No delivery-charge-later request is pending.");
        tx.update(ref, { deliveryChargeLaterStatus: action === "approve_later" ? "Approved" : "Rejected", paymentStatus: action === "approve_later" ? "Pay Delivery on Delivery" : "Awaiting Advance Payment", deliveryChargeLaterReviewedAt: now, deliveryChargeLaterReviewedBy: decoded.uid, updatedAt: now });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) { const message = error instanceof Error ? error.message : "Unable to update payment."; return NextResponse.json({ success: false, error: message }, { status: message === "Order not found." ? 404 : 400 }); }
}
