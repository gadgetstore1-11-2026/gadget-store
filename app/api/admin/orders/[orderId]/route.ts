import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function DELETE(
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

    const decoded = await adminAuth.verifyIdToken(
      authorization.substring(7)
    );

    if (decoded.uid !== ADMIN_UID) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const { orderId } = await context.params;

    if (!orderId || orderId.includes("/")) {
      return NextResponse.json(
        { success: false, error: "Invalid order ID." },
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

      if (order.stockDeducted === true) {
        if (!Array.isArray(order.items) || order.items.length === 0) {
          throw new Error("Order contains invalid products.");
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
            throw new Error("Invalid product information.");
          }

          quantities.set(
            productId,
            (quantities.get(productId) || 0) + quantity
          );
        }

        const productRefs = Array.from(quantities.keys()).map(
          (id) => adminDb.collection("products").doc(id)
        );

        const snapshots = await Promise.all(
          productRefs.map((ref) => transaction.get(ref))
        );

        const updates = [];

        for (let index = 0; index < snapshots.length; index++) {
          const snapshot = snapshots[index];
          const ref = productRefs[index];

          if (!snapshot.exists) {
            throw new Error("A product in this order no longer exists.");
          }

          const stock = snapshot.data()?.stock;

          if (!Number.isInteger(stock) || stock < 0) {
            throw new Error("Invalid product stock.");
          }

          updates.push({
            ref,
            stock: stock + quantities.get(ref.id)!,
          });
        }

        for (const update of updates) {
          transaction.update(update.ref, {
            stock: update.stock,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.delete(orderRef);
    });

    return NextResponse.json({
      success: true,
      message: "Order deleted and stock restored successfully.",
    });
  } catch (error) {
    console.error("Order deletion failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete order.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Order not found." ? 404 : 400 }
    );
  }
}
