import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizePhone, isValidBangladeshPhone } from "@/lib/customer-auth";

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
  couponCode?: string;
  paymentMethod?: "bKash" | "Nagad";
  paymentChoice?: "delivery" | "full" | "request_later";
  transactionId?: string;
  senderNumber?: string;
};

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as OrderRequest;

    const customer = data.customer;
    const items = data.items;
    const redeemPoints = data.redeemPoints ?? 0;
    const couponCode = typeof data.couponCode === "string" ? data.couponCode.trim().toUpperCase() : "";
    const paymentMethod = data.paymentMethod;
    const paymentChoice = data.paymentChoice;
    const transactionId = typeof data.transactionId === "string" ? data.transactionId.trim().toUpperCase() : "";
    const senderNumber = typeof data.senderNumber === "string" ? normalizePhone(data.senderNumber) : "";
    if (!( ["bKash", "Nagad"] as const).includes(paymentMethod as "bKash" | "Nagad") || !( ["delivery", "full", "request_later"] as const).includes(paymentChoice as "delivery" | "full" | "request_later")) return NextResponse.json({ success: false, error: "Please select a valid payment method and option." }, { status: 400 });
    if (paymentChoice !== "request_later" && (transactionId.length < 5 || transactionId.length > 30 || !/^[A-Z0-9]+$/.test(transactionId) || !isValidBangladeshPhone(senderNumber))) return NextResponse.json({ success: false, error: "Valid transaction ID and sender mobile number are required." }, { status: 400 });

    if (
      !customer ||
      typeof customer.name !== "string" ||
      customer.name.trim().length < 2 ||
      customer.name.trim().length > 100 ||
      typeof customer.phone !== "string" ||
      !isValidBangladeshPhone(customer.phone) ||
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
    const paymentAccountNumber = paymentMethod === "bKash" ? settings.bkashNumber : settings.nagadNumber;
    if (paymentChoice !== "request_later" && (typeof paymentAccountNumber !== "string" || !paymentAccountNumber.trim())) return NextResponse.json({ success: false, error: `The ${paymentMethod} payment number is not configured.` }, { status: 400 });
    if (paymentChoice === "delivery" && finalDeliveryCharge <= 0) return NextResponse.json({ success: false, error: "No delivery charge is due. Please choose full payment or request admin approval." }, { status: 400 });

    let appliedCoupon: { code: string; type: "percentage" | "fixed"; value: number; minSubtotal: number; maxDiscount: number; active: boolean } | null = null;
    let couponDiscount = 0;
    if (couponCode) {
      const configuredCoupons = Array.isArray(settings.coupons) ? settings.coupons : [];
      const candidate = configuredCoupons.find((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const coupon = item as Record<string, unknown>;
        return typeof coupon.code === "string" && coupon.code.trim().toUpperCase() === couponCode;
      }) as Record<string, unknown> | undefined;
      if (!candidate || candidate.active !== true || (candidate.type !== "percentage" && candidate.type !== "fixed") || typeof candidate.value !== "number" || !Number.isFinite(candidate.value) || candidate.value <= 0 || typeof candidate.minSubtotal !== "number" || !Number.isFinite(candidate.minSubtotal) || candidate.minSubtotal < 0 || typeof candidate.maxDiscount !== "number" || !Number.isFinite(candidate.maxDiscount) || candidate.maxDiscount < 0 || (candidate.type === "percentage" && candidate.value > 100)) {
        return NextResponse.json({ success: false, error: "This coupon is invalid or inactive." }, { status: 400 });
      }
      if (subtotal < candidate.minSubtotal) return NextResponse.json({ success: false, error: `Minimum order subtotal for this coupon is ৳${candidate.minSubtotal.toLocaleString("en-BD")}.` }, { status: 400 });
      appliedCoupon = { code: couponCode, type: candidate.type as "percentage" | "fixed", value: candidate.value as number, minSubtotal: candidate.minSubtotal as number, maxDiscount: candidate.maxDiscount as number, active: true };
      couponDiscount = appliedCoupon.type === "percentage" ? Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount > 0 ? appliedCoupon.maxDiscount : subtotal) : Math.min(appliedCoupon.value, subtotal);
      couponDiscount = Math.round(couponDiscount * 100) / 100;
    }

    const customerData = {
      name: customer.name.trim(),
      phone: normalizePhone(customer.phone),
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
  const decodedToken = await adminAuth.verifyIdToken(token, true);

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



if (redeemPoints > 0) {
  if (!accountUid) {
    return NextResponse.json(
      {
        success: false,
        error: "Please log in to redeem reward points.",
      },
      { status: 401 }
    );
  }

  const accountDoc = await adminDb
    .collection("customerAccounts")
    .doc(accountUid)
    .get();

  if (
    !accountDoc.exists ||
    accountDoc.data()?.phone !== customerData.phone
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Customer account verification failed.",
      },
      { status: 403 }
    );
  }
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

      const rawRewardPoints = existingCustomer.rewardPoints;
      const availablePoints =
        rawRewardPoints === undefined ? 0 : rawRewardPoints;

      if (
        typeof availablePoints !== "number" ||
        !Number.isSafeInteger(availablePoints) ||
        availablePoints < 0
      ) {
        throw new Error(
          "Customer reward balance is invalid. Please contact support."
        );
      }

      if (redeemPoints > availablePoints) {
        throw new Error(
          `Insufficient reward points. Available points: ${availablePoints}.`
        );
      }

      const discount = (redeemPoints / 100) * 50;

      if (discount > subtotal - couponDiscount) {
        throw new Error(
          "Reward discount cannot exceed the product subtotal."
        );
      }

      const total = subtotal - couponDiscount - discount + finalDeliveryCharge;
      const paymentAmount = paymentChoice === "full" ? total : finalDeliveryCharge;

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
        couponCode: appliedCoupon?.code || "",
        couponDiscount,
        total,
        paymentMethod: `${paymentMethod} ${paymentChoice === "full" ? "Full Payment" : paymentChoice === "delivery" ? "Delivery Charge Advance + COD" : "Delivery Charge Later Request"}`,
        paymentChoice,
        paymentAmount,
        paymentStatus: paymentChoice === "request_later" ? "Awaiting Admin Approval" : "Pending Verification",
        paymentTransactionId: paymentChoice === "request_later" ? "" : transactionId,
        paymentSenderNumber: paymentChoice === "request_later" ? "" : senderNumber,
        paymentAccountNumber: paymentChoice === "request_later" ? "" : paymentAccountNumber,
        deliveryChargeLaterStatus: paymentChoice === "request_later" ? "Pending" : "Not Requested",
        deliveryChargePaid: false,
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

    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    const authenticationErrors = [
      "auth/argument-error",
      "auth/invalid-id-token",
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/user-disabled",
      "auth/user-not-found",
    ];

    if (authenticationErrors.includes(errorCode)) {
      return NextResponse.json(
        { success: false, error: "Authentication failed. Please log in again." },
        { status: 401 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to place order.";

    const status =
      message === "Customer reward balance is invalid. Please contact support."
        ? 409
        : 400;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
