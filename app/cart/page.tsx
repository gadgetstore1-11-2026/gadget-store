"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const STORAGE_KEY = "gadget-store-cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed as CartItem[]);
      }
    } catch {
      setCart([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const money = (amount: number) => `৳${amount.toLocaleString("en-BD")}`;

  function changeQuantity(id: string, amount: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, Math.min(10, item.quantity + amount)) }
            : item
        )
    );
  }

  function removeItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  if (!ready) {
    return <main className="cart-page"><div className="cart-container">Loading your cart...</div></main>;
  }

  return (
    <main className="cart-page">
      <header className="cart-header">
        <Link href="/" className="cart-brand">
          <span className="cart-brand-icon">G</span>
          <span><strong>GADGET</strong><small>STORE</small></span>
        </Link>
        <div className="secure-label">🛒 Shopping Cart</div>
        <Link href="/" className="continue-link">← Continue Shopping</Link>
      </header>

      <div className="cart-container">
        <div className="cart-breadcrumb">
          <Link href="/">Home</Link><span>/</span><span>Shopping Cart</span>
        </div>

        <div className="cart-title-row">
          <div>
            <span className="cart-eyebrow">YOUR SHOPPING BAG</span>
            <h1>Shopping Cart</h1>
            <p>{cart.reduce((sum, item) => sum + item.quantity, 0)} items in your cart.</p>
          </div>
        </div>

        {cart.length === 0 ? (
          <section className="cart-empty">
            <div className="empty-cart-icon">🛒</div>
            <h2>Your Cart is Empty</h2>
            <p>Discover your favourite gadgets and start shopping.</p>
            <Link href="/" className="cart-primary-button">Explore Products →</Link>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-panel">
              <div className="cart-panel-heading">
                <h2>Your Items</h2>
                <div className="cart-heading-actions">
                  <span>{cart.length} items</span>
                  <button type="button" className="clear-cart-button" onClick={clearCart}>Clear Cart</button>
                </div>
              </div>

              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-product-image" style={{ backgroundColor: item.color }}>
                    {item.image ? (
                      <Image src={item.image} alt={item.name} width={100} height={100} unoptimized className="cart-product-photo" />
                    ) : <span>{item.emoji}</span>}
                  </div>
                  <div className="cart-product-details">
                    <span className="cart-product-category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <strong className="cart-unit-price">{money(item.price)}</strong>
                    <button type="button" className="remove-item" onClick={() => removeItem(item.id)}>Remove</button>
                  </div>
                  <div className="cart-item-right">
                    <strong className="cart-line-total">{money(item.price * item.quantity)}</strong>
                    <div className="quantity-control">
                      <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`} disabled={item.quantity >= 10}>+</button>
                    </div>
                  </div>
                </article>
              ))}
              <Link href="/" className="back-shopping">← Continue Shopping</Link>
            </section>

            <aside className="cart-summary-panel">
              <h2>Order Summary</h2>
              <div className="summary-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <div className="summary-line"><span>Delivery Fee</span><strong>Calculated at checkout</strong></div>
              <div className="summary-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <Link href="/checkout" className="cart-primary-button checkout-button">Proceed to Checkout →</Link>
              <div className="payment-note"><span>🔒</span><p>Your order details will be securely saved. Delivery and payment options are available on the next step.</p></div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
