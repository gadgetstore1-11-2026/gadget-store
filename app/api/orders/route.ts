import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type OrderRequest = {
  customer?: {
    name?: string;
    phone?: string;
    district?: string;
    address?: string;
  };
  items?: {
    id?: string | number;
    quantity?: number;
  }[];
};

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as OrderRequest;

    const customer = data.customer;
    const items = data.items;

    // Validate customer information
    if (
      !customer ||
      typeof customer.name !== "string" ||
      customer.name.trim().length < 2 ||
      customer.name.trim().length > 100 ||
      typeof customer.phone !== "string" ||
      !/^01[3-9]\d{8}$/.test(customer.phone.trim()) ||
      typeof customer.district !== "string" ||
      customer.district.trim().length < 2 ||
      customer.district.trim().length > 100 ||
      typeof customer.address !== "string" ||
      customer.address.trim().length < 8 ||
      customer.address.trim().length > 500
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid customer information." },
        { status: 400 }
      );
    }

    // Validate order items
    if (
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid order items." },
        { status: 400 }
      );
    }

    // Load trusted product information from Firestore
    const orderItems = await Promise.all(
      items.map(async (item) => {
        const productId = String(item.id ?? "");
        const quantity = Number(item.quantity);

        if (
          !productId ||
          productId.includes("/") ||
          productId.length > 150 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 10
        ) {
          throw new Error("Invalid product or quantity.");
        }

        const productDoc = await adminDb
          .collection("products")
          .doc(productId)
          .get();

        if (!productDoc.exists) {
          throw new Error("A selected product is unavailable.");
        }

        const product = productDoc.data()!;

        const price = Number(product.price);

        if (
          typeof product.name !== "string" ||
          !product.name.trim() ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          throw new Error("Invalid product information.");
        }

        return {
          id: productDoc.id,
          name: product.name,
          price,
          quantity,
          emoji: product.emoji || "📦",
          imageUrl: product.imageUrl || "",
        };
      })
    );

    // Calculate subtotal using database prices
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (!Number.isSafeInteger(Math.round(subtotal * 100))) {
      throw new Error("Invalid order total.");
    }

    // Load store delivery settings
    const settingsDoc = await adminDb
      .collection("settings")
      .doc("store")
      .get();

    const settings = settingsDoc.exists
      ? settingsDoc.data()!
      : {};

    const deliveryCharge = Number(
      settings.deliveryCharge ?? 80
    );

    const freeDeliveryMinimum = Number(
      settings.freeDeliveryMinimum ?? 3000
    );

    if (
      !Number.isFinite(deliveryCharge) ||
      deliveryCharge < 0 ||
      !Number.isFinite(freeDeliveryMinimum) ||
      freeDeliveryMinimum < 0
    ) {
      throw new Error("Invalid delivery settings.");
    }

    const finalDeliveryCharge =
      subtotal >= freeDeliveryMinimum ? 0 : deliveryCharge;

    const total = subtotal + finalDeliveryCharge;

    // Generate a unique order number
    const orderNumber =
      `GS-${Date.now().toString().slice(-8)}-${randomBytes(2)
        .toString("hex")
        .toUpperCase()}`;

    // Create order
    const order = {
      orderNumber,

      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        district: customer.district.trim(),
        address: customer.address.trim(),
      },

      items: orderItems,

      subtotal,
      deliveryCharge: finalDeliveryCharge,
      total,

      paymentMethod: "Cash on Delivery",
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    const orderRef = await adminDb
      .collection("orders")
      .add(order);

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
      total,
    });
  } catch (error) {
    console.error("Order creation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to place order.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}