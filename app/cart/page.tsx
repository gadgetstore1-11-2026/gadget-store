"use client";
import Image from "next/image";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

type StoreSettings = {
  divisionDeliveryCharges: Record<Division, number>;
  freeDeliveryMinimum: number;
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
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  division: "",
  district: "",
  address: "",
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);

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
  const maxRedeemablePoints = Math.min(
    Math.floor(availablePoints / 100) * 100,
    Math.floor(subtotal / 50) * 100
  );

  const selectedRedeemPoints = Math.min(redeemPoints, maxRedeemablePoints);
  const rewardDiscount = (selectedRedeemPoints / 100) * 50;
  const finalTotal = total - rewardDiscount;

  // Look up reward points using the customer's mobile number
  useEffect(() => {
    const phone = customer.phone.trim();
    const controller = new AbortController();
    let lookupTimer: number | undefined;

    const resetTimer = window.setTimeout(() => {
      setAvailablePoints(0);
      setRedeemPoints(0);
      setPointsChecked(false);

      if (!/^01[3-9]\d{8}$/.test(phone)) {
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
    setCart((items) =>
      items
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  // Remove product from cart
  function removeItem(id: string | number) {
    setCart((items) => items.filter((item) => item.id !== id));
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

    if (!/^01[3-9]\d{8}$/.test(customer.phone.trim())) {
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

    setSubmitting(true);

    try {
      const result = await createOrder({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          division: customer.division,
          district: customer.district.trim(),
          address: customer.address.trim(),
        },

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
      setCart([]);
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
              <strong>Cash on Delivery</strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>{money(orderTotal)}</strong>
            </div>
          </div>

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
          <span>Shopping Cart</span>
        </div>

        {/* Cart Title */}
        <div className="cart-title-row">
          <div>
            <span className="cart-eyebrow">
              YOUR SHOPPING BAG
            </span>

            <h1>Shopping Cart</h1>

            <p>
              {cart.reduce(
                (sum, item) => sum + item.quantity,
                0
              )}{" "}
              items in your cart.
            </p>
          </div>
        </div>

        {/* Empty Cart */}
        {cart.length === 0 ? (
          <section className="cart-empty">
            <div className="empty-cart-icon">🛒</div>

            <h2>Your Cart is Empty</h2>

            <p>
              Discover your favourite gadgets and start shopping.
            </p>

            <Link href="/" className="cart-primary-button">
              Explore Products →
            </Link>
          </section>
        ) : (
          <div className="cart-layout">
            {/* Cart Items */}
            <section className="cart-items-panel">
              <div className="cart-panel-heading">
                <h2>Your Items</h2>
                <span>{cart.length} items</span>
              </div>

              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div
                    className="cart-product-image"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.image ? (
                      <Image src={item.image} alt={item.name} width={100} height={100} unoptimized className="cart-product-photo" />
                    ) : (
                      <span>{item.emoji}</span>
                    )}
                  </div>

                  <div className="cart-product-details">
                    <span className="cart-product-category">
                      {item.category}
                    </span>

                    <h3>{item.name}</h3>

                    <strong className="cart-unit-price">
                      {money(item.price)}
                    </strong>

                    <button
                      className="remove-item"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="cart-item-right">
                    <strong className="cart-line-total">
                      {money(item.price * item.quantity)}
                    </strong>

                    <div className="quantity-control">
                      <button
                        onClick={() =>
                          changeQuantity(item.id, -1)
                        }
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        onClick={() =>
                          changeQuantity(item.id, 1)
                        }
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <Link href="/" className="back-shopping">
                ← Continue Shopping
              </Link>
            </section>

            {/* Order Summary */}
            <aside className="cart-summary-panel">
              <h2>Order Summary</h2>

              <div className="summary-line">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>

              <div className="summary-line">
                <span>Delivery Fee</span>

                <strong>
                  {deliveryCharge === 0
                    ? "FREE"
                    : money(deliveryCharge)}
                </strong>
              </div>

              <div className="free-delivery-note">
                {settingsLoading
                  ? "Loading delivery fee..."
                  : subtotal >= storeSettings.freeDeliveryMinimum
                    ? "✓ Congratulations! You qualify for free delivery!"
                    : `Add ${money(
                        storeSettings.freeDeliveryMinimum - subtotal
                      )} more to your cart to get free delivery.`}
              </div>

              <div className="summary-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <button
                className="cart-primary-button checkout-button"
                disabled={settingsLoading}
                onClick={() => {
                  setCheckoutOpen(true);
                  setError("");
                }}
              >
                {settingsLoading
                  ? "Loading Settings..."
                  : "Proceed to Checkout →"}
              </button>

              <div className="payment-note">
                <span>🔒</span>

                <p>
                  Your order details will be securely saved.
                  Payment is available via Cash on Delivery.
                </p>
              </div>
            </aside>
          </div>
        )}

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
                  {rewardDiscount > 0 && (
                    <p>Reward discount: -{money(rewardDiscount)}</p>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="payment-method-card">
                <span className="cod-icon">৳</span>

                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <p>Pay when your order is delivered.</p>
                </div>

                <span className="selected-payment">✓</span>
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
                    setCheckoutOpen(false);
                    setError("");
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

      {/* Footer */}
      <footer className="cart-footer">
        <span>© {new Date().getFullYear()} Gadget Store. All rights reserved.</span>
        <span>Made for tech lovers in Bangladesh 🇧🇩</span>
      </footer>
    </main>
  );
}
