"use client";

import { useState } from "react";
import Link from "next/link";

type OrderItem = {
name: string;
quantity: number;
price: number;
imageUrl?: string;
};

type TrackedOrder = {
orderId: string;
orderNumber: string;
customerName: string;
district: string;
items: OrderItem[];
subtotal: number;
deliveryCharge: number;
rewardDiscount: number;
total: number;
paymentMethod: string;
status: string;
createdAt: string | null;
statusUpdatedAt: string | null;
};

const steps = [
{ status: "Pending", title: "Order Placed", description: "We have received your order." },
{ status: "Confirmed", title: "Order Confirmed", description: "Your order has been confirmed." },
{ status: "Shipped", title: "On The Way", description: "Your order is on its way." },
{ status: "Delivered", title: "Delivered", description: "Your order has been successfully delivered." },
];

const statusOrder = ["Pending", "Confirmed", "Shipped", "Delivered"];

function formatDate(date: string | null) {
if (!date) return "Not available";

return new Date(date).toLocaleString("en-BD", {
dateStyle: "medium",
timeStyle: "short",
});
}

export default function TrackOrderPage() {
const [orderNumber, setOrderNumber] = useState("");
const [phone, setPhone] = useState("");
const [order, setOrder] = useState<TrackedOrder | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function trackOrder(event: React.FormEvent<HTMLFormElement>) {
event.preventDefault();

setLoading(true);
setError("");
setOrder(null);

try {
  const response = await fetch("/api/track-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderNumber: orderNumber.trim(),
      phone: phone.trim(),
    }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Unable to find your order."
    );
  }

  setOrder(data.order);
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : "Something went wrong. Please try again."
  );
} finally {
  setLoading(false);
}

}

const currentStep = order
? statusOrder.indexOf(order.status)
: -1;

const isCancelled = order?.status === "Cancelled";

return ( <main className="tracking-page"> <style jsx>{`
.tracking-page {
min-height: 100vh;
background: #f5f7fb;
padding: 50px 20px 80px;
color: #172033;
}

    .tracking-container {
      max-width: 850px;
      margin: 0 auto;
    }

    .tracking-header {
      text-align: center;
      margin-bottom: 35px;
    }

    .tracking-header h1 {
      font-size: 36px;
      font-weight: 800;
      margin: 12px 0;
      letter-spacing: -1px;
    }

    .tracking-header p {
      color: #687386;
      font-size: 15px;
    }

    .tracking-card {
      background: white;
      border-radius: 18px;
      padding: 30px;
      box-shadow: 0 8px 35px rgba(20, 35, 60, 0.06);
      margin-bottom: 24px;
    }

    .tracking-form {
      display: grid;
      gap: 17px;
    }

    .tracking-form label {
      display: block;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .tracking-form input {
      width: 100%;
      height: 50px;
      border: 1px solid #dce2eb;
      border-radius: 10px;
      padding: 0 15px;
      font-size: 15px;
      outline: none;
      background: white;
      color: #172033;
    }

    .tracking-form input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .track-button {
      height: 52px;
      border: none;
      border-radius: 10px;
      background: #111827;
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: 0.2s;
    }

    .track-button:hover {
      background: #2563eb;
    }

    .track-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error-message {
      background: #fff1f2;
      color: #be123c;
      padding: 13px 15px;
      border-radius: 10px;
      font-size: 14px;
      margin-top: 15px;
    }

    .order-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      border-bottom: 1px solid #edf0f5;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }

    .order-number {
      font-size: 20px;
      font-weight: 800;
    }

    .status-badge {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 30px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 800;
    }

    .timeline {
      margin: 30px 0;
    }

    .timeline-step {
      display: flex;
      gap: 17px;
      min-height: 90px;
      position: relative;
    }

    .timeline-line {
      position: absolute;
      left: 17px;
      top: 37px;
      height: 53px;
      width: 3px;
      background: #e5e7eb;
    }

    .timeline-line.completed {
      background: #16a34a;
    }

    .timeline-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e5e7eb;
      color: #64748b;
      font-weight: 800;
      z-index: 1;
    }

    .timeline-icon.completed {
      background: #16a34a;
      color: white;
    }

    .timeline-content h3 {
      font-size: 15px;
      font-weight: 800;
      margin: 2px 0 5px;
    }

    .timeline-content p {
      font-size: 13px;
      color: #788397;
      margin: 0;
    }

    .timeline-content .active-text {
      color: #16a34a;
      font-weight: 700;
    }

    .section-title {
      font-size: 18px;
      font-weight: 800;
      margin: 25px 0 15px;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid #edf0f5;
      font-size: 14px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 0;
      font-size: 14px;
      color: #657086;
    }

    .summary-total {
      border-top: 1px solid #e5e7eb;
      margin-top: 10px;
      padding-top: 17px;
      font-size: 19px;
      font-weight: 800;
      color: #111827;
    }

    .cancelled-box {
      padding: 18px;
      background: #fff1f2;
      color: #be123c;
      border-radius: 12px;
      font-weight: 700;
      margin: 25px 0;
    }

    .back-link {
      display: inline-block;
      margin-top: 22px;
      color: #2563eb;
      font-weight: 700;
      text-decoration: none;
    }

    @media (max-width: 600px) {
      .tracking-page {
        padding: 30px 14px 50px;
      }

      .tracking-header h1 {
        font-size: 28px;
      }

      .tracking-card {
        padding: 20px;
      }

      .order-number {
        font-size: 16px;
      }
    }
  `}</style>

  <div className="tracking-container">
    <header className="tracking-header">
      <div style={{ fontSize: 34 }}>📦</div>
      <h1>Track Your Order</h1>
      <p>
        Enter your order number and phone number to check your order status.
      </p>
    </header>

    <section className="tracking-card">
      <form className="tracking-form" onSubmit={trackOrder}>
        <div>
          <label htmlFor="orderNumber">Order Number</label>
          <input
            id="orderNumber"
            type="text"
            placeholder="Example: GS-12345678-A1B2"
            value={orderNumber}
            onChange={(event) =>
              setOrderNumber(event.target.value.toUpperCase())
            }
            required
          />
        </div>

        <div>
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            pattern="01[3-9][0-9]{8}"
            maxLength={11}
            required
          />
        </div>

        <button
          type="submit"
          className="track-button"
          disabled={loading}
        >
          {loading ? "Checking Order..." : "Track My Order"}
        </button>
      </form>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </section>

    {order && (
      <section className="tracking-card">
        <div className="order-top">
          <div>
            <div style={{ color: "#788397", fontSize: 12 }}>
              ORDER NUMBER
            </div>
            <div className="order-number">
              {order.orderNumber}
            </div>
          </div>

          <span className="status-badge">
            {order.status}
          </span>
        </div>

        <div style={{ fontSize: 14, color: "#657086", lineHeight: 1.9 }}>
          <div>Customer: <strong>{order.customerName}</strong></div>
          <div>District: <strong>{order.district}</strong></div>
          <div>Order Date: <strong>{formatDate(order.createdAt)}</strong></div>
          <div>Last Updated: <strong>{formatDate(order.statusUpdatedAt)}</strong></div>
        </div>

        {isCancelled ? (
          <div className="cancelled-box">
            This order has been cancelled. Please contact our support team if you need assistance.
          </div>
        ) : (
          <div className="timeline">
            {steps.map((step, index) => {
              const completed = currentStep >= index;

              return (
                <div className="timeline-step" key={step.status}>
                  <div>
                    <div
                      className={`timeline-icon ${
                        completed ? "completed" : ""
                      }`}
                    >
                      {completed ? "✓" : index + 1}
                    </div>

                    {index !== steps.length - 1 && (
                      <div
                        className={`timeline-line ${
                          currentStep > index ? "completed" : ""
                        }`}
                      />
                    )}
                  </div>

                  <div className="timeline-content">
                    <h3>{step.title}</h3>
                    <p className={completed ? "active-text" : ""}>
                      {step.description}
                    </p>
                    {order.status === step.status && (
                      <p className="active-text" style={{ marginTop: 5 }}>
                        Current Status
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="section-title">Order Items</h2>

        {order.items.map((item, index) => (
          <div className="order-item" key={index}>
            <div>
              <strong>{item.name}</strong>
              <div style={{ color: "#788397", marginTop: 5 }}>
                Quantity: {item.quantity}
              </div>
            </div>
            <strong>
              ৳{(item.price * item.quantity).toLocaleString("en-BD")}
            </strong>
          </div>
        ))}

        <h2 className="section-title">Payment Summary</h2>

        <div className="summary-row">
          <span>Subtotal</span>
          <span>৳{order.subtotal.toLocaleString("en-BD")}</span>
        </div>

        <div className="summary-row">
          <span>Delivery Charge</span>
          <span>৳{order.deliveryCharge.toLocaleString("en-BD")}</span>
        </div>

        {order.rewardDiscount > 0 && (
          <div className="summary-row">
            <span>Reward Discount</span>
            <span>-৳{order.rewardDiscount.toLocaleString("en-BD")}</span>
          </div>
        )}

        <div className="summary-row summary-total">
          <span>Total</span>
          <span>৳{order.total.toLocaleString("en-BD")}</span>
        </div>

        <div style={{ marginTop: 18, fontSize: 14, color: "#657086" }}>
          Payment Method: <strong>{order.paymentMethod}</strong>
        </div>

        <button
          type="button"
          className="track-button"
          style={{ width: "100%", marginTop: 25 }}
          onClick={() => trackOrder({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Order Status"}
        </button>
      </section>
    )}

    <div style={{ textAlign: "center" }}>
      <Link href="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  </div>
</main>

);
}
