import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

const VALID_STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const;

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.uid !== ADMIN_UID) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const { orderId } = await context.params;
    const body = await request.json();
    const newStatus = body.status;

    if (
      typeof orderId !== "string" ||
      !orderId.trim() ||
      orderId.includes("/") ||
      !VALID_STATUSES.includes(newStatus)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid order or status." },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);

    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);

      if (!orderSnapshot.exists) {
        throw new Error("Order not found.");
      }

      const order = orderSnapshot.data()!;
      const currentStatus = order.status;
      const stockDeducted = order.stockDeducted === true;

      if (currentStatus === newStatus) {
        return;
      }

      const shouldDeduct =
        newStatus === "Confirmed" && !stockDeducted;

      const shouldRestore =
        newStatus === "Cancelled" && stockDeducted;

      if (shouldDeduct || shouldRestore) {
        if (!Array.isArray(order.items) || order.items.length === 0) {
          throw new Error("Order contains no valid products.");
        }

        const quantities = new Map<string, number>();

        for (const item of order.items) {
          const productId = String(item.id ?? "");
          const quantity = Number(item.quantity);

          if (
            !productId ||
            productId.includes("/") ||
            !Number.isInteger(quantity) ||
            quantity < 1
          ) {
            throw new Error("Invalid product information in order.");
          }

          quantities.set(
            productId,
            (quantities.get(productId) || 0) + quantity
          );
        }

        const productRefs = Array.from(quantities.keys()).map(
          (id) => adminDb.collection("products").doc(id)
        );

        const productSnapshots = await Promise.all(
          productRefs.map((ref) => transaction.get(ref))
        );

        const stockUpdates: {
          ref: FirebaseFirestore.DocumentReference;
          stock: number;
        }[] = [];

        for (let index = 0; index < productSnapshots.length; index++) {
          const snapshot = productSnapshots[index];
          const ref = productRefs[index];
          const quantity = quantities.get(ref.id)!;

          if (!snapshot.exists) {
            throw new Error("A product in this order no longer exists.");
          }

          const currentStock = snapshot.data()?.stock;

          if (
            !Number.isInteger(currentStock) ||
            currentStock < 0
          ) {
            throw new Error(
              "Stock is not configured for " +
              String(snapshot.data()?.name || "a product") +
              ". Please update its stock first."
            );
          }

          if (shouldDeduct && currentStock < quantity) {
            throw new Error(
              "Insufficient stock for " +
              String(snapshot.data()?.name || "a product") +
              ". Available: " + currentStock +
              ", Required: " + quantity
            );
          }

          const updatedStock = shouldDeduct
            ? currentStock - quantity
            : currentStock + quantity;

          stockUpdates.push({
            ref,
            stock: updatedStock,
          });
        }

        for (const update of stockUpdates) {
          transaction.update(update.ref, {
            stock: update.stock,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(orderRef, {
        status: newStatus,
        ...(shouldDeduct ? { stockDeducted: true } : {}),
        ...(shouldRestore ? { stockDeducted: false } : {}),
        statusUpdatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: "Order status updated successfully.",
    });
  } catch (error) {
    console.error("Order status update failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update order status.";

    const status = message.includes("Insufficient stock")
      ? 409
      : message === "Order not found."
        ? 404
        : 400;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
