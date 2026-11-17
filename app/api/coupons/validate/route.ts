import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type Coupon = { code: string; type: "percentage" | "fixed"; value: number; minSubtotal: number; maxDiscount: number; active: boolean };
function isValidCoupon(value: unknown): value is Coupon {
  if (!value || typeof value !== "object") return false;
  const coupon = value as Record<string, unknown>;
  return typeof coupon.code === "string" && (coupon.type === "percentage" || coupon.type === "fixed") && typeof coupon.value === "number" && Number.isFinite(coupon.value) && coupon.value > 0 && (coupon.type !== "percentage" || coupon.value <= 100) && typeof coupon.minSubtotal === "number" && Number.isFinite(coupon.minSubtotal) && coupon.minSubtotal >= 0 && typeof coupon.maxDiscount === "number" && Number.isFinite(coupon.maxDiscount) && coupon.maxDiscount >= 0 && coupon.active === true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const subtotal = Number(body.subtotal);
    if (!code || code.length > 40 || !Number.isFinite(subtotal) || subtotal <= 0) return NextResponse.json({ success: false, error: "Enter a valid coupon code." }, { status: 400 });
    const snapshot = await adminDb.collection("settings").doc("store").get();
    const coupons = snapshot.exists && Array.isArray(snapshot.data()?.coupons) ? snapshot.data()!.coupons as unknown[] : [];
    const coupon = coupons.find((item) => isValidCoupon(item) && item.code.trim().toUpperCase() === code);
    if (!coupon || !isValidCoupon(coupon)) return NextResponse.json({ success: false, error: "This coupon is invalid or inactive." }, { status: 404 });
    if (subtotal < coupon.minSubtotal) return NextResponse.json({ success: false, error: `Minimum order subtotal for this coupon is ৳${coupon.minSubtotal.toLocaleString("en-BD")}.` }, { status: 400 });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Coupon validation failed:", error);
    return NextResponse.json({ success: false, error: "Unable to validate coupon." }, { status: 500 });
  }
}
