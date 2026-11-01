"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createOrder } from "@/lib/orders";

type CartItem = {
  id: string | number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  emoji: string;
  color: string;
  image?: string;
};

type Customer = {
  name: string;
  phone: string;
  district: string;
  address: string;
};

type StoreSettings = {
  deliveryCharge: number;
  freeDeliveryMinimum: number;
};

const STORAGE_KEY = "gadget-store-cart";

const DEFAULT_SETTINGS: StoreSettings = {
  deliveryCharge: 80,
  freeDeliveryMinimum: 3000,
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
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

  // Format currency
  const money = (amount: number) =>
    `৳${amount.toLocaleString("en-BD")}`;

  // Load cart from local storage
  useEffect(() => {
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

          setStoreSettings({
            deliveryCharge:
              typeof data.deliveryCharge === "number" &&
              Number.isFinite(data.deliveryCharge) &&
              data.deliveryCharge >= 0
                ? data.deliveryCharge
                : DEFAULT_SETTINGS.deliveryCharge,

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
  const deliveryCharge =
    subtotal === 0
      ? 0
      : subtotal >= storeSettings.freeDeliveryMinimum
        ? 0
        : storeSettings.deliveryCharge;

  const total = subtotal + deliveryCharge;

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
                      <img
                        src={item.image}
                        alt={item.name}
                        className="cart-product-photo"
                        onError={() =>
                          console.log(
                            "Cart image failed:",
                            item.image
                          )
                        }
                      />
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
                <strong>{money(total)}</strong>
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