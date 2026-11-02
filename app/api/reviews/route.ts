import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "Product ID is required." },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("reviews")
      .where("productId", "==", productId)
      .get();

    const reviews = snapshot.docs
      .map((reviewDoc) => {
        const data = reviewDoc.data();

        return {
          id: reviewDoc.id,
          productId: data.productId,
          productName: data.productName,
          customerName: data.customerName,
          rating: data.rating,
          comment: data.comment,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || null,
        };
      })
      .filter((review) => {
        const original = snapshot.docs.find(
          (item) => item.id === review.id
        );

        return original?.data().status === "Approved";
      })
      .sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });

    const totalReviews = reviews.length;

    const averageRating =
      totalReviews > 0
        ? Number(
            (
              reviews.reduce(
                (total, review) => total + review.rating,
                0
              ) / totalReviews
            ).toFixed(1)
          )
        : 0;

    return NextResponse.json({
      success: true,
      reviews,
      totalReviews,
      averageRating,
    });
  } catch (error) {
    console.error("Review loading error:", error);

    return NextResponse.json(
      { success: false, message: "Could not load reviews." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const productId = String(body.productId || "").trim();
    const orderId = String(body.orderId || "").trim();
    const orderNumber = String(body.orderNumber || "").trim();
    const phone = normalizePhone(body.phone);
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim();

    if (!productId || !orderId || !orderNumber || !phone) {
      return NextResponse.json(
        { success: false, message: "Please provide all order details." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be between 1 and 5." },
        { status: 400 }
      );
    }

    if (comment.length < 10 || comment.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: "Review must be between 10 and 1000 characters.",
        },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    const order = orderSnapshot.data()!;

    if (order.status !== "Delivered") {
      return NextResponse.json(
        {
          success: false,
          message: "Only delivered orders can be reviewed.",
        },
        { status: 403 }
      );
    }

    if (String(order.orderNumber || "") !== orderNumber) {
      return NextResponse.json(
        { success: false, message: "Order details do not match." },
        { status: 403 }
      );
    }

    if (normalizePhone(order.customer?.phone) !== phone) {
      return NextResponse.json(
        { success: false, message: "Phone number does not match." },
        { status: 403 }
      );
    }

    const purchasedItem = (order.items || []).find(
      (item: { id?: string | number }) =>
        String(item.id) === productId
    );

    if (!purchasedItem) {
      return NextResponse.json(
        {
          success: false,
          message: "This product was not found in the order.",
        },
        { status: 403 }
      );
    }

    const reviewId = createHash("sha256")
      .update(`${orderId}_${productId}`)
      .digest("hex");

    const reviewRef = adminDb.collection("reviews").doc(reviewId);

    await adminDb.runTransaction(async (transaction) => {
      const existingReview = await transaction.get(reviewRef);

      if (existingReview.exists) {
        throw new Error("REVIEW_ALREADY_EXISTS");
      }

      transaction.set(reviewRef, {
        productId,
        productName: String(purchasedItem.name || "Product"),
        orderId,
        orderNumber,
        customerName: String(order.customer?.name || "Customer"),
        customerPhone: phone,
        rating,
        comment,
        status: "Pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: "Your review has been submitted for approval.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "REVIEW_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You have already reviewed this product for this order.",
        },
        { status: 409 }
      );
    }

    console.error("Review submission error:", error);

    return NextResponse.json(
      { success: false, message: "Could not submit your review." },
      { status: 500 }
    );
  }
}