import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { AggregateField, FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function isValidProductId(value: string | null) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes("/") &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("productId");
    const cursor = request.nextUrl.searchParams.get("cursor");

    if (!isValidProductId(productId)) {
      return NextResponse.json(
        { success: false, message: "Invalid product ID." },
        { status: 400 }
      );
    }

    if (
      cursor &&
      (
        cursor.length > 128 ||
        cursor.includes("/") ||
        /[\u0000-\u001F\u007F]/.test(cursor)
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid review cursor." },
        { status: 400 }
      );
    }

    const PAGE_SIZE = 10;
    const reviewsRef = adminDb.collection("reviews");

    const approvedReviewsQuery = reviewsRef
      .where("productId", "==", productId)
      .where("status", "==", "Approved");

    const [aggregateSnapshot, cursorSnapshot] = await Promise.all([
      approvedReviewsQuery
        .aggregate({
          totalReviews: AggregateField.count(),
          averageRating: AggregateField.average("rating"),
        })
        .get(),
      cursor
        ? reviewsRef.doc(cursor).get()
        : Promise.resolve(null),
    ]);

    if (
      cursor &&
      (
        !cursorSnapshot?.exists ||
        cursorSnapshot.data()?.productId !== productId ||
        cursorSnapshot.data()?.status !== "Approved"
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid review cursor." },
        { status: 400 }
      );
    }

    let pageQuery = approvedReviewsQuery
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");

    if (cursorSnapshot?.exists) {
      pageQuery = pageQuery.startAfter(cursorSnapshot);
    }

    const pageSnapshot = await pageQuery.limit(PAGE_SIZE + 1).get();

    const hasMore = pageSnapshot.docs.length > PAGE_SIZE;
    const pageDocs = pageSnapshot.docs.slice(0, PAGE_SIZE);

    const reviews = pageDocs.map((reviewDoc) => {
      const data = reviewDoc.data();

      return {
        id: reviewDoc.id,
        productId: data.productId,
        productName: String(data.productName || "Product"),
        customerName: String(data.customerName || "Verified Customer"),
        rating: Math.min(5, Math.max(0, Number(data.rating) || 0)),
        comment: String(data.comment || ""),
        createdAt:
          data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    const aggregateData = aggregateSnapshot.data();
    const totalReviews = Number(aggregateData.totalReviews || 0);
    const averageRating =
      totalReviews > 0
        ? Number(Number(aggregateData.averageRating || 0).toFixed(1))
        : 0;

    return NextResponse.json(
      {
        success: true,
        reviews,
        totalReviews,
        averageRating,
        pageSize: PAGE_SIZE,
        hasMore,
        nextCursor: hasMore
          ? pageDocs[pageDocs.length - 1].id
          : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
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

    if (!productId || !orderNumber || !phone) {
      return NextResponse.json(
        { success: false, message: "Please provide all order details." },
        { status: 400 }
      );
    }

    if (!isValidProductId(productId)) {
      return NextResponse.json(
        { success: false, message: "Invalid product ID." },
        { status: 400 }
      );
    }

    if (
      !/^GS-[A-Z0-9-]{4,56}$/i.test(orderNumber) ||
      !/^01[3-9]\d{8}$/.test(phone)
    ) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid order number and Bangladesh phone number." },
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

    let orderRef = orderId
      ? adminDb.collection("orders").doc(orderId)
      : null;
    let orderSnapshot = orderRef ? await orderRef.get() : null;

    if (!orderSnapshot || !orderSnapshot.exists) {
      const matchingOrders = await adminDb
        .collection("orders")
        .where("orderNumber", "==", orderNumber.toUpperCase())
        .limit(1)
        .get();

      if (!matchingOrders.empty) {
        orderRef = matchingOrders.docs[0].ref;
        orderSnapshot = matchingOrders.docs[0];
      }
    }

    if (!orderSnapshot || !orderSnapshot.exists || !orderRef) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    const order = orderSnapshot.data()!;

    if (order.accountUid) {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
          { success: false, message: "Please sign in to review this account order." },
          { status: 401 }
        );
      }
      const decodedToken = await adminAuth.verifyIdToken(authorization.substring(7));
      if (decodedToken.uid !== order.accountUid) {
        return NextResponse.json(
          { success: false, message: "This order does not belong to your account." },
          { status: 403 }
        );
      }
    }

    if (order.status !== "Delivered") {
      return NextResponse.json(
        {
          success: false,
          message: "Only delivered orders can be reviewed.",
        },
        { status: 403 }
      );
    }

    if (String(order.orderNumber || "").toUpperCase() !== orderNumber.toUpperCase()) {
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

    const resolvedOrderId = orderRef.id;
    const reviewId = createHash("sha256")
      .update(`${resolvedOrderId}_${productId}`)
      .digest("hex");

    const reviewRef = adminDb.collection("reviews").doc(reviewId);
    const rateLimitId = createHash("sha256").update(phone).digest("hex");
    const rateLimitRef = adminDb.collection("reviewRateLimits").doc(rateLimitId);

    await adminDb.runTransaction(async (transaction) => {
      const existingReview = await transaction.get(reviewRef);
      const rateLimitSnapshot = await transaction.get(rateLimitRef);

      if (existingReview.exists) {
        throw new Error("REVIEW_ALREADY_EXISTS");
      }

      const now = Date.now();
      const rateLimitData = rateLimitSnapshot.data();
      const windowStartedAtMs = Number(rateLimitData?.windowStartedAtMs || 0);
      const previousCount = Number(rateLimitData?.count || 0);
      const windowMs = 60 * 60 * 1000;

      const windowExpired =
        !windowStartedAtMs ||
        now - windowStartedAtMs >= windowMs ||
        now < windowStartedAtMs;

      const currentCount = windowExpired ? 0 : previousCount;

      if (currentCount >= 5) {
        throw new Error("REVIEW_RATE_LIMITED");
      }

      transaction.set(rateLimitRef, {
        windowStartedAtMs: windowExpired ? now : windowStartedAtMs,
        count: currentCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(reviewRef, {
        productId,
        productName: String(purchasedItem.name || "Product"),
        orderId: resolvedOrderId,
        orderNumber: String(order.orderNumber || orderNumber.toUpperCase()),
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
      error.message === "REVIEW_RATE_LIMITED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You have submitted too many reviews. Please try again later.",
        },
        { status: 429 }
      );
    }

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
