"use client";
import Image from "next/image";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizePhone, isValidBangladeshPhone } from "@/lib/customer-auth";
import { createOrder } from "@/lib/orders";

type CartItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  emoji: string;
  color: string;
  image: string;
};
type Division =
  | "Dhaka"
  | "Chattogram"
  | "Rajshahi"
  | "Khulna"
  | "Barishal"
  | "Sylhet"
  | "Rangpur"
  | "Mymensingh";

type Customer = {
  name: string;
  phone: string;
  division: Division | "";
  district: string;
  address: string;
};

type Coupon = { code: string; type: "percentage" | "fixed"; value: number; minSubtotal: number; maxDiscount: number; active: boolean };

type StoreSettings = {
  divisionDeliveryCharges: Record<Division, number>;
  freeDeliveryMinimum: number;
  coupons: Coupon[];
  bkashNumber?: string;
  nagadNumber?: string;
};

const STORAGE_KEY = "gadget-store-cart";

const DEFAULT_SETTINGS: StoreSettings = {
  divisionDeliveryCharges: {
    Dhaka: 0,
    Chattogram: 0,
    Rajshahi: 0,
    Khulna: 0,
    Barishal: 0,
    Sylhet: 0,
    Rangpur: 0,
    Mymensingh: 0,
  },
  freeDeliveryMinimum: 3000,
  coupons: [],
  bkashNumber: "",
  nagadNumber: "",
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  division: "",
  district: "",
  address: "",
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(true);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"bKash" | "Nagad">("bKash");
  const [paymentNumberCopied, setPaymentNumberCopied] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"delivery" | "full" | "request_later">("delivery");
  const [transactionId, setTransactionId] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [orderPaymentInfo, setOrderPaymentInfo] = useState<{ amount: number; accountNumber: string; method: string; status: string } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const [storeSettings, setStoreSettings] =
    useState<StoreSettings>(DEFAULT_SETTINGS);

  const [settingsLoading, setSettingsLoading] = useState(true);

  // Reward points
  const [availablePoints, setAvailablePoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsChecked, setPointsChecked] = useState(false);

  // Format currency
  const money = (amount: number) =>
    `৳${amount.toLocaleString("en-BD")}`;

  const paymentAccountNumber = paymentMethod === "bKash" ? storeSettings.bkashNumber : storeSettings.nagadNumber;

  const copyPaymentNumber = async () => {
    if (!paymentAccountNumber) return;
    try {
      await navigator.clipboard.writeText(paymentAccountNumber);
      setPaymentNumberCopied(true);
      window.setTimeout(() => setPaymentNumberCopied(false), 2200);
    } catch {
      setError("Unable to copy the payment number. Please select and copy it manually.");
    }
  };

  // Load cart from local storage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed: unknown = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setCart(parsed as CartItem[]);
          }
        }
      } catch {
        setCart([]);
      } finally {
        setReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Save cart to local storage
  useEffect(() => {
    if (ready) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, ready]);

  // Load store settings from Firebase
useEffect(() => {
async function loadStoreSettings() {
try {
const settingsRef = doc(db, "settings", "store");
const snapshot = await getDoc(settingsRef);


    if (snapshot.exists()) {
      const data = snapshot.data();
      const savedCharges = data.divisionDeliveryCharges || {};

      const divisions: Division[] = [
        "Dhaka",
        "Chattogram",
        "Rajshahi",
        "Khulna",
        "Barishal",
        "Sylhet",
        "Rangpur",
        "Mymensingh",
      ];

      const divisionDeliveryCharges = {
        ...DEFAULT_SETTINGS.divisionDeliveryCharges,
      };

      divisions.forEach((division) => {
        const charge = savedCharges[division];

        if (
          typeof charge === "number" &&
          Number.isFinite(charge) &&
          charge >= 0
        ) {
          divisionDeliveryCharges[division] = charge;
        }
      });

      setStoreSettings({
        divisionDeliveryCharges,
        freeDeliveryMinimum:
          typeof data.freeDeliveryMinimum === "number" &&
          Number.isFinite(data.freeDeliveryMinimum) &&
          data.freeDeliveryMinimum >= 0
            ? data.freeDeliveryMinimum
            : DEFAULT_SETTINGS.freeDeliveryMinimum,
        coupons: Array.isArray(data.coupons) ? data.coupons : [],
        bkashNumber: typeof data.bkashNumber === "string" ? data.bkashNumber : "",
        nagadNumber: typeof data.nagadNumber === "string" ? data.nagadNumber : "",
      });
    }
  } catch (err) {
    console.error("Store settings loading failed:", err);
  } finally {
    setSettingsLoading(false);
  }
}

loadStoreSettings();


}, []);

  // Calculate subtotal
  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [cart]
  );

  // Calculate delivery fee
const selectedDeliveryCharge = customer.division
  ? storeSettings.divisionDeliveryCharges[customer.division]
  : 0;

const deliveryCharge =
  subtotal === 0
    ? 0
    : subtotal >= storeSettings.freeDeliveryMinimum
      ? 0
      : selectedDeliveryCharge;

const total = subtotal + deliveryCharge;

  // Calculate reward discount
  const couponDiscount = appliedCoupon
    ? Math.min(subtotal, appliedCoupon.type === "percentage"
        ? Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount > 0 ? appliedCoupon.maxDiscount : subtotal)
        : appliedCoupon.value)
    : 0;

  const maxRedeemablePoints = Math.min(
    Math.floor(availablePoints / 100) * 100,
    Math.floor(Math.max(0, subtotal - couponDiscount) / 50) * 100
  );

  const selectedRedeemPoints = Math.min(redeemPoints, maxRedeemablePoints);
  const rewardDiscount = (selectedRedeemPoints / 100) * 50;
  const finalTotal = Math.max(0, total - couponDiscount - rewardDiscount);

  useEffect(() => {
    if (appliedCoupon && subtotal < appliedCoupon.minSubtotal) {
      setAppliedCoupon(null);
      setCouponMessage("Coupon removed because the cart no longer meets its minimum subtotal.");
      setRedeemPoints(0);
    }
  }, [appliedCoupon, subtotal]);

  // Look up reward points using the customer's mobile number
  useEffect(() => {
    const phone = normalizePhone(customer.phone);

    const controller = new AbortController();
    let lookupTimer: number | undefined;

    const resetTimer = window.setTimeout(async () => {
      setAvailablePoints(0);
      setRedeemPoints(0);
      setPointsChecked(false);

      await auth.authStateReady();
    const user = auth.currentUser;

    if (!isValidBangladeshPhone(phone) || !user || user.email !== `${phone}@accounts.gadgetstore.com`) {
        setPointsLoading(false);
        return;
      }

      lookupTimer = window.setTimeout(async () => {
        setPointsLoading(true);

        try {
          const response = await fetch("/api/rewards/lookup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
            body: JSON.stringify({ phone }),
            signal: controller.signal,
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || "Points lookup failed.");
          }

          setAvailablePoints(
            Math.max(0, Math.floor(Number(result.availablePoints) || 0))
          );

          setPointsChecked(true);
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error("Reward points lookup failed:", err);
            setAvailablePoints(0);
            setPointsChecked(false);
          }
        } finally {
          if (!controller.signal.aborted) {
            setPointsLoading(false);
          }
        }
      }, 500);
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);

      if (lookupTimer !== undefined) {
        window.clearTimeout(lookupTimer);
      }

      controller.abort();
    };
  }, [customer.phone]);

  // Change product quantity
  function changeQuantity(id: string | number, change: number) {
    setCart((items) => items
      .map((item) => item.id === id ? { ...item, quantity: Math.min(10, item.quantity + change) } : item)
      .filter((item) => item.quantity > 0));
  }

  // Remove product from cart
  function removeItem(id: string | number) {
    setCart((items) => items.filter((item) => item.id !== id));
  }

  function clearCart() {
    setCart([]);
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMessage("");
    setRedeemPoints(0);
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponMessage("Please enter a coupon code."); return; }
    setCouponLoading(true);
    setCouponMessage("");
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.coupon) throw new Error(result.error || "This coupon is not valid.");
      setAppliedCoupon(result.coupon as Coupon);
      setRedeemPoints(0);
      setCouponMessage(`Coupon ${code} applied successfully.`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage(err instanceof Error ? err.message : "Unable to apply coupon.");
    } finally { setCouponLoading(false); }
  }

  // Update customer information
  function updateCustomer(field: keyof Customer, value: string) {
    setCustomer((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  }

  // Submit order
  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (settingsLoading) {
      setError("Store settings are loading. Please wait.");
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!isValidBangladeshPhone(customer.phone)) {
      setError(
        "Please enter a valid 11-digit Bangladesh mobile number."
      );
      return;
    }

    if (!customer.division) {
      setError("Please select your division.");
      return;
    }

    if (customer.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (customer.address.trim().length < 8) {
      setError("Please enter your complete delivery address.");
      return;
    }

    if (customer.district.trim().length < 2) {
      setError("Please enter your district name.");
      return;
    }

    if (paymentChoice !== "request_later") {
      if (transactionId.trim().length < 5) { setError("Please enter a valid transaction ID."); return; }
      if (!isValidBangladeshPhone(senderNumber)) { setError("Please enter a valid sender mobile number."); return; }
      const configuredNumber = paymentMethod === "bKash" ? storeSettings.bkashNumber : storeSettings.nagadNumber;
      if (!configuredNumber) { setError(`The ${paymentMethod} payment number is not configured. Please contact the store.`); return; }
    }

    setSubmitting(true);

    try {
      const result = await createOrder({
        customer: {
          name: customer.name.trim(),
          phone: normalizePhone(customer.phone),
          division: customer.division,
          district: customer.district.trim(),
          address: customer.address.trim(),
        },

        redeemPoints: selectedRedeemPoints,
        couponCode: appliedCoupon?.code || "",
        paymentMethod,
        paymentChoice,
        transactionId: transactionId.trim(),
        senderNumber: normalizePhone(senderNumber),
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          emoji: item.emoji,
        })),
      });

      if (!result.success || !result.orderId) {
        throw new Error("Unable to save your order.");
      }

      setOrderNumber(result.orderNumber);
      setOrderTotal(result.total);
      setOrderPaymentInfo({ amount: paymentChoice === "full" ? result.total : deliveryCharge, accountNumber: paymentMethod === "bKash" ? (storeSettings.bkashNumber || "") : (storeSettings.nagadNumber || ""), method: paymentMethod, status: paymentChoice === "request_later" ? "Awaiting Admin Approval" : "Pending Verification" });
      clearCart();
      setCheckoutOpen(false);
      setCustomer(emptyCustomer);

    } catch (err) {
      console.error("Order submission failed:", err);

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      setError(
        `Order failed: ${
          firebaseError.message ||
          firebaseError.code ||
          "Unknown error"
        }`
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Order success screen
  if (orderNumber) {
    return (
      <main className="cart-page">
        <div className="order-success">
          <div className="success-icon">✓</div>

          <span className="cart-eyebrow">
            ORDER CONFIRMATION
          </span>

          <h1>Thank You! Your Order Has Been Placed.</h1>

          <p>
            Your order has been received successfully.
            Our team will contact you if needed.
          </p>

          <div className="order-summary">
            <div>
              <span>Order Number</span>
              <strong>{orderNumber}</strong>
            </div>

            <div>
              <span>Payment Method</span>
              <strong>{orderPaymentInfo?.method || "Cash on Delivery"}</strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>{money(orderTotal)}</strong>
            </div>
          </div>

          {orderPaymentInfo && (
            <div className="order-summary" style={{ marginTop: 16, textAlign: "left" }}>
              <strong>Payment Status: {orderPaymentInfo.status}</strong>
              {orderPaymentInfo.status === "Pending Verification" ? <p>Payment amount: {money(orderPaymentInfo.amount)}. Send Money account: {orderPaymentInfo.accountNumber}. Admin will verify your transaction before confirming the order.</p> : <p>Your request to pay the delivery charge later is waiting for admin approval. The order cannot be confirmed until it is approved.</p>}
            </div>
          )}
          <Link href="/" className="cart-primary-button">
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  // Loading screen
  if (!ready) {
    return (
      <main className="cart-page">
        <p className="cart-loading">Loading your cart...</p>
      </main>
    );
  }

  return (
    <main className="cart-page">
      {/* Header */}
      <header className="cart-header">
        <Link href="/" className="cart-brand">
          <span className="cart-brand-icon">G</span>

          <span>
            <strong>GADGET</strong>
            <small>STORE</small>
          </span>
        </Link>

        <div className="secure-label">
          🔒 Secure Checkout
        </div>

        <Link href="/" className="continue-link">
          ← Continue Shopping
        </Link>
      </header>

      <div className="cart-container">
        {/* Breadcrumb */}
        <div className="cart-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/cart">Shopping Cart</Link><span>/</span><span>Delivery Information</span>
        </div>

        <div className="cart-title-row">
          <div>
            <span className="cart-eyebrow">SECURE CHECKOUT</span>
            <h1>Complete Your Order</h1>
            <p>Review your items and enter your delivery information below.</p>
          </div>
        </div>

        {/* Checkout Form */}
        {checkoutOpen && cart.length > 0 && (
          <section className="checkout-panel" id="checkout">
            <div className="checkout-heading">
              <span className="cart-eyebrow">
                ALMOST THERE
              </span>

              <h2>Delivery Information</h2>

              <p>
                Please enter your details to complete your order.
              </p>
            </div>

            <section className="checkout-order-summary" aria-labelledby="checkout-order-summary-title">
              <div className="checkout-order-summary-heading">
                <h3 id="checkout-order-summary-title">Your Order</h3>
                <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
              </div>

              <div className="checkout-order-items">
                {cart.map((item) => (
                  <article className="checkout-order-item" key={item.id}>
                    <div className="checkout-order-image" style={{ backgroundColor: item.color || "#f4f1ff" }}>
                      {item.image ? (
                        <Image src={item.image} alt={item.name} width={76} height={76} unoptimized />
                      ) : (
                        <span>{item.emoji || "📦"}</span>
                      )}
                    </div>
                    <div className="checkout-order-item-details">
                      <span>{item.category}</span>
                      <strong>{item.name}</strong>
                      <small>Qty: {item.quantity} × {money(item.price)}</small>
                    </div>
                    <strong className="checkout-order-item-total">{money(item.price * item.quantity)}</strong>
                  </article>
                ))}
              </div>

              <div className="checkout-order-totals">
                <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div>
                  <span>Delivery Charge</span>
                  <strong>{customer.division ? money(deliveryCharge) : "Calculated after selecting division"}</strong>
                </div>
                {couponDiscount > 0 && <div className="checkout-order-discount"><span>Coupon Discount</span><strong>-{money(couponDiscount)}</strong></div>}
                {rewardDiscount > 0 && <div className="checkout-order-discount"><span>Reward Points Discount</span><strong>-{money(rewardDiscount)}</strong></div>}
                <div className="checkout-order-grand-total"><span>Grand Total</span><strong>{money(finalTotal)}</strong></div>
              </div>

              <div className="coupon-box">
                <label htmlFor="checkout-coupon">Coupon Code</label>
                <div className="coupon-input-row">
                  <input
                    id="checkout-coupon"
                    value={couponInput}
                    onChange={(event) => {
                      setCouponInput(event.target.value.toUpperCase());
                      setCouponMessage("");
                    }}
                    placeholder="Enter coupon code"
                    disabled={couponLoading || Boolean(appliedCoupon)}
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponInput("");
                        setCouponMessage("Coupon removed.");
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading || settingsLoading || subtotal <= 0}
                    >
                      {couponLoading ? "Applying..." : "Apply"}
                    </button>
                  )}
                </div>
                {couponMessage && (
                  <p className={appliedCoupon ? "coupon-success" : "coupon-error"} role="status">
                    {couponMessage}
                  </p>
                )}
              </div>
            </section>

            {error && (
              <div className="checkout-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submitOrder}>
              <div className="checkout-fields">
                <label>
                  Full Name *

                  <input
                    value={customer.name}
                    onChange={(event) =>
                      updateCustomer("name", event.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </label>

                <label>
                  Mobile Number *

                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(event) =>
                      updateCustomer(
                        "phone",
                        event.target.value.replace(/[^\d+]/g, "")
                      )
                    }
                    placeholder="01XXXXXXXXX"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                  />
                </label>

                <label>
  Division *

  <select
    value={customer.division}
    onChange={(event) =>
      updateCustomer(
        "division",
        event.target.value as Division
      )
    }
    required
  >
    <option value="">Select your division</option>
    <option value="Dhaka">Dhaka</option>
    <option value="Chattogram">Chattogram</option>
    <option value="Rajshahi">Rajshahi</option>
    <option value="Khulna">Khulna</option>
    <option value="Barishal">Barishal</option>
    <option value="Sylhet">Sylhet</option>
    <option value="Rangpur">Rangpur</option>
    <option value="Mymensingh">Mymensingh</option>
  </select>
</label>

<label>
  District *

  <input
    value={customer.district}
    onChange={(event) =>
      updateCustomer(
        "district",
        event.target.value
      )
    }
    placeholder="e.g. Dhaka"
    autoComplete="address-level2"
    required
  />
</label>

                <label className="address-field">
                  Full Delivery Address *

                  <textarea
                    value={customer.address}
                    onChange={(event) =>
                      updateCustomer(
                        "address",
                        event.target.value
                      )
                    }
                    placeholder="House/Flat, Road, Area, City and Postal Code"
                    autoComplete="street-address"
                    rows={3}
                    required
                    minLength={8}
                  />
                </label>
              </div>
              {/* Reward Points */}
              <div className="payment-method-card">
                <div>
                  <strong>Reward Points</strong>
                  <p>
                    {pointsLoading
                      ? "Checking your available points..."
                      : pointsChecked
                        ? `${availablePoints.toLocaleString()} points available. 100 points = ৳50 discount.`
                        : "Enter a valid mobile number to check your reward points."}
                  </p>
                  {pointsChecked && maxRedeemablePoints > 0 && (
                    <select
                      value={selectedRedeemPoints}
                      onChange={(event) => setRedeemPoints(Number(event.target.value))}
                      aria-label="Redeem reward points"
                    >
                      <option value={0}>Do not use points</option>
                      {Array.from(
                        { length: maxRedeemablePoints / 100 },
                        (_, index) => (index + 1) * 100
                      ).map((points) => (
                        <option key={points} value={points}>
                          Redeem {points} points — Save ৳{(points / 100) * 50}
                        </option>
                      ))}
                    </select>
                  )}
                  {pointsChecked && availablePoints === 0 && (
                    <p>No reward points available yet.</p>
                  )}
                  {rewardDiscount > 0 && <p>Reward discount: -{money(rewardDiscount)}</p>}
                  {couponDiscount > 0 && <p>Coupon discount: -{money(couponDiscount)}</p>}
                </div>
              </div>

              {/* Payment Method */}
              <div className="payment-method-card" style={{ display: "block" }}>
                <strong>Advance Delivery Payment</strong>
                <p>Pay the delivery charge in advance. Pay the remaining product amount by Cash on Delivery.</p>
                <div className="checkout-fields">
                  <label>Payment Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "bKash" | "Nagad")}><option value="bKash">bKash</option><option value="Nagad">Nagad</option></select></label>
                  <label>Payment Option<select value={paymentChoice} onChange={(event) => setPaymentChoice(event.target.value as "delivery" | "full" | "request_later")}><option value="delivery">Pay delivery charge now ({money(deliveryCharge)})</option><option value="full">Pay full amount now ({money(finalTotal)})</option><option value="request_later">Request admin approval to pay delivery charge later</option></select></label>
                  {paymentChoice !== "request_later" && <>
                    <div className="payment-number-copy-card" style={{ gridColumn: "1 / -1", padding: "16px", border: "1px solid #e5ddff", borderRadius: "12px", background: "#faf8ff" }}>
                      <span style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: 700, color: "#62558c" }}>SEND MONEY TO {paymentMethod.toUpperCase()}</span>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "22px", letterSpacing: "0.5px", color: "#21183d", overflowWrap: "anywhere" }}>{paymentAccountNumber || `Admin has not configured the ${paymentMethod} number`}</strong>
                        <button type="button" onClick={copyPaymentNumber} disabled={!paymentAccountNumber} style={{ border: 0, borderRadius: "8px", padding: "10px 16px", background: paymentNumberCopied ? "#16834a" : "#6040bd", color: "#fff", fontWeight: 700, cursor: paymentAccountNumber ? "pointer" : "not-allowed", opacity: paymentAccountNumber ? 1 : 0.55, whiteSpace: "nowrap" }}>
                          {paymentNumberCopied ? "Copied!" : "Copy Number"}
                        </button>
                      </div>
                      <small style={{ display: "block", marginTop: "8px", color: "#746b88" }}>Copy this number and send the required amount using {paymentMethod}.
                      </small>
                    </div>
                    <label>Transaction ID *<input value={transactionId} onChange={(event) => setTransactionId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={30} required placeholder="Enter transaction ID" /></label>
                    <label>Sender Mobile Number *<input value={senderNumber} onChange={(event) => setSenderNumber(event.target.value.replace(/[^0-9+]/g, ""))} required placeholder="01XXXXXXXXX" /></label>
                  </>}
                </div>
                <p>Admin approval is required to confirm payment. Delivery charge can be paid later only after admin approval.</p>
              </div>

              {/* Checkout Total */}
              <div className="checkout-total">
                <span>Order Total</span>
                <strong>{money(finalTotal)}</strong>
              </div>

              {/* Checkout Actions */}
              <div className="checkout-actions">
                <button
                  type="button"
                  className="cancel-checkout"
                  onClick={() => {
                    window.location.href = "/cart";
                  }}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="cart-primary-button"
                  disabled={submitting || settingsLoading}
                >
                  {submitting
                    ? "Placing Order..."
                    : "Confirm Order →"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>


      <style jsx global>{`
        .cart-page { background: #f6f7fb; color: #17152d; }
        .cart-header { background: rgba(255,255,255,.94); border-bottom: 1px solid #e9e7f2; }
        .cart-container { max-width: 1180px; padding-top: 28px; padding-bottom: 56px; }
        .cart-breadcrumb { color: #8b879e; font-size: 12px; margin-bottom: 22px; }
        .cart-breadcrumb a { color: #6250a5; text-decoration: none; }
        .cart-title-row { margin-bottom: 26px; }
        .cart-title-row h1 { font-size: clamp(28px, 3vw, 38px); letter-spacing: -.8px; margin: 8px 0; font-weight: 800; color: #17152d; }
        .cart-title-row p { color: #77748b; font-size: 14px; }
        .cart-eyebrow { color: #7254cf; font-size: 10px; font-weight: 800; letter-spacing: 1.8px; }
        .checkout-panel { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); grid-template-areas: 'heading heading' 'summary form' 'error error'; gap: 22px; align-items: start; background: transparent; border: 0; box-shadow: none; padding: 0; }
        .checkout-heading { grid-area: heading; background: #fff; border: 1px solid #ebe8f4; border-radius: 18px; padding: 22px 26px; box-shadow: 0 8px 30px rgba(31,24,68,.045); }
        .checkout-heading h2 { font-size: 19px; margin: 6px 0; color: #211b42; }
        .checkout-heading p { margin: 0; color: #858197; font-size: 12px; }
        .checkout-order-summary { grid-area: summary; position: sticky; top: 20px; background: #fff; border: 1px solid #ebe8f4; border-radius: 18px; padding: 22px; box-shadow: 0 8px 30px rgba(31,24,68,.05); }
        .checkout-order-summary-heading { display:flex; justify-content:space-between; align-items:center; padding-bottom:15px; border-bottom:1px solid #efedf5; }
        .checkout-order-summary-heading h3 { font-size: 16px; margin:0; color:#211b42; }
        .checkout-order-summary-heading span { font-size:11px; color:#8c879f; }
        .checkout-order-items { display:grid; gap:14px; padding:16px 0; }
        .checkout-order-item { display:grid; grid-template-columns:64px minmax(0,1fr) auto; align-items:center; gap:12px; }
        .checkout-order-image { width:64px; height:64px; border-radius:12px; display:grid; place-items:center; overflow:hidden; }
        .checkout-order-image img { width:100%; height:100%; object-fit:contain; }
        .checkout-order-item-details { display:grid; gap:4px; min-width:0; }
        .checkout-order-item-details span { color:#8a849e; font-size:10px; }
        .checkout-order-item-details strong { font-size:12px; color:#292443; }
        .checkout-order-item-details small { font-size:10px; color:#89849a; }
        .checkout-order-item-total { font-size:12px; color:#282143; white-space:nowrap; }
        .checkout-order-totals { border-top:1px solid #efedf5; padding-top:14px; display:grid; gap:11px; }
        .checkout-order-totals > div { display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#77738a; }
        .checkout-order-totals strong { color:#282342; font-weight:700; }
        .checkout-order-totals .checkout-order-discount strong { color:#16845c; }
        .checkout-order-totals .checkout-order-grand-total { border-top:1px solid #efedf5; padding-top:14px; margin-top:2px; color:#282143; font-weight:800; font-size:14px; }
        .checkout-order-grand-total strong { color:#6544c2; font-size:22px; }
        .coupon-box { margin-top:18px; padding:14px; background:#faf9fe; border:1px solid #e9e4f7; border-radius:13px; }
        .coupon-box label { display:block; margin-bottom:9px; font-size:11px; font-weight:800; color:#393252; }
        .coupon-input-row { display:flex; gap:8px; }
        .coupon-input-row input { flex:1; min-width:0; height:42px; border:1px solid #e1dced; border-radius:9px; padding:0 12px; background:#fff; font-size:12px; outline:none; }
        .coupon-input-row input:focus, .checkout-fields input:focus, .checkout-fields select:focus, .checkout-fields textarea:focus { border-color:#8060d8; box-shadow:0 0 0 3px rgba(128,96,216,.11); }
        .coupon-input-row button { border:0; border-radius:9px; padding:0 17px; background:#6242bd; color:#fff; font-size:11px; font-weight:800; cursor:pointer; }
        .coupon-input-row button:disabled { opacity:.55; cursor:not-allowed; }
        .coupon-success,.coupon-error { font-size:11px; margin:9px 0 0; }
        .coupon-success { color:#16845c; } .coupon-error { color:#c44855; }
        .checkout-panel form { grid-area:form; min-width:0; background:#fff; border:1px solid #ebe8f4; border-radius:18px; padding:24px; box-shadow:0 8px 30px rgba(31,24,68,.05); }
        .checkout-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 13px; }
        .checkout-fields label { display:grid; gap:7px; min-width:0; color:#49445f; font-size:11px; font-weight:700; }
        .checkout-fields input,.checkout-fields select,.checkout-fields textarea { width:100%; min-width:0; min-height:43px; border:1px solid #e5e1ee; border-radius:9px; padding:0 12px; background:#fff; color:#282342; font:inherit; font-size:12px; outline:none; box-sizing:border-box; }
        .checkout-fields textarea { padding:12px; min-height:90px; resize:vertical; }
        .checkout-fields .address-field { grid-column:1/-1; }
        .payment-method-card { margin-top:18px; padding:17px; border:1px solid #eae6f3; border-radius:13px; background:#fbfaff; }
        .payment-method-card > strong { display:block; color:#292342; font-size:13px; margin-bottom:6px; }
        .payment-method-card p { color:#858097; font-size:10px; line-height:1.6; margin:5px 0 12px; }
        .payment-method-card .checkout-fields { gap:13px; }
        .payment-method-card .checkout-fields label > strong { display:block; padding:12px; border:1px dashed #d7cfee; border-radius:9px; color:#6042b6; background:#fff; font-size:12px; }
        .checkout-error { grid-area:error; align-self:start; margin:0; }
        .checkout-total { display:flex; justify-content:space-between; align-items:center; border-top:1px solid #efedf5; margin-top:20px; padding:18px 0; color:#49445f; font-size:13px; font-weight:700; }
        .checkout-total strong { color:#6242bd; font-size:22px; }
        .checkout-actions { display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #efedf5; padding-top:16px; }
        .checkout-actions button { min-height:43px; border-radius:10px; padding:0 20px; font-size:12px; font-weight:800; }
        .checkout-actions .cancel-checkout { border:1px solid #e4dfed; background:#fff; color:#625d75; }
        .checkout-actions .cart-primary-button { border:0; background:linear-gradient(135deg,#7654d4,#5a3bb5); color:#fff; box-shadow:0 6px 15px rgba(98,66,189,.2); }
        @media (max-width:850px) { .checkout-panel { grid-template-columns:minmax(0,1fr); grid-template-areas:'heading' 'summary' 'form'; } .checkout-order-summary { position:static; } }
        @media (max-width:560px) { .cart-container { padding-left:14px; padding-right:14px; } .checkout-heading,.checkout-order-summary,.checkout-panel form { padding:17px; border-radius:14px; } .checkout-fields { grid-template-columns:1fr; gap:13px; } .checkout-fields .address-field { grid-column:auto; } .payment-method-card .checkout-fields { grid-template-columns:1fr; } .checkout-order-item { grid-template-columns:54px minmax(0,1fr) auto; gap:9px; } .checkout-order-image { width:54px; height:54px; } .checkout-actions { justify-content:stretch; } .checkout-actions button { flex:1; padding:0 10px; } }
      `}</style>

      {/* Footer */}
      <footer className="cart-footer">
        <span>© {new Date().getFullYear()} Gadget Store. All rights reserved.</span>
        <span>Made for tech lovers in Bangladesh 🇧🇩</span>
      </footer>
    </main>
  );
}
