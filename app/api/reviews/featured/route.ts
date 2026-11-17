import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("reviews")
      .where("status", "==", "Approved")
      .orderBy("createdAt", "desc")
      .limit(6)
      .get();

    const reviews = snapshot.docs.map((reviewDoc) => {
      const data = reviewDoc.data();
      return {
        id: reviewDoc.id,
        productName: String(data.productName || "Product"),
        customerName: String(data.customerName || "Verified Customer"),
        rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
        comment: String(data.comment || "").slice(0, 1000),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json(
      { success: true, reviews },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Featured review loading error:", error);
    return NextResponse.json(
      { success: false, message: "Could not load customer reviews." },
      { status: 500 }
    );
  }
}
