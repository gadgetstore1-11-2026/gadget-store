import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

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

    const customerRef = adminDb
      .collection("customerAccounts")
      .doc(decodedToken.uid);

    const customerDoc = await customerRef.get();

    if (!customerDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Customer profile not found." },
        { status: 404 }
      );
    }

    const customer = customerDoc.data()!;

    const ordersSnapshot = await adminDb
      .collection("orders")
      .where("accountUid", "==", decodedToken.uid)
      .get();

    const orders = ordersSnapshot.docs.map((doc) => {
      const data = doc.data();

      const createdAt =
        typeof data.createdAt === "string"
          ? data.createdAt
          : data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : "";

      return {
        id: doc.id,
        orderNumber: data.orderNumber || "",
        status: data.status || "Pending",
        total: Number(data.total || 0),
        subtotal: Number(data.subtotal || 0),
        deliveryCharge: Number(data.deliveryCharge || 0),
        items: Array.isArray(data.items) ? data.items : [],
        createdAt,
      };
    });

    orders.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    return NextResponse.json(
      {
        success: true,
        customer: {
          name: customer.name || "",
          phone: customer.phone || "",
          createdAt: customer.createdAt?.toDate
            ? customer.createdAt.toDate().toISOString()
            : String(customer.createdAt || ""),
        },
        orders,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Customer dashboard API failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load your account." },
      { status: 500 }
    );
  }
}

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

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").replace(/\D/g, "");

    if (!name || !/^01[3-9]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Invalid name or phone number." },
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

    const customerRef = adminDb
      .collection("customerAccounts")
      .doc(decodedToken.uid);

    const existingCustomer = await customerRef.get();

    await customerRef.set(
      {
        uid: decodedToken.uid,
        name,
        phone,
        createdAt: existingCustomer.exists
          ? existingCustomer.data()?.createdAt || FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Customer profile saved successfully.",
    });
  } catch (error) {
    console.error("Customer profile registration failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to save customer profile." },
      { status: 500 }
    );
  }
}