import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";
const PAGE_SIZE = 50;
const VALID_TYPES = new Set(["earn", "redeem", "reverse", "refund"]);

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
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    if (decodedToken.uid !== ADMIN_UID) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;
    const customerId = params.get("customerId");
    const cursor = params.get("cursor");

    if (!customerId || !/^[a-f0-9]{64}$/i.test(customerId)) {
      return NextResponse.json(
        { success: false, error: "Invalid customer ID." },
        { status: 400 }
      );
    }

    if (cursor !== null && (
      cursor.length === 0 ||
      cursor.length > 1500 ||
      cursor.includes("/")
    )) {
      return NextResponse.json(
        { success: false, error: "Invalid pagination cursor." },
        { status: 400 }
      );
    }

    const collection = adminDb.collection("rewardTransactions");

    let cursorSnapshot = null;

    if (cursor) {
      cursorSnapshot = await collection.doc(cursor).get();

      if (
        !cursorSnapshot.exists ||
        cursorSnapshot.data()?.customerId !== customerId ||
        !cursorSnapshot.data()?.createdAt ||
        typeof cursorSnapshot.data()?.createdAt.toDate !== "function"
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid pagination cursor." },
          { status: 400 }
        );
      }
    }

    let query = collection
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE + 1);

    if (cursorSnapshot) {
      query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > PAGE_SIZE;
    const pageDocs = snapshot.docs.slice(0, PAGE_SIZE);

    const transactions = pageDocs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;

      if (
        data.customerId !== customerId ||
        typeof data.customerId !== "string" ||
        !/^[a-f0-9]{64}$/i.test(data.customerId)
      ) {
        throw new Error(`Invalid customer ID in reward transaction: ${doc.id}`);
      }

      if (
        typeof data.type !== "string" ||
        !VALID_TYPES.has(data.type)
      ) {
        throw new Error(`Invalid transaction type: ${doc.id}`);
      }

      if (
        typeof data.points !== "number" ||
        !Number.isSafeInteger(data.points)
      ) {
        throw new Error(`Invalid points value: ${doc.id}`);
      }

      if (
        (data.type === "earn" && data.points < 0) ||
        (data.type === "redeem" && data.points >= 0) ||
        (data.type === "reverse" && data.points > 0) ||
        (data.type === "refund" && data.points <= 0)
      ) {
        throw new Error(`Invalid points direction: ${doc.id}`);
      }

      const discount = data.discount === undefined ? 0 : data.discount;

      if (
        typeof discount !== "number" ||
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error(`Invalid discount value: ${doc.id}`);
      }

      if (
        (data.orderId !== undefined && typeof data.orderId !== "string") ||
        (data.orderNumber !== undefined && typeof data.orderNumber !== "string") ||
        (data.description !== undefined && typeof data.description !== "string")
      ) {
        throw new Error(`Invalid transaction metadata: ${doc.id}`);
      }

      if (!createdAt || typeof createdAt.toDate !== "function") {
        throw new Error(`Invalid transaction timestamp: ${doc.id}`);
      }

      const createdAtDate = createdAt.toDate();

      if (!(createdAtDate instanceof Date) || !Number.isFinite(createdAtDate.getTime())) {
        throw new Error(`Invalid transaction timestamp: ${doc.id}`);
      }

      return {
        id: doc.id,
        customerId: data.customerId,
        orderId: data.orderId ?? "",
        orderNumber: data.orderNumber ?? "",
        type: data.type,
        points: data.points,
        discount,
        description: data.description ?? "",
        createdAt: createdAtDate.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        pageSize: PAGE_SIZE,
        hasMore,
        nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("Reward transaction loading failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load reward history." },
      { status: 500 }
    );
  }
}