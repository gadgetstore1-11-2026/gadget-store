import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

export async function GET(request: NextRequest) {
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

    const customerId = request.nextUrl.searchParams.get("customerId");

    if (!customerId || !/^[a-f0-9]{64}$/i.test(customerId)) {
      return NextResponse.json(
        { success: false, error: "Invalid customer ID." },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("rewardTransactions")
      .where("customerId", "==", customerId)
      .limit(500)
      .get();

    const transactions = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;

      return {
        id: doc.id,
        customerId: String(data.customerId || ""),
        orderId: String(data.orderId || ""),
        orderNumber: String(data.orderNumber || ""),
        type: String(data.type || ""),
        points: Number(data.points || 0),
        discount: Number(data.discount || 0),
        description: String(data.description || ""),
        createdAt:
          createdAt && typeof createdAt.toDate === "function"
            ? createdAt.toDate().toISOString()
            : "",
      };
    });

    transactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Reward transaction loading failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load reward history." },
      { status: 500 }
    );
  }
}
