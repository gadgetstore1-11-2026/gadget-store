import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { AggregateField } from "firebase-admin/firestore";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

async function refreshProductRating(productId: string) {
  if (!productId) return;

  const [productSnapshot, reviewsSnapshot] = await Promise.all([
    adminDb.collection("products").doc(productId).get(),
    adminDb.collection("reviews").where("productId", "==", productId).get(),
  ]);

  if (!productSnapshot.exists) return;

  const approvedRatings = reviewsSnapshot.docs
    .map((reviewDoc) => reviewDoc.data())
    .filter((review) => review.status === "Approved")
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);

  const reviewCount = approvedRatings.length;
  const rating = reviewCount
    ? Number((approvedRatings.reduce((total, value) => total + value, 0) / reviewCount).toFixed(1))
    : 0;

  await adminDb.collection("products").doc(productId).update({
    rating,
    reviewCount,
    ratingUpdatedAt: new Date(),
  });
}

async function verifyAdmin(request: NextRequest) {
const authorization = request.headers.get("authorization");

if (!authorization?.startsWith("Bearer ")) return false;

try {
const token = authorization.substring(7);
const decodedToken = await adminAuth.verifyIdToken(token, true);
return decodedToken.uid === ADMIN_UID;
} catch {
return false;
}
}

export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      );
    }

    const params = request.nextUrl.searchParams;
    const pageSizeParam = params.get("pageSize");

    // Preserve the existing response for older API clients.
    if (pageSizeParam === null) {
      const snapshot = await adminDb.collection("reviews").get();

      const reviews = snapshot.docs.map((reviewDoc) => {
        const data = reviewDoc.data();
        return {
          id: reviewDoc.id,
          productId: data.productId || "",
          productName: data.productName || "Product",
          orderId: data.orderId || "",
          orderNumber: data.orderNumber || "",
          customerName: data.customerName || "Customer",
          customerPhone: data.customerPhone || "",
          rating: Number(data.rating || 0),
          comment: data.comment || "",
          status: data.status || "Pending",
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      reviews.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      return NextResponse.json({
        success: true,
        reviews,
        total: reviews.length,
      });
    }

    const pageSize = 20;
    const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
    const status = params.get("status") || "All";
    const search = (params.get("search") || "").trim().toLowerCase();
    const cursor = params.get("cursor") || "";

    if (!["All", "Pending", "Approved", "Rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid review status filter." },
        { status: 400 }
      );
    }

    if (search.length > 100 || cursor.length > 150) {
      return NextResponse.json(
        { success: false, message: "Invalid pagination parameters." },
        { status: 400 }
      );
    }

    const reviewsRef = adminDb.collection("reviews");

    const [
      totalSnapshot,
      pendingSnapshot,
      approvedSnapshot,
      rejectedSnapshot,
      averageSnapshot,
    ] = await Promise.all([
      reviewsRef.count().get(),
      reviewsRef.where("status", "==", "Pending").count().get(),
      reviewsRef.where("status", "==", "Approved").count().get(),
      reviewsRef.where("status", "==", "Rejected").count().get(),
      reviewsRef.aggregate({
        averageRating: AggregateField.average("rating"),
      }).get(),
    ]);

    const stats = {
      total: totalSnapshot.data().count,
      pending: pendingSnapshot.data().count,
      approved: approvedSnapshot.data().count,
      rejected: rejectedSnapshot.data().count,
      averageRating: Number(averageSnapshot.data().averageRating || 0),
    };

    const mapReview = (reviewDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = reviewDoc.data();

      return {
        id: reviewDoc.id,
        productId: data.productId || "",
        productName: data.productName || "Product",
        orderId: data.orderId || "",
        orderNumber: data.orderNumber || "",
        customerName: data.customerName || "Customer",
        customerPhone: data.customerPhone || "",
        rating: Number(data.rating || 0),
        comment: data.comment || "",
        status: data.status || "Pending",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    };

    // Search retains the previous full-review search behavior.
    if (search) {
      const snapshot = await reviewsRef.get();

      const allReviews = snapshot.docs
        .map((doc) => ({
          doc,
          review: mapReview(doc),
        }))
        .filter(({ review }) => {
          const matchesStatus =
            status === "All" || review.status === status;

          const searchableText = [
            review.customerName,
            review.customerPhone,
            review.productName,
            review.orderNumber,
            review.comment,
          ].join(" ").toLowerCase();

          return matchesStatus && searchableText.includes(search);
        })
        .sort(
          (a, b) =>
            new Date(b.review.createdAt || 0).getTime() -
            new Date(a.review.createdAt || 0).getTime()
        );

      const total = allReviews.length;
      const start = (page - 1) * pageSize;
      const selected = allReviews.slice(start, start + pageSize);

      return NextResponse.json({
        success: true,
        reviews: selected.map((item) => item.review),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
        nextCursor: null,
        stats,
      });
    }

    let query = reviewsRef.orderBy("createdAt", "desc");

    if (cursor) {
      const cursorSnapshot = await reviewsRef.doc(cursor).get();

      if (!cursorSnapshot.exists) {
        return NextResponse.json(
          { success: false, message: "Invalid pagination cursor." },
          { status: 400 }
        );
      }

      query = query.startAfter(cursorSnapshot);
    }

    const matchingDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let scanQuery = query;
    let hasMore = false;
    let exhausted = false;

    while (matchingDocs.length <= pageSize && !exhausted) {
      const batch = await scanQuery.limit(100).get();

      if (batch.empty) {
        exhausted = true;
        break;
      }

      for (const doc of batch.docs) {
        const data = doc.data();
        const matchesStatus =
          status === "All" || data.status === status;

        if (matchesStatus) {
          matchingDocs.push(doc);

          if (matchingDocs.length > pageSize) {
            hasMore = true;
            break;
          }
        }
      }

      if (hasMore || batch.size < 100) {
        exhausted = true;
      } else {
        const lastDoc = batch.docs[batch.docs.length - 1];
        scanQuery = query.firestore
          .collection("reviews")
          .orderBy("createdAt", "desc")
          .startAfter(lastDoc);
      }
    }

    const selectedDocs = matchingDocs.slice(0, pageSize);
    const nextCursor =
      hasMore && selectedDocs.length
        ? selectedDocs[selectedDocs.length - 1].id
        : null;

    const total =
      status === "All"
        ? stats.total
        : status === "Pending"
          ? stats.pending
          : status === "Approved"
            ? stats.approved
            : stats.rejected;

    return NextResponse.json({
      success: true,
      reviews: selectedDocs.map(mapReview),
      total,
      page,
      pageSize,
      hasMore,
      nextCursor,
      stats,
    });
  } catch (error) {
    console.error("Admin reviews loading error:", error);

    return NextResponse.json(
      { success: false, message: "Could not load reviews." },
      { status: 500 }
    );
  }
}
export async function PATCH(request: NextRequest) {
try {
if (!(await verifyAdmin(request))) {
return NextResponse.json(
{ success: false, message: "Unauthorized access." },
{ status: 401 }
);
}

const body = await request.json();
const reviewId = typeof body.reviewId === "string" ? body.reviewId.trim() : "";
const status = body.status;

if (
  !reviewId ||
  reviewId.length > 128 ||
  reviewId.includes("/") ||
  /[\u0000-\u001F\u007F]/.test(reviewId) ||
  typeof status !== "string" ||
  !["Approved", "Rejected", "Pending"].includes(status)
) {
  return NextResponse.json(
    { success: false, message: "Invalid review information." },
    { status: 400 }
  );
}

const reviewRef = adminDb.collection("reviews").doc(reviewId);
const reviewSnapshot = await reviewRef.get();

if (!reviewSnapshot.exists) {
  return NextResponse.json(
    { success: false, message: "Review not found." },
    { status: 404 }
  );
}

await reviewRef.update({
  status,
  updatedAt: new Date(),
});

await refreshProductRating(String(reviewSnapshot.data()?.productId || ""));

return NextResponse.json({
  success: true,
  message: `Review ${status.toLowerCase()} successfully.`,
});

} catch (error) {
console.error("Review status update error:", error);

return NextResponse.json(
  { success: false, message: "Could not update review." },
  { status: 500 }
);

}
}

export async function DELETE(request: NextRequest) {
try {
if (!(await verifyAdmin(request))) {
return NextResponse.json(
{ success: false, message: "Unauthorized access." },
{ status: 401 }
);
}

const reviewId = (request.nextUrl.searchParams.get("reviewId") || "").trim();

if (
  !reviewId ||
  reviewId.length > 128 ||
  reviewId.includes("/") ||
  /[\u0000-\u001F\u007F]/.test(reviewId)
) {
  return NextResponse.json(
    { success: false, message: "Invalid review ID." },
    { status: 400 }
  );
}

const reviewRef = adminDb.collection("reviews").doc(reviewId);
const reviewSnapshot = await reviewRef.get();

if (!reviewSnapshot.exists) {
  return NextResponse.json(
    { success: false, message: "Review not found." },
    { status: 404 }
  );
}

const productId = String(reviewSnapshot.data()?.productId || "");
await reviewRef.delete();
await refreshProductRating(productId);

return NextResponse.json({
  success: true,
  message: "Review deleted successfully.",
});

} catch (error) {
console.error("Review deletion error:", error);

return NextResponse.json(
  { success: false, message: "Could not delete review." },
  { status: 500 }
);

}
}
