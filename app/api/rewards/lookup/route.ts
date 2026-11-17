import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizePhone, isValidBangladeshPhone } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const phone =
      typeof body.phone === "string" ? normalizePhone(body.phone) : "";

    if (!isValidBangladeshPhone(phone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Bangladesh mobile number." },
        { status: 400 }
      );
    }

    const expectedEmail = `${phone}@accounts.gadgetstore.com`;

    if (decodedToken.email !== expectedEmail) {
      return NextResponse.json(
        { success: false, error: "Account phone number mismatch." },
        { status: 403 }
      );
    }

    const accountDoc = await adminDb
      .collection("customerAccounts")
      .doc(decodedToken.uid)
      .get();

    if (
      !accountDoc.exists ||
      accountDoc.data()?.phone !== phone
    ) {
      return NextResponse.json(
        { success: false, error: "Customer account verification failed." },
        { status: 403 }
      );
    }

    const customerId = createHash("sha256")
      .update(phone)
      .digest("hex");

    const customerDoc = await adminDb
      .collection("customers")
      .doc(customerId)
      .get();

    const rawRewardPoints = customerDoc.exists
      ? customerDoc.data()?.rewardPoints
      : undefined;

    const points = rawRewardPoints === undefined ? 0 : rawRewardPoints;

    if (
      typeof points !== "number" ||
      !Number.isSafeInteger(points) ||
      points < 0
    ) {
      throw new Error("Customer reward balance is invalid.");
    }

    return NextResponse.json(
      {
        success: true,
        availablePoints: points,
        discountValue: Math.floor(points / 100) * 50,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Reward points lookup failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to check reward points." },
      { status: 500 }
    );
  }
}