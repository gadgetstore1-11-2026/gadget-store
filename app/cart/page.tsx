
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createOrder } from "@/lib/orders";
type CartItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  emoji: string;
  color: string;
};

type Customer = {
  name: string;
  phone: string;
  district: string;
  address: string;
};

const STORAGE_KEY = "gadget-store-cart";

const initialProducts: CartItem[] = [
  {
    id: 1,
    name: "Premium Wireless Headphone",
    category: "Audio",
    price: 2490,
    quantity: 1,
    emoji: "🎧",
    color: "#eee9ff",
  },
  {
    id: 2,
    name: "Smart Watch Series 9",
    category: "Smart Watch",
    price: 3590,
    quantity: 1,
    emoji: "⌚",
    color: "#e5efff",
  },
  {
    id: 3,
    name: "Portable Bluetooth Speaker",
    category: "Audio",
    price: 1890,
    quantity: 1,
    emoji: "🔊",
    color: "#e4f5ee",
  },
  {
    id: 4,
    name: "Fast Charging Power Bank",
    category: "Accessories",
    price: 1590,
    quantity: 1,
    emoji: "🔋",
    color: "#fff0dc",
  },
  {
    id: 5,
    name: "Wireless Earbuds Pro",
    category: "Audio",
    price: 2190,
    quantity: 1,
    emoji: "🎵",
    color: "#ffe9ee",
  },
  {
    id: 6,
    name: "65W Fast Charger",
    category: "Accessories",
    price: 990,
    quantity: 1,
    emoji: "🔌",
    color: "#e6f1ff",
  },
];

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
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);

  const money = (amount: number) =>
    `৳${amount.toLocaleString("en-BD")}`;

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

  useEffect(() => {
    if (ready) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, ready]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const deliveryCharge = subtotal === 0 ? 0 : subtotal >= 3000 ? 0 : 80;
  const total = subtotal + deliveryCharge;

  function changeQuantity(id: number, change: number) {
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

  function removeItem(id: number) {
    setCart((items) => items.filter((item) => item.id !== id));
  }

  function updateCustomer(field: keyof Customer, value: string) {
    setCustomer((previous) => ({ ...previous, [field]: value }));
    setError("");
  }


async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");

  if (cart.length === 0) {
    setError("তোমার কার্টে কোনো পণ্য নেই।");
    return;
  }

  if (!/^01[3-9]\d{8}$/.test(customer.phone.trim())) {
    setError("সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দাও।");
    return;
  }

  if (customer.name.trim().length < 2) {
    setError("তোমার সম্পূর্ণ নাম লিখো।");
    return;
  }

  if (customer.address.trim().length < 8) {
    setError("সম্পূর্ণ ডেলিভারি ঠিকানা লিখো।");
    return;
  }

  if (customer.district.trim().length < 2) {
    setError("তোমার জেলার নাম লিখো।");
    return;
  }

  try {
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const deliveryCharge = 80;
    const orderNumber = `GS-${Date.now()}`;

    const orderId = await createOrder({
      orderNumber,
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
      subtotal,
      deliveryCharge,
      total: subtotal + deliveryCharge,
      paymentMethod: "Cash on Delivery",
      createdAt: new Date().toISOString(),
      status: "Pending",
    });

    if (!orderId) {
      throw new Error("অর্ডার সংরক্ষণ করা যায়নি।");
    }

    setOrderNumber(orderNumber);
    setOrderTotal(subtotal + deliveryCharge);
    setCart([]);
    setCheckoutOpen(false);
    setCustomer(emptyCustomer);
  } catch (error) {
    console.error("Order submission failed:", error);

    setError(
      "অর্ডার পাঠানো যায়নি। Firebase Rules ও সংযোগ পরীক্ষা করো।"
    );
  }
}



  if (!ready) {
    return (
      <main className="cart-page">
        <p className="cart-loading">কার্ট লোড হচ্ছে...</p>
      </main>
    );
  }

  if (orderNumber) {
    return (
      <main className="cart-page">
        <div className="order-success">
          <div className="success-icon">✓</div>
          <span className="cart-eyebrow">ORDER CONFIRMATION</span>
          <h1>ধন্যবাদ! তোমার অর্ডার তৈরি হয়েছে।</h1>
          <p>
            এটি একটি পরীক্ষামূলক অর্ডার। বর্তমানে দোকানের সার্ভারে অর্ডার
            পাঠানো হচ্ছে না।
          </p>

          <div className="order-summary">
            <div>
              <span>অর্ডার নম্বর</span>
              <strong>{orderNumber}</strong>
            </div>
            <div>
              <span>পেমেন্ট</span>
              <strong>Cash on Delivery</strong>
            </div>
            <div>
              <span>মোট মূল্য</span>
              <strong>{money(orderTotal)}</strong>
            </div>
          </div>

          <Link href="/" className="cart-primary-button">
            হোমপেজে ফিরে যাও
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <header className="cart-header">
        <Link href="/" className="cart-brand">
          <span className="cart-brand-icon">G</span>
          <span>
            <strong>GADGET</strong>
            <small>STORE</small>
          </span>
        </Link>

        <div className="secure-label">🔒 Secure Checkout</div>

        <Link href="/" className="continue-link">
          ← কেনাকাটা চালিয়ে যাও
        </Link>
      </header>

      <div className="cart-container">
        <div className="cart-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Shopping Cart</span>
        </div>

        <div className="cart-title-row">
          <div>
            <span className="cart-eyebrow">YOUR SHOPPING BAG</span>
            <h1>Shopping Cart</h1>
            <p>
              {cart.reduce((sum, item) => sum + item.quantity, 0)}টি পণ্য
              তোমার কার্টে আছে।
            </p>
          </div>
        </div>

        {cart.length === 0 ? (
          <section className="cart-empty">
            <div className="empty-cart-icon">🛒</div>
            <h2>তোমার কার্ট খালি</h2>
            <p>
              পছন্দের গ্যাজেট খুঁজে বের করো এবং কেনাকাটা শুরু করো।
            </p>
            <Link href="/" className="cart-primary-button">
              পণ্য দেখো →
            </Link>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-panel">
              <div className="cart-panel-heading">
                <h2>তোমার পণ্য</h2>
                <span>{cart.length}টি আইটেম</span>
              </div>

              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div
                    className="cart-product-image"
                    style={{ backgroundColor: item.color }}
                  >
                    <span>{item.emoji}</span>
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
                        onClick={() => changeQuantity(item.id, -1)}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(item.id, 1)}
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <Link href="/" className="back-shopping">
                ← আরও পণ্য যোগ করো
              </Link>
            </section>

            <aside className="cart-summary-panel">
              <h2>Order Summary</h2>

              <div className="summary-line">
                <span>পণ্যের মূল্য</span>
                <strong>{money(subtotal)}</strong>
              </div>

              <div className="summary-line">
                <span>ডেলিভারি চার্জ</span>
                <strong>
                  {deliveryCharge === 0 ? "FREE" : money(deliveryCharge)}
                </strong>
              </div>

              <div className="free-delivery-note">
                {subtotal >= 3000
                  ? "✓ তুমি ফ্রি ডেলিভারি পাচ্ছ!"
                  : `আর ${money(3000 - subtotal)} টাকার পণ্য নিলে ডেলিভারি ফ্রি।`}
              </div>

              <div className="summary-total">
                <span>সর্বমোট</span>
                <strong>{money(total)}</strong>
              </div>

              <button
                className="cart-primary-button checkout-button"
                onClick={() => {
                  setCheckoutOpen(true);
                  setError("");
                }}
              >
                Checkout-এ যাও →
              </button>

              <div className="payment-note">
                <span>🔒</span>
                <p>
                  তোমার তথ্য শুধু এই পরীক্ষামূলক ব্রাউজার অ্যাপেই সংরক্ষিত
                  হবে।
                </p>
              </div>
            </aside>
          </div>
        )}

        {checkoutOpen && cart.length > 0 && (
          <section className="checkout-panel" id="checkout">
            <div className="checkout-heading">
              <span className="cart-eyebrow">ALMOST THERE</span>
              <h2>ডেলিভারি তথ্য</h2>
              <p>পণ্য পাঠানোর জন্য নিচের তথ্যগুলো পূরণ করো।</p>
            </div>

            {error && (
              <div className="checkout-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submitOrder}>
              <div className="checkout-fields">
                <label>
                  তোমার নাম *
                  <input
                    value={customer.name}
                    onChange={(event) =>
                      updateCustomer("name", event.target.value)
                    }
                    placeholder="সম্পূর্ণ নাম"
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </label>

                <label>
                  মোবাইল নম্বর *
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
                  জেলা *
                  <input
                    value={customer.district}
                    onChange={(event) =>
                      updateCustomer("district", event.target.value)
                    }
                    placeholder="যেমন: Dhaka"
                    autoComplete="address-level2"
                    required
                  />
                </label>

                <label className="address-field">
                  সম্পূর্ণ ডেলিভারি ঠিকানা *
                  <textarea
                    value={customer.address}
                    onChange={(event) =>
                      updateCustomer("address", event.target.value)
                    }
                    placeholder="বাড়ি/ফ্ল্যাট, রোড, এলাকা, থানা এবং পোস্ট কোড"
                    autoComplete="street-address"
                    rows={3}
                    required
                    minLength={8}
                  />
                </label>
              </div>

              <div className="payment-method-card">
                <span className="cod-icon">৳</span>
                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <p>পণ্য হাতে পেয়ে টাকা পরিশোধ করবে।</p>
                </div>
                <span className="selected-payment">✓</span>
              </div>

              <div className="checkout-total">
                <span>অর্ডারের মোট মূল্য</span>
                <strong>{money(total)}</strong>
              </div>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="cancel-checkout"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setError("");
                  }}
                >
                  ফিরে যাও
                </button>

                <button type="submit" className="cart-primary-button">
                  অর্ডার নিশ্চিত করো →
                </button>
              </div>

              <p className="demo-warning">
                পরীক্ষামূলক সংস্করণ: এই অর্ডার দোকানে পাঠানো হবে না। বাস্তব
                অর্ডার গ্রহণের আগে সার্ভার ও ডেটাবেস সংযুক্ত করতে হবে।
              </p>
            </form>
          </section>
        )}
      </div>

      <footer className="cart-footer">
        <span>© 2026 Gadget Store</span>
        <span>Made for tech lovers in Bangladesh 🇧🇩</span>
      </footer>
    </main>
  );
}
