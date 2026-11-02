
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
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
    const rewardLedgerRef = adminDb
      .collection("rewardTransactions")
      .doc();

    await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);

      if (!orderSnapshot.exists) {
        throw new Error("Order not found.");
      }

      const order = orderSnapshot.data()!;
      const currentStatus = order.status;
      const stockDeducted = order.stockDeducted === true;
      const pointsAlreadyAwarded =
        order.rewardPointsAwarded === true;

      if (currentStatus === newStatus) {
        return;
      }

      const shouldDeduct =
        newStatus === "Confirmed" && !stockDeducted;

      const shouldRestore =
        newStatus === "Cancelled" && stockDeducted;

      const shouldAwardPoints =
        newStatus === "Delivered" &&
        !pointsAlreadyAwarded;

      const shouldReversePoints =
        currentStatus === "Delivered" &&
        newStatus !== "Delivered" &&
        pointsAlreadyAwarded;

      // Calculate reward points after reward discount.
      const subtotal = Number(order.subtotal);
      const rewardDiscount = Number(order.rewardDiscount || 0);

      if (
        (shouldAwardPoints || shouldReversePoints) &&
        (
          !Number.isFinite(subtotal) ||
          subtotal < 0 ||
          !Number.isFinite(rewardDiscount) ||
          rewardDiscount < 0 ||
          rewardDiscount > subtotal
        )
      ) {
        throw new Error("Invalid order subtotal or reward discount.");
      }

      const eligibleAmount = Math.max(0, subtotal - rewardDiscount);
      const rewardPoints = Math.floor(eligibleAmount / 100);

      // Resolve customer document.
      let customerRef:
        | FirebaseFirestore.DocumentReference
        | null = null;

      let customerSnapshot:
        | FirebaseFirestore.DocumentSnapshot
        | null = null;

      if (shouldAwardPoints || shouldReversePoints) {
        let customerId = String(order.customerId || "");

        // Support older orders that do not contain customerId.
        if (!customerId) {
          const phone = String(order.customer?.phone || "")
            .trim();

          if (!/^01[3-9]\d{8}$/.test(phone)) {
            throw new Error(
              "Customer information is missing for reward points."
            );
          }

          customerId = createHash("sha256")
            .update(phone)
            .digest("hex");
        }

        if (customerId.includes("/")) {
          throw new Error("Invalid customer ID.");
        }

        customerRef = adminDb
          .collection("customers")
          .doc(customerId);

        customerSnapshot = await transaction.get(customerRef);

        if (!customerSnapshot.exists) {
          throw new Error(
            "Customer record not found for reward points."
          );
        }
      }

      // Handle inventory updates.
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

          if (!Number.isInteger(currentStock) || currentStock < 0) {
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
                ". Available: " +
                currentStock +
                ", Required: " +
                quantity
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

      // Update customer reward points.
      if (
        customerRef &&
        customerSnapshot?.exists &&
        (shouldAwardPoints || shouldReversePoints)
      ) {
        const customer = customerSnapshot.data()!;

        const currentPoints = Math.max(
          0,
          Number(customer.rewardPoints || 0)
        );

        const currentLifetimePoints = Math.max(
          0,
          Number(customer.totalRewardPointsEarned || 0)
        );

        if (shouldAwardPoints) {
          transaction.update(customerRef, {
            rewardPoints: currentPoints + rewardPoints,
            totalRewardPointsEarned:
              currentLifetimePoints + rewardPoints,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        if (shouldReversePoints) {
          const previouslyEarned = Number(order.rewardPointsEarned || 0);

          if (
            !Number.isSafeInteger(previouslyEarned) ||
            previouslyEarned < 0
          ) {
            throw new Error("Invalid previously earned reward points.");
          }

          if (currentPoints < previouslyEarned) {
            throw new Error(
              "Cannot cancel this delivered order because the customer has already redeemed some of its reward points."
            );
          }

          transaction.update(customerRef, {
            rewardPoints: currentPoints - previouslyEarned,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Record reward points in the transaction ledger.
      if (
        customerRef &&
        customerSnapshot?.exists &&
        shouldAwardPoints
      ) {
        transaction.create(rewardLedgerRef, {
          customerId: customerRef.id,
          orderId,
          orderNumber: String(order.orderNumber || ""),
          type: "earn",
          points: rewardPoints,
          description: "Points earned from delivered order",
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (
        customerRef &&
        customerSnapshot?.exists &&
        shouldReversePoints
      ) {
        const previouslyEarned = Number(order.rewardPointsEarned || 0);

        transaction.create(rewardLedgerRef, {
          customerId: customerRef.id,
          orderId,
          orderNumber: String(order.orderNumber || ""),
          type: "reverse",
          points: -previouslyEarned,
          description: "Reward points reversed after order status change",
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Update order status and reward history.
      transaction.update(orderRef, {
        status: newStatus,

        ...(shouldDeduct ? { stockDeducted: true } : {}),
        ...(shouldRestore ? { stockDeducted: false } : {}),

        ...(shouldAwardPoints
          ? {
              rewardPointsAwarded: true,
              rewardPointsEarned: rewardPoints,
              rewardPointsAwardedAt: FieldValue.serverTimestamp(),
            }
          : {}),

        ...(shouldReversePoints
          ? {
              rewardPointsAwarded: false,
              rewardPointsReversedAt: FieldValue.serverTimestamp(),
            }
          : {}),

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
