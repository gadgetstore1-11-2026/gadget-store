"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Customer = {
  name: string;
  phone: string;
  createdAt?: string;
};

type OrderItem = {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  deliveryCharge: number;
  items: OrderItem[];
  createdAt: string;
};

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/account/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await user.getIdToken();

        const response = await fetch("/api/customer/account", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load your account."
          );
        }

        if (!active) return;

        setCustomer(result.customer);
        setOrders(result.orders || []);

        const rewardResponse = await fetch("/api/rewards/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: result.customer.phone,
          }),
        });

        const rewardResult = await rewardResponse.json();

        if (active && rewardResult.success) {
          setRewardPoints(
            Number(rewardResult.availablePoints || 0)
          );
        }
      } catch (err) {
        console.error("Customer dashboard error:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await signOut(auth);
      router.replace("/account/login");
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  const totalSpent = orders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const pendingOrders = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  function formatDate(date: string) {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleDateString("en-BD", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusClass(status: string) {
    return status.toLowerCase().replace(/\s+/g, "-");
  }

  if (loading) {
    return (
      <main className="account-loading">
        <div className="loader" />
        <p>Loading your account...</p>

        <style jsx>{`
          .account-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 15px;
            color: #64748b;
            font-family: Arial, sans-serif;
          }

          .loader {
            width: 38px;
            height: 38px;
            border: 4px solid #e2e8f0;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (error && !customer) {
    return (
      <main className="account-error">
        <div className="error-card">
          <h2>Unable to Load Account</h2>
          <p>{error}</p>
          <Link href="/account/login">Back to Login</Link>
        </div>

        <style jsx>{`
          .account-error {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            background: #f8fafc;
            font-family: Arial, sans-serif;
          }

          .error-card {
            max-width: 420px;
            width: 100%;
            padding: 35px;
            text-align: center;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 35px rgba(0, 0, 0, 0.06);
          }

          .error-card h2 {
            color: #111827;
          }

          .error-card p {
            color: #dc2626;
            line-height: 1.6;
          }

          .error-card a {
            display: inline-block;
            margin-top: 15px;
            color: #2563eb;
            font-weight: 700;
            text-decoration: none;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="customer-dashboard">
      <header className="dashboard-header">
        <Link href="/" className="brand">
          Gadget Store
        </Link>

        <nav>
          <Link href="/">Store</Link>
          <Link href="/track-order">Track Order</Link>
          <button onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging Out..." : "Logout"}
          </button>
        </nav>
      </header>

      <div className="dashboard-container">
        <div className="welcome-section">
          <div>
            <span className="eyebrow">CUSTOMER ACCOUNT</span>
            <h1>Hello, {customer?.name || "Customer"}!</h1>
            <p>Manage your profile, orders and rewards.</p>
          </div>

          <div className="profile-avatar">
            {(customer?.name || "C").charAt(0).toUpperCase()}
          </div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">📦</span>
            <div>
              <p>Total Orders</p>
              <h2>{orders.length}</h2>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <div>
              <p>Pending Orders</p>
              <h2>{pendingOrders}</h2>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div>
              <p>Total Spent</p>
              <h2>৳{totalSpent.toLocaleString("en-BD")}</h2>
            </div>
          </div>

          <div className="stat-card reward-card">
            <span className="stat-icon">⭐</span>
            <div>
              <p>Reward Points</p>
              <h2>{rewardPoints}</h2>
            </div>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel profile-panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">PERSONAL INFORMATION</span>
                <h2>My Profile</h2>
              </div>
              <span className="panel-icon">👤</span>
            </div>

            <div className="profile-details">
              <div className="detail-row">
                <span>Full Name</span>
                <strong>{customer?.name || "—"}</strong>
              </div>

              <div className="detail-row">
                <span>Phone Number</span>
                <strong>{customer?.phone || "—"}</strong>
              </div>

              <div className="detail-row">
                <span>Account Status</span>
                <strong className="active-status">Active</strong>
              </div>

              <div className="detail-row">
                <span>Reward Balance</span>
                <strong>{rewardPoints} Points</strong>
              </div>
            </div>

            <div className="profile-note">
              Your account information is securely stored.
            </div>
          </section>

          <section className="panel reward-panel">
            <span className="section-label">GADGET STORE REWARDS</span>
            <h2>Your Rewards</h2>

            <div className="reward-balance">
              <span>Available Points</span>
              <strong>{rewardPoints}</strong>
            </div>

            <p>
              Earn reward points when you shop at Gadget Store.
              You can use eligible points for discounts on future orders.
            </p>

            <div className="reward-conversion">
              100 Points = ৳50 Discount
            </div>

            <Link href="/cart" className="shop-button">
              Continue Shopping
            </Link>
          </section>
        </div>

        <section className="panel orders-panel">
          <div className="panel-heading orders-heading">
            <div>
              <span className="section-label">ORDER HISTORY</span>
              <h2>My Orders</h2>
            </div>

            <span className="order-count">
              {orders.length} Orders
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="empty-orders">
              <div className="empty-icon">🛍️</div>
              <h3>No Orders Yet</h3>
              <p>
                Your orders placed while signed in will appear here.
              </p>
              <Link href="/" className="shop-button">
                Explore Products
              </Link>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div className="order-card" key={order.id}>
                  <div className="order-main">
                    <div className="order-info">
                      <span className="order-number">
                        {order.orderNumber}
                      </span>
                      <span className="order-date">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>

                    <div className="order-price">
                      <strong>
                        ৳{Number(order.total).toLocaleString("en-BD")}
                      </strong>

                      <span
                        className={`status-badge ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <button
                      className="details-button"
                      onClick={() =>
                        setExpandedOrder(
                          expandedOrder === order.id ? null : order.id
                        )
                      }
                    >
                      {expandedOrder === order.id
                        ? "Hide Details −"
                        : "View Details +"}
                    </button>
                  </div>

                  {expandedOrder === order.id && (
                    <div className="order-details">
                      <h3>Order Details</h3>

                      <div className="order-items">
                        {order.items.map((item, index) => (
                          <div
                            className="order-item"
                            key={`${order.id}-${index}`}
                          >
                            <span>
                              {item.name || item.productName || "Product"}
                              {" × "}
                              {item.quantity || 1}
                            </span>

                            <strong>
                              ৳
                              {(
                                Number(item.price || 0) *
                                Number(item.quantity || 1)
                              ).toLocaleString("en-BD")}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <div className="order-total-row">
                        <span>Subtotal</span>
                        <strong>
                          ৳{Number(order.subtotal).toLocaleString("en-BD")}
                        </strong>
                      </div>

                      <div className="order-total-row">
                        <span>Delivery Charge</span>
                        <strong>
                          ৳
                          {Number(order.deliveryCharge).toLocaleString(
                            "en-BD"
                          )}
                        </strong>
                      </div>

                      <div className="order-total-row final-total">
                        <span>Total</span>
                        <strong>
                          ৳{Number(order.total).toLocaleString("en-BD")}
                        </strong>
                      </div>

                      <Link
                        href={`/track-order?orderNumber=${encodeURIComponent(
                          order.orderNumber
                        )}`}
                        className="tracking-link"
                      >
                        Track This Order →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <p>© {new Date().getFullYear()} Gadget Store. All rights reserved.</p>
          <Link href="/">Back to Store</Link>
        </footer>
      </div>

      <style jsx>{`
        .customer-dashboard {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172033;
          font-family: Arial, sans-serif;
        }

        .dashboard-header {
          height: 76px;
          padding: 0 7%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e8edf4;
        }

        .brand {
          font-size: 23px;
          font-weight: 800;
          color: #2563eb;
          text-decoration: none;
        }

        .dashboard-header nav {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .dashboard-header nav a {
          color: #475569;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }

        .dashboard-header nav button {
          padding: 11px 19px;
          border: 0;
          border-radius: 9px;
          background: #fff1f2;
          color: #e11d48;
          font-weight: 700;
          cursor: pointer;
        }

        .dashboard-container {
          max-width: 1200px;
          margin: auto;
          padding: 42px 24px;
        }

        .welcome-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
        }

        .eyebrow,
        .section-label {
          color: #2563eb;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .welcome-section h1 {
          margin: 9px 0;
          font-size: 30px;
          color: #111827;
        }

        .welcome-section p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .profile-avatar {
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 25px;
          font-weight: 800;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 17px;
          margin-bottom: 25px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 22px;
          background: white;
          border: 1px solid #edf0f5;
          border-radius: 14px;
          box-shadow: 0 4px 15px rgba(15, 23, 42, 0.025);
        }

        .stat-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          border-radius: 12px;
          font-size: 20px;
        }

        .stat-card p {
          margin: 0 0 7px;
          color: #64748b;
          font-size: 12px;
        }

        .stat-card h2 {
          margin: 0;
          font-size: 22px;
          color: #172033;
        }

        .reward-card .stat-icon {
          background: #fffbeb;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 20px;
          margin-bottom: 25px;
        }

        .panel {
          background: white;
          border: 1px solid #edf0f5;
          border-radius: 16px;
          padding: 26px;
          box-shadow: 0 4px 15px rgba(15, 23, 42, 0.025);
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .panel-heading h2,
        .reward-panel h2 {
          margin: 8px 0 0;
          font-size: 21px;
          color: #172033;
        }

        .panel-icon {
          font-size: 22px;
        }

        .profile-details {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 15px 0;
          border-bottom: 1px solid #f1f3f7;
          font-size: 13px;
        }

        .detail-row span {
          color: #64748b;
        }

        .detail-row strong {
          color: #172033;
          text-align: right;
        }

        .active-status {
          color: #059669 !important;
        }

        .profile-note {
          margin-top: 20px;
          padding: 12px;
          border-radius: 9px;
          background: #f0fdf4;
          color: #15803d;
          font-size: 12px;
        }

        .reward-panel {
          background: linear-gradient(145deg, #172554, #1e40af);
          color: white;
          border: 0;
        }

        .reward-panel .section-label {
          color: #bfdbfe;
        }

        .reward-panel h2 {
          color: white;
        }

        .reward-balance {
          margin: 22px 0;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .reward-balance span {
          color: #dbeafe;
          font-size: 13px;
        }

        .reward-balance strong {
          font-size: 30px;
        }

        .reward-panel p {
          color: #dbeafe;
          font-size: 13px;
          line-height: 1.7;
        }

        .reward-conversion {
          margin: 20px 0;
          padding: 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
          color: white;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
        }

        .shop-button {
          display: inline-block;
          padding: 12px 19px;
          border-radius: 9px;
          background: white;
          color: #1d4ed8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .reward-panel .shop-button {
          background: white;
        }

        .orders-panel {
          padding: 28px;
        }

        .orders-heading {
          margin-bottom: 20px;
        }

        .order-count {
          padding: 8px 13px;
          border-radius: 20px;
          background: #eff6ff;
          color: #2563eb;
          font-size: 12px;
          font-weight: 700;
        }

        .empty-orders {
          padding: 50px 15px;
          text-align: center;
        }

        .empty-icon {
          font-size: 40px;
        }

        .empty-orders h3 {
          margin: 15px 0 8px;
          color: #172033;
        }

        .empty-orders p {
          margin-bottom: 22px;
          color: #64748b;
          font-size: 13px;
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .order-card {
          border: 1px solid #e9edf4;
          border-radius: 12px;
          overflow: hidden;
        }

        .order-main {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 20px;
          padding: 19px;
        }

        .order-info,
        .order-price {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .order-number {
          color: #172033;
          font-size: 13px;
          font-weight: 800;
        }

        .order-date {
          color: #94a3b8;
          font-size: 11px;
        }

        .order-price {
          align-items: flex-end;
        }

        .order-price strong {
          color: #172033;
          font-size: 15px;
        }

        .status-badge {
          padding: 5px 10px;
          border-radius: 20px;
          background: #fef3c7;
          color: #92400e;
          font-size: 10px;
          font-weight: 800;
        }

        .status-badge.confirmed {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-badge.shipped {
          background: #ede9fe;
          color: #6d28d9;
        }

        .status-badge.delivered {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }

        .details-button {
          padding: 9px 12px;
          border: 1px solid #dbeafe;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .order-details {
          padding: 20px;
          border-top: 1px solid #e9edf4;
          background: #fafbfe;
        }

        .order-details h3 {
          margin: 0 0 15px;
          font-size: 14px;
        }

        .order-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .order-item,
        .order-total-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          font-size: 12px;
          color: #64748b;
        }

        .order-item strong,
        .order-total-row strong {
          color: #172033;
        }

        .order-total-row {
          padding: 8px 0;
        }

        .final-total {
          margin-top: 7px;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
        }

        .tracking-link {
          display: inline-block;
          margin-top: 15px;
          color: #2563eb;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .dashboard-error {
          margin-bottom: 20px;
          padding: 13px;
          border-radius: 9px;
          background: #fef2f2;
          color: #dc2626;
          font-size: 13px;
        }

        .dashboard-footer {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 25px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .dashboard-footer a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .dashboard-header {
            height: auto;
            min-height: 70px;
            padding: 15px 18px;
          }

          .brand {
            font-size: 19px;
          }

          .dashboard-header nav {
            gap: 12px;
          }

          .dashboard-header nav a {
            font-size: 11px;
          }

          .dashboard-header nav button {
            padding: 9px 11px;
            font-size: 11px;
          }

          .dashboard-container {
            padding: 28px 14px;
          }

          .welcome-section h1 {
            font-size: 24px;
          }

          .stats-grid {
            gap: 10px;
          }

          .stat-card {
            padding: 14px 10px;
            gap: 9px;
          }

          .stat-icon {
            width: 35px;
            height: 35px;
            font-size: 16px;
          }

          .stat-card p {
            font-size: 10px;
          }

          .stat-card h2 {
            font-size: 17px;
          }

          .panel {
            padding: 19px;
          }

          .order-main {
            grid-template-columns: 1fr auto;
            gap: 12px;
          }

          .details-button {
            grid-column: 1 / -1;
            width: 100%;
          }

          .dashboard-footer {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}