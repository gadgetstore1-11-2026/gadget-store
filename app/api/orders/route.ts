import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const divisions = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
] as const;

type Division = (typeof divisions)[number];

type OrderRequest = {
  customer?: {
    name?: string;
    phone?: string;
    division?: string;
    district?: string;
    address?: string;
  };
  items?: {
    id?: string | number;
    quantity?: number;
  }[];
  redeemPoints?: number;
};

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as OrderRequest;

    const customer = data.customer;
    const items = data.items;
    const redeemPoints = data.redeemPoints ?? 0;

    if (
      !customer ||
      typeof customer.name !== "string" ||
      customer.name.trim().length < 2 ||
      customer.name.trim().length > 100 ||
      typeof customer.phone !== "string" ||
      !/^01[3-9]\d{8}$/.test(customer.phone.trim()) ||
      typeof customer.division !== "string" ||
      !divisions.includes(customer.division as Division) ||
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

    if (
      !Number.isSafeInteger(redeemPoints) ||
      redeemPoints < 0 ||
      redeemPoints % 100 !== 0
    ) {
      return NextResponse.json(
        { success: false, error: "Points must be used in multiples of 100." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      return NextResponse.json(
        { success: false, error: "Invalid order items." },
        { status: 400 }
      );
    }

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

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (
      !Number.isSafeInteger(Math.round(subtotal * 100)) ||
      subtotal <= 0
    ) {
      throw new Error("Invalid order total.");
    }

    const settingsDoc = await adminDb
      .collection("settings")
      .doc("store")
      .get();

    const settings = settingsDoc.exists
      ? settingsDoc.data()!
      : {};

    const division = customer.division as Division;
    const savedDivisionCharges =
      settings.divisionDeliveryCharges &&
      typeof settings.divisionDeliveryCharges === "object"
        ? settings.divisionDeliveryCharges
        : {};

    const hasDivisionCharge = Object.prototype.hasOwnProperty.call(
      savedDivisionCharges,
      division
    );

    const deliveryCharge = Number(
      hasDivisionCharge
        ? savedDivisionCharges[division]
        : settings.deliveryCharge ?? 80
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

    const customerData = {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      division,
      district: customer.district.trim(),
      address: customer.address.trim(),
    };
let accountUid: string | undefined;

const authorization = request.headers.get("authorization");

if (authorization) {
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Invalid authentication." },
      { status: 401 }
    );
  }

  const token = authorization.substring(7);
  const decodedToken = await adminAuth.verifyIdToken(token);

  const expectedEmail =
    `${customerData.phone}@accounts.gadgetstore.com`;

  if (decodedToken.email !== expectedEmail) {
    return NextResponse.json(
      { success: false, error: "Account phone number mismatch." },
      { status: 403 }
    );
  }

  accountUid = decodedToken.uid;
}


    const customerId = createHash("sha256")
      .update(customerData.phone)
      .digest("hex");

    const customerRef = adminDb
      .collection("customers")
      .doc(customerId);

    const orderNumber =
      `GS-${Date.now().toString().slice(-8)}-${randomBytes(2)
        .toString("hex")
        .toUpperCase()}`;

    const now = new Date().toISOString();

    const orderRef = adminDb.collection("orders").doc();
    const redemptionLedgerRef = adminDb
      .collection("rewardTransactions")
      .doc(`${orderRef.id}_redeem`);

    let finalTotal = 0;
    let finalDiscount = 0;

    await adminDb.runTransaction(async (transaction) => {
      const customerDoc = await transaction.get(customerRef);

      const existingCustomer = customerDoc.exists
        ? customerDoc.data()!
        : {};

      const availablePoints = Math.max(
        0,
        Math.floor(Number(existingCustomer.rewardPoints) || 0)
      );

      if (redeemPoints > availablePoints) {
        throw new Error(
          `Insufficient reward points. Available points: ${availablePoints}.`
        );
      }

      const discount = (redeemPoints / 100) * 50;

      if (discount > subtotal) {
        throw new Error(
          "Reward discount cannot exceed the product subtotal."
        );
      }

      const total = subtotal - discount + finalDeliveryCharge;

      if (
        !Number.isSafeInteger(Math.round(total * 100)) ||
        total < 0
      ) {
        throw new Error("Invalid final order total.");
      }

      const totalOrders =
        Number(existingCustomer.totalOrders || 0) + 1;

      const totalSpent =
        Number(existingCustomer.totalSpent || 0) + total;

      const customerRecord = {
        ...customerData,
        customerId,
        rewardPoints: availablePoints - redeemPoints,
        totalOrders,
        totalSpent,
        firstOrderAt: existingCustomer.firstOrderAt || now,
        lastOrderAt: now,
        updatedAt: now,
      };

      const order = {
       orderNumber,
customerId,
...(accountUid ? { accountUid } : {}),
customer: customerData,
        items: orderItems,
        subtotal,
        deliveryCharge: finalDeliveryCharge,
        rewardPointsUsed: redeemPoints,
        rewardDiscount: discount,
        total,
        paymentMethod: "Cash on Delivery",
        status: "Pending",
        createdAt: now,
      };

      transaction.set(customerRef, customerRecord, {
        merge: true,
      });

      transaction.create(orderRef, order);

      // Record reward points redemption.
      if (redeemPoints > 0) {
        transaction.create(redemptionLedgerRef, {
          customerId,
          orderId: orderRef.id,
          orderNumber,
          type: "redeem",
          points: -redeemPoints,
          discount,
          description: "Points redeemed for order",
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      finalTotal = total;
      finalDiscount = discount;
    });

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
      total: finalTotal,
      rewardPointsUsed: redeemPoints,
      rewardDiscount: finalDiscount,
    });
  } catch (error) {
    console.error("Order creation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to place order.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
