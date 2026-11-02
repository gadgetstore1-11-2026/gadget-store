import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

async function verifyAdmin(request: NextRequest) {
const authorization = request.headers.get("authorization");

if (!authorization?.startsWith("Bearer ")) return false;

try {
const token = authorization.substring(7);
const decodedToken = await adminAuth.verifyIdToken(token);
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
const reviewId = String(body.reviewId || "").trim();
const status = body.status;

if (
  !reviewId ||
  reviewId.includes("/") ||
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

const reviewId = request.nextUrl.searchParams.get("reviewId");

if (!reviewId || reviewId.includes("/")) {
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

await reviewRef.delete();

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
