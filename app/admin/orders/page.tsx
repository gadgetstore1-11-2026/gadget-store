"use client";

import "./admin.css";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, app } from "@/lib/firebase";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

import {
  subscribeToOrders,
  changeOrderStatus,
  removeOrder,
} from "@/lib/orders";

type OrderItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  emoji?: string;
};

type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

type Order = {
  id?: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    district: string;
    address: string;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  status?: OrderStatus;
};

const statuses: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [newOrderCount, setNewOrderCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const previousOrderIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const notificationEnabledRef = useRef(false);
  const messagingUnsubscribeRef = useRef<(() => void) | null>(null);

  function playNotificationSound() {
    try {
      const audioContext = audioContextRef.current;

      if (!audioContext || audioContext.state !== "running") return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.6
      );

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.6);
    } catch (error) {
      console.error("Notification sound failed:", error);
    }
  }

  async function enableNotifications(requestPermission = true) {
    try {
      if (requestPermission) {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as Window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (AudioContextClass) {
          let audioContext = audioContextRef.current;

          if (!audioContext || audioContext.state === "closed") {
            audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;
          }

          await audioContext.resume();
          soundEnabledRef.current = true;
          setSoundEnabled(true);
        }
      }

      if (!("Notification" in window)) {
        setMessage("This browser does not support notifications.");
        return;
      }

      let permission = Notification.permission;

      if (permission === "default" && requestPermission) {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setMessage("Notification permission was not granted.");
        return;
      }

      const supported = await isSupported();

      if (!supported) {
        setMessage("Firebase Messaging is not supported in this browser.");
        return;
      }

      const serviceWorkerRegistration =
        await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

      const messaging = getMessaging(app);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        setMessage("Firebase VAPID Key was not found.");
        return;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      if (!token) {
        setMessage("FCM Token could not be generated.");
        return;
      }

      console.log("Gadget Store FCM Token generated successfully.");
console.log("FCM Registration Token:", token);

      if (!messagingUnsubscribeRef.current) {
        messagingUnsubscribeRef.current = onMessage(
          messaging,
          (payload) => {
            if (!notificationEnabledRef.current) return;

            const title =
              payload.notification?.title || "Gadget Store - New Order";

            const body =
              payload.notification?.body ||
              "You have received a new notification.";

            new Notification(title, { body });

            if (soundEnabledRef.current) {
              playNotificationSound();
            }

            setMessage("New push notification received!");
          }
        );
      }

      localStorage.setItem("gadget-store-notifications", "enabled");

      notificationEnabledRef.current = true;
      setNotificationEnabled(true);
      setMessage("Push Notifications enabled successfully!");
    } catch (error) {
      console.error("Notification setup failed:", error);
      setMessage("Could not enable notifications. Please try again.");
    }
  }

  function disableNotifications() {
    localStorage.setItem("gadget-store-notifications", "disabled");

    notificationEnabledRef.current = false;
    soundEnabledRef.current = false;

    if (messagingUnsubscribeRef.current) {
      messagingUnsubscribeRef.current();
      messagingUnsubscribeRef.current = null;
    }

    setNotificationEnabled(false);
    setSoundEnabled(false);

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setMessage("Notifications and sound have been disabled.");
  }

  useEffect(() => {
    const savedSetting = localStorage.getItem(
      "gadget-store-notifications"
    );

    if (
      savedSetting === "enabled" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      notificationEnabledRef.current = true;
      setNotificationEnabled(true);
      enableNotifications(false);
    } else {
      notificationEnabledRef.current = false;
      setNotificationEnabled(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeOrders: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user: User | null) => {
        if (!user) {
          setIsAuthenticated(false);
          setAuthChecked(true);
          setReady(false);
          window.location.replace("/admin/orders/login");
          return;
        }

        setIsAuthenticated(true);
        setAuthChecked(true);

        if (unsubscribeOrders) {
          unsubscribeOrders();
        }

        previousOrderIds.current = null;

        unsubscribeOrders = subscribeToOrders(
          (onlineOrders) => {
            const validOrders = onlineOrders.map((order) => ({
              ...order,
              status: order.status || "Pending",
            }));

            const currentIds = new Set(
              validOrders
                .map((order) => order.id)
                .filter((id): id is string => Boolean(id))
            );

            if (previousOrderIds.current !== null) {
              const newOrders = validOrders.filter(
                (order) =>
                  order.id &&
                  !previousOrderIds.current!.has(order.id)
              );

              if (newOrders.length > 0) {
                setNewOrderCount(
                  (count) => count + newOrders.length
                );

                setMessage(
                  `${newOrders.length} new order(s) received!`
                );

                if (
                  notificationEnabledRef.current &&
                  "Notification" in window &&
                  Notification.permission === "granted"
                ) {
                  new Notification("Gadget Store - New Order", {
                    body: `${newOrders.length} new order(s) received.`,
                  });
                }

                if (
                  notificationEnabledRef.current &&
                  soundEnabledRef.current
                ) {
                  playNotificationSound();
                }
              }
            }

            previousOrderIds.current = currentIds;
            setOrders(validOrders);
            setReady(true);
          },
          (error) => {
            console.error("Order listener failed:", error);
            setMessage("Could not load orders from Firebase.");
            setReady(true);
          }
        );
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeOrders) unsubscribeOrders();

      if (messagingUnsubscribeRef.current) {
        messagingUnsubscribeRef.current();
        messagingUnsubscribeRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  async function updateStatus(
    orderNumber: string,
    status: OrderStatus
  ) {
    const order = orders.find(
      (item) => item.orderNumber === orderNumber
    );

    if (!order?.id) {
      setMessage("Order Firebase ID was not found.");
      return;
    }

    try {
      await changeOrderStatus(order.id, status);

      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.orderNumber === orderNumber
            ? { ...item, status }
            : item
        )
      );

      setMessage("Order status updated successfully.");
    } catch (error) {
      console.error("Order status update failed:", error);
      setMessage("Could not update order status.");
    }
  }

  async function deleteOrder(orderNumber: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete order ${orderNumber}?`
    );

    if (!confirmed) return;

    const order = orders.find(
      (item) => item.orderNumber === orderNumber
    );

    if (!order?.id) {
      setMessage("Order Firebase ID was not found.");
      return;
    }

    try {
      await removeOrder(order.id);

      setOrders((currentOrders) =>
        currentOrders.filter(
          (item) => item.orderNumber !== orderNumber
        )
      );

      if (expandedOrder === orderNumber) {
        setExpandedOrder(null);
      }

      setMessage("Order deleted successfully.");
    } catch (error) {
      console.error("Order deletion failed:", error);
      setMessage("Could not delete the order.");
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      window.location.replace("/admin/orders/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setMessage("Logout failed. Please try again.");
    }
  }

  const money = (amount: number) =>
    `৳${amount.toLocaleString("en-BD")}`;

  const pendingCount = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const confirmedCount = orders.filter(
    (order) => order.status === "Confirmed"
  ).length;

  const deliveredCount = orders.filter(
    (order) => order.status === "Delivered"
  ).length;

  const totalSales = orders
    .filter((order) => order.status !== "Cancelled")
    .reduce((sum, order) => sum + order.total, 0);

  // Sales Analytics

  const deliveredOrders = orders.filter(
    (order) => order.status === "Delivered"
  );

  const today = new Date();

  const totalRevenue = deliveredOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const todayRevenue = deliveredOrders
    .filter((order) => {
      const date = new Date(order.createdAt);
      return date.toDateString() === today.toDateString();
    })
    .reduce((sum, order) => sum + order.total, 0);

  const monthlyRevenue = deliveredOrders
    .filter((order) => {
      const date = new Date(order.createdAt);
      return date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    })
    .reduce((sum, order) => sum + order.total, 0);

  const monthlySales = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);

    const revenue = deliveredOrders
      .filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === date.getMonth() &&
          orderDate.getFullYear() === date.getFullYear();
      })
      .reduce((sum, order) => sum + order.total, 0);

    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      revenue,
    };
  });

  const productSales = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();

  deliveredOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = String(item.id);
      const existing = productSales.get(key);

      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        productSales.set(key, {
          name: item.name,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
        });
      }
    });
  });

  const bestSellingProducts = Array.from(productSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search) ||
      order.customer.name.toLowerCase().includes(search) ||
      order.customer.phone.includes(search);

    const matchesStatus =
      statusFilter === "All" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!authChecked || !ready) {
    return (
      <main className="admin-loading-screen">
        <div className="admin-loading-card">
          <div className="admin-loading-spinner" />
          <h2>Gadget Store Admin</h2>
          <p>Verifying access and loading orders...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="admin-loading-screen">
        <div className="admin-loading-card">
          <div className="admin-loading-spinner" />
          <p>Redirecting to Login...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gs-admin">
      {/* Sidebar */}
      <aside className="gs-sidebar">
        <Link href="/" className="gs-sidebar-brand">
          <span className="gs-brand-icon">G</span>
          <span>
            <strong>GADGET STORE</strong>
            <small>ADMIN PANEL</small>
          </span>
        </Link>

        <div className="gs-sidebar-section">
          <span className="gs-sidebar-heading">MENU</span>

          <a href="#dashboard" className="gs-sidebar-link active">
            <span>▦</span>
            Dashboard
          </a>

          <a href="#orders" className="gs-sidebar-link">
            <span>▤</span>
            Orders
            <b>{orders.length}</b>
          </a>
          <Link href="/admin/products" className="gs-sidebar-link">
  <span>▣</span>
  Products
</Link>
<Link href="/admin/categories" className="gs-sidebar-link">
  <span>▦</span>
  Categories
</Link>

<Link href="/admin/customers" className="gs-sidebar-link">
  <span>👥</span>
  Customers
</Link>

<Link href="/admin/settings" className="admin-nav-link">
<span>⚙️</span>
  <span>Settings</span>
</Link>

          <Link href="/" className="gs-sidebar-link">
            <span>▣</span>
            View Store
          </Link>
        </div>

        <div className="gs-sidebar-bottom">
          <div className="gs-sidebar-help">
            <span>💜</span>
            <strong>Need assistance?</strong>
            <p>Manage your store from one place.</p>
          </div>

          <button
            type="button"
            className="gs-sidebar-logout"
            onClick={handleLogout}
          >
            <span>↪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <section className="gs-admin-main">
        {/* Topbar */}
        <header className="gs-topbar">
          <div>
            <span className="gs-topbar-label">GADGET STORE / ADMIN</span>
            <h2>Dashboard</h2>
          </div>

          <div className="gs-topbar-actions">
            <button
              type="button"
              className={`gs-notification-button ${
                notificationEnabled ? "enabled" : ""
              }`}
              onClick={() =>
                notificationEnabled
                  ? disableNotifications()
                  : enableNotifications(true)
              }
              title="Toggle notifications"
            >
              {notificationEnabled ? "🔔" : "🔕"}
            </button>

            <div className="gs-admin-profile">
              <div className="gs-profile-avatar">A</div>
              <div>
                <strong>Administrator</strong>
                <span>Store Manager</span>
              </div>
            </div>
          </div>
        </header>

        <div className="gs-admin-content" id="dashboard">
          {/* Welcome */}
          <div className="gs-welcome">
            <div>
              <span className="gs-eyebrow">OVERVIEW</span>
              <h1>Welcome back, Admin! 👋</h1>
              <p>Here&apos;s what&apos;s happening with your store today.</p>
            </div>

            <button
              type="button"
              className="gs-refresh-button"
              onClick={() => window.location.reload()}
            >
              ↻ Refresh Data
            </button>
          </div>

          {/* Statistics */}
          <div className="gs-stats-grid">
            <article className="gs-stat-card">
              <div className="gs-stat-top">
                <span>Total Orders</span>
                <div className="gs-stat-icon purple">▤</div>
              </div>
              <strong>{orders.length}</strong>
              <small>All customer orders</small>
            </article>

            <article className="gs-stat-card">
              <div className="gs-stat-top">
                <span>Pending Orders</span>
                <div className="gs-stat-icon orange">◷</div>
              </div>
              <strong>{pendingCount}</strong>
              <small>Waiting for confirmation</small>
            </article>

            <article className="gs-stat-card">
              <div className="gs-stat-top">
                <span>Confirmed Orders</span>
                <div className="gs-stat-icon blue">✓</div>
              </div>
              <strong>{confirmedCount}</strong>
              <small>Ready for processing</small>
            </article>

            <article className="gs-stat-card">
              <div className="gs-stat-top">
                <span>Delivered Orders</span>
                <div className="gs-stat-icon green">✓</div>
              </div>
              <strong>{deliveredCount}</strong>
              <small>Successfully delivered</small>
            </article>
          </div>

          {/* Sales Analytics Overview */}
          <section style={{
            marginTop: "28px",
            marginBottom: "28px",
            background: "#ffffff",
            padding: "24px",
            borderRadius: "18px",
            border: "1px solid #eee",
          }}>
            <div style={{ marginBottom: "22px" }}>
              <span className="gs-eyebrow">BUSINESS PERFORMANCE</span>
              <h2 style={{ fontSize: "24px", fontWeight: 800, marginTop: "6px" }}>
                Sales Analytics
              </h2>
              <p style={{ color: "#777", marginTop: "5px" }}>
                Revenue overview based on delivered orders.
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}>
              {[
                { title: "Total Revenue", value: totalRevenue, icon: "৳", color: "#7047eb" },
                { title: "Today's Revenue", value: todayRevenue, icon: "📅", color: "#0d9488" },
                { title: "Monthly Revenue", value: monthlyRevenue, icon: "📈", color: "#2563eb" },
              ].map((item) => (
                <article key={item.title} style={{
                  padding: "22px",
                  borderRadius: "14px",
                  background: "#f8f7ff",
                  border: "1px solid #eeeaff",
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>
                      {item.title}
                    </span>
                    <span style={{
                      width: "38px",
                      height: "38px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "11px",
                      background: "#ffffff",
                      color: item.color,
                      fontWeight: 800,
                    }}>
                      {item.icon}
                    </span>
                  </div>
                  <h3 style={{
                    fontSize: "25px",
                    fontWeight: 800,
                    marginTop: "14px",
                    color: "#17152b",
                  }}>
                    {money(item.value)}
                  </h3>
                  <small style={{ color: "#888" }}>
                    Delivered orders only
                  </small>
                </article>
              ))}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}>
              <div style={{
                padding: "20px",
                border: "1px solid #eee",
                borderRadius: "14px",
              }}>
                <h3 style={{ fontSize: "17px", fontWeight: 700 }}>
                  Monthly Sales
                </h3>
                <p style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>
                  Revenue over the last 6 months
                </p>

                <div style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-around",
                  gap: "12px",
                  height: "210px",
                  marginTop: "22px",
                  borderBottom: "1px solid #eee",
                }}>
                  {monthlySales.map((item) => {
                    const maxRevenue = Math.max(
                      ...monthlySales.map((sale) => sale.revenue),
                      1
                    );

                    const height = item.revenue > 0
                      ? Math.max((item.revenue / maxRevenue) * 155, 8)
                      : 4;

                    return (
                      <div key={item.month} style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "8px",
                      }}>
                        <small style={{
                          fontSize: "10px",
                          color: "#777",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}>
                          {item.revenue > 0 ? money(item.revenue) : "৳0"}
                        </small>
                        <div title={money(item.revenue)} style={{
                          width: "70%",
                          maxWidth: "42px",
                          height: height + "px",
                          minHeight: "4px",
                          background: "linear-gradient(180deg, #9675ff, #7047eb)",
                          borderRadius: "7px 7px 0 0",
                          transition: "height .3s ease",
                        }} />
                        <span style={{
                          fontSize: "12px",
                          color: "#666",
                          paddingBottom: "8px",
                        }}>
                          {item.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{
                padding: "20px",
                border: "1px solid #eee",
                borderRadius: "14px",
              }}>
                <h3 style={{ fontSize: "17px", fontWeight: 700 }}>
                  Best-Selling Products
                </h3>
                <p style={{ color: "#888", fontSize: "13px", marginTop: "4px" }}>
                  Top 5 products by delivered quantity
                </p>

                {bestSellingProducts.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "45px 10px",
                    color: "#999",
                  }}>
                    <div style={{ fontSize: "35px" }}>📦</div>
                    <p>No delivered product sales yet.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: "16px" }}>
                    {bestSellingProducts.map((product, index) => (
                      <div key={product.name} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        padding: "14px 0",
                        borderBottom: index === bestSellingProducts.length - 1
                          ? "none"
                          : "1px solid #f0f0f0",
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          minWidth: 0,
                        }}>
                          <span style={{
                            width: "34px",
                            height: "34px",
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "10px",
                            background: "#f1edff",
                            color: "#7047eb",
                            fontWeight: 800,
                          }}>
                            {index + 1}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{
                              display: "block",
                              fontSize: "13px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {product.name}
                            </strong>
                            <small style={{ color: "#888" }}>
                              {product.quantity} units sold
                            </small>
                          </div>
                        </div>
                        <strong style={{
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                          color: "#7047eb",
                        }}>
                          {money(product.revenue)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          {/* Sales Summary */}
          <div className="gs-sales-banner">
            <div>
              <span>ORDER VALUE SUMMARY</span>
              <h2>{money(totalSales)}</h2>
              <p>Total value of non-cancelled orders</p>
            </div>
            <div className="gs-sales-decoration">৳</div>
          </div>

          {/* Notifications */}
          <section className="gs-notification-panel">
            <div className="gs-notification-info">
              <div className="gs-notification-icon">🔔</div>
              <div>
                <h3>Order Notifications</h3>
                <p>
                  {notificationEnabled
                    ? "Notifications and sound are enabled."
                    : "Turn on notifications to receive new order alerts."}
                </p>
                <span className="gs-new-order-count">
                  {newOrderCount} new order(s) since opening dashboard
                </span>
              </div>
            </div>

            <button
              type="button"
              className={
                notificationEnabled
                  ? "gs-notification-toggle on"
                  : "gs-notification-toggle"
              }
              onClick={() =>
                notificationEnabled
                  ? disableNotifications()
                  : enableNotifications(true)
              }
            >
              {notificationEnabled ? "Turn Off" : "Enable Alerts"}
            </button>
          </section>

          {/* Message */}
          {message && (
            <div className="gs-admin-message" role="status">
              <span>●</span>
              {message}
              <button
                type="button"
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {/* Orders */}
          <section className="gs-orders-section" id="orders">
            <div className="gs-section-heading">
              <div>
                <span className="gs-eyebrow">STORE MANAGEMENT</span>
                <h2>Recent Orders</h2>
                <p>View, manage and track your customer orders.</p>
              </div>

              <span className="gs-orders-total">
                {filteredOrders.length} Orders
              </span>
            </div>

            {/* Search and Filter */}
            <div className="gs-order-toolbar">
              <div className="gs-search-box">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder="Search order number, customer or phone..."
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                />
              </div>

              <select
                className="gs-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="All">All Orders</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Empty State */}
            {orders.length === 0 ? (
              <div className="gs-empty-state">
                <div>📦</div>
                <h3>No Orders Yet</h3>
                <p>Your customer orders will appear here.</p>
                <Link href="/" className="gs-primary-button">
                  Visit Store
                </Link>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="gs-empty-state">
                <div>🔍</div>
                <h3>No Orders Found</h3>
                <p>Try changing your search or status filter.</p>
                <button
                  type="button"
                  className="gs-primary-button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("All");
                  }}
                >
                  Show All Orders
                </button>
              </div>
            ) : (
              <div className="gs-order-list">
                {filteredOrders.map((order) => {
                  const isExpanded =
                    expandedOrder === order.orderNumber;

                  return (
                    <article
                      className="gs-order-card"
                      key={order.id || order.orderNumber}
                    >
                      <div className="gs-order-card-top">
                        <div className="gs-order-number-area">
                          <span>ORDER NUMBER</span>
                          <h3>{order.orderNumber}</h3>
                          <small>
                            {new Date(order.createdAt).toLocaleString("en-BD")}
                          </small>
                        </div>

                        <div className="gs-order-customer">
                          <span>CUSTOMER</span>
                          <strong>{order.customer.name}</strong>
                          <small>{order.customer.phone}</small>
                        </div>

                        <div className="gs-order-amount">
                          <span>TOTAL AMOUNT</span>
                          <strong>{money(order.total)}</strong>
                        </div>

                        <div className="gs-order-status">
                          <span className={`gs-status-badge ${(order.status || "Pending").toLowerCase()}`}>
                            {order.status || "Pending"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="gs-view-details"
                          onClick={() =>
                            setExpandedOrder(
                              isExpanded ? null : order.orderNumber
                            )
                          }
                        >
                          {isExpanded ? "Hide ▲" : "Details ▼"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="gs-order-details">
                          <div className="gs-details-grid">
                            <div className="gs-detail-box">
                              <h4>Customer Information</h4>

                              <p>
                                <strong>Name:</strong>{" "}
                                {order.customer.name}
                              </p>

                              <p>
                                <strong>Phone:</strong>{" "}
                                {order.customer.phone}
                              </p>

                              <p>
                                <strong>District:</strong>{" "}
                                {order.customer.district}
                              </p>

                              <p>
                                <strong>Address:</strong>{" "}
                                {order.customer.address}
                              </p>
                            </div>

                            <div className="gs-detail-box">
                              <h4>Payment Information</h4>

                              <p>
                                <strong>Payment:</strong>{" "}
                                {order.paymentMethod}
                              </p>

                              <p>
                                <strong>Subtotal:</strong>{" "}
                                {money(order.subtotal)}
                              </p>

                              <p>
                                <strong>Delivery:</strong>{" "}
                                {money(order.deliveryCharge)}
                              </p>

                              <p>
                                <strong>Grand Total:</strong>{" "}
                                <strong>{money(order.total)}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="gs-detail-box gs-products-box">
                            <h4>Ordered Products</h4>

                            {order.items.map((item, index) => (
                              <div
                                className="gs-product-line"
                                key={`${item.id}-${index}`}
                              >
                                <span>
                                  {item.emoji || "📦"} {item.name} ×{" "}
                                  {item.quantity}
                                </span>

                                <strong>
                                  {money(item.price * item.quantity)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="gs-order-card-footer">
                        <label>
                          Update Status
                          <select
                            value={order.status || "Pending"}
                            onChange={(event) =>
                              updateStatus(
                                order.orderNumber,
                                event.target.value as OrderStatus
                              )
                            }
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          className="gs-delete-button"
                          onClick={() =>
                            deleteOrder(order.orderNumber)
                          }
                        >
                          🗑 Delete Order
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="gs-admin-footer">
            © {new Date().getFullYear()} Gadget Store. Admin Dashboard.
          </footer>
        </div>
      </section>
    </main>
  );
}