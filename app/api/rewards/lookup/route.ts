import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const phone =
      typeof data.phone === "string" ? data.phone.trim() : "";

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Bangladesh mobile number." },
        { status: 400 }
      );
    }

    const customerId = createHash("sha256")
      .update(phone)
      .digest("hex");

    const customerDoc = await adminDb
      .collection("customers")
      .doc(customerId)
      .get();

    const points = customerDoc.exists
      ? Math.max(0, Math.floor(Number(customerDoc.data()?.rewardPoints) || 0))
      : 0;

    return NextResponse.json({
      success: true,
      availablePoints: points,
      discountValue: Math.floor(points / 100) * 50,
    });
  } catch (error) {
    console.error("Reward points lookup failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to check reward points." },
      { status: 500 }
    );
  }
}
