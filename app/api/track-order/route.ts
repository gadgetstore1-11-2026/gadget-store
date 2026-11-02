import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toISOString(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString();
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const orderNumber =
      typeof body.orderNumber === "string"
        ? body.orderNumber.trim().toUpperCase()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    if (
      !orderNumber ||
      orderNumber.length > 60 ||
      !/^GS-[A-Z0-9-]+$/.test(orderNumber) ||
      !/^01[3-9]\d{8}$/.test(phone)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid order number and phone number.",
        },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("orders")
      .where("orderNumber", "==", orderNumber)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found. Please check your details.",
        },
        { status: 404 }
      );
    }

    const orderDoc = snapshot.docs[0];
    const order = orderDoc.data();

    const savedPhone = String(
      order.customer?.phone || ""
    ).trim();

    if (savedPhone !== phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found. Please check your details.",
        },
        { status: 404 }
      );
    }

    const items = Array.isArray(order.items)
      ? order.items.map((item: Record<string, unknown>) => ({
          name: String(item.name || "Product"),
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          imageUrl: String(item.imageUrl || ""),
        }))
      : [];

    return NextResponse.json(
      {
        success: true,
        order: {
          orderId: orderDoc.id,
          orderNumber: String(order.orderNumber || ""),
          customerName: String(order.customer?.name || ""),
          district: String(order.customer?.district || ""),
          items,
          subtotal: Number(order.subtotal || 0),
          deliveryCharge: Number(order.deliveryCharge || 0),
          rewardDiscount: Number(order.rewardDiscount || 0),
          total: Number(order.total || 0),
          paymentMethod: String(
            order.paymentMethod || "Cash on Delivery"
          ),
          status: String(order.status || "Pending"),
          createdAt: toISOString(order.createdAt),
          statusUpdatedAt: toISOString(order.statusUpdatedAt),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Order tracking failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to track your order. Please try again.",
      },
      { status: 500 }
    );
  }
}