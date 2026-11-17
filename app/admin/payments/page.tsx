"use client";

import "../orders/admin.css";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToOrders } from "@/lib/orders";

type PaymentOrder = {
  id?: string;
  orderNumber: string;
  customer?: { name?: string; phone?: string; address?: string };
  total?: number;
  deliveryCharge?: number;
  paymentMethod?: string;
  paymentChoice?: "delivery" | "full" | "request_later";
  paymentAmount?: number;
  paymentStatus?: string;
  paymentTransactionId?: string;
  paymentSenderNumber?: string;
  deliveryChargeLaterStatus?: string;
  createdAt?: string;
};

type FilterKey = "all" | "pending" | "later" | "approved" | "rejected";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";
const money = (value: number) => `৳${Number(value || 0).toLocaleString("en-BD")}`;
const dateText = (value?: string) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Payments" },
  { key: "pending", label: "Pending Verification" },
  { key: "later", label: "Pay Later Requests" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);

  useEffect(() => {
    let unsubscribeOrders: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeOrders?.();
      if (!user || user.uid !== ADMIN_UID) {
        window.location.replace("/admin/orders/login");
        return;
      }
      unsubscribeOrders = subscribeToOrders(
        (items) => { setOrders(items as PaymentOrder[]); setLoading(false); },
        () => { setNotice("Unable to load payment records. Please refresh the page."); setLoading(false); }
      );
    });
    return () => { unsubscribeAuth(); unsubscribeOrders?.(); };
  }, []);

  const eligibleOrders = useMemo(() => orders.filter((order) =>
    Boolean(order.paymentChoice || order.paymentStatus || order.deliveryChargeLaterStatus)
  ), [orders]);

  const counts = useMemo(() => ({
    all: eligibleOrders.length,
    pending: eligibleOrders.filter((o) => o.paymentStatus === "Pending Verification").length,
    later: eligibleOrders.filter((o) => o.deliveryChargeLaterStatus === "Pending").length,
    approved: eligibleOrders.filter((o) => o.paymentStatus === "Verified" || o.deliveryChargeLaterStatus === "Approved").length,
    rejected: eligibleOrders.filter((o) => o.paymentStatus === "Rejected" || o.deliveryChargeLaterStatus === "Rejected").length,
  }), [eligibleOrders]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return eligibleOrders.filter((order) => {
      const pending = order.paymentStatus === "Pending Verification";
      const later = order.deliveryChargeLaterStatus === "Pending";
      const approved = order.paymentStatus === "Verified" || order.deliveryChargeLaterStatus === "Approved";
      const rejected = order.paymentStatus === "Rejected" || order.deliveryChargeLaterStatus === "Rejected";
      const matchesFilter = filter === "all" ||
        (filter === "pending" && pending) || (filter === "later" && later) ||
        (filter === "approved" && approved) || (filter === "rejected" && rejected);
      const matchesSearch = !term || [order.orderNumber, order.customer?.name, order.customer?.phone, order.paymentTransactionId, order.paymentSenderNumber, order.paymentMethod]
        .some((value) => String(value || "").toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [eligibleOrders, filter, search]);

  async function updatePayment(order: PaymentOrder, action: "approve_payment" | "reject_payment" | "approve_later" | "reject_later") {
    if (!order.id) return;
    const approving = action.startsWith("approve");
    if (!window.confirm(approving ? "Have you manually verified the wallet transaction or reviewed the request? Continue?" : "Reject this payment request?")) return;
    setBusyId(order.id);
    setNotice("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin authentication required.");
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to update payment.");
      setNotice(approving ? "Request approved successfully." : "Request rejected successfully.");
      setSelectedOrder(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update payment.");
    } finally { setBusyId(""); }
  }

  const statCards: { label: string; value: number; note: string; tone: string; icon: string }[] = [
    { label: "Total Payments", value: counts.all, note: "All payment-related orders", tone: "#635bdb", icon: "৳" },
    { label: "Pending Verification", value: counts.pending, note: "Transactions to review", tone: "#d97706", icon: "◷" },
    { label: "Pay Later Requests", value: counts.later, note: "Awaiting admin decision", tone: "#2563eb", icon: "↗" },
    { label: "Approved Payments", value: counts.approved, note: "Verified or accepted", tone: "#15945b", icon: "✓" },
    { label: "Rejected Payments", value: counts.rejected, note: "Declined requests", tone: "#dc4444", icon: "×" },
  ];

  return (
    <main className="gs-admin-main" style={{ background: "#f7f8fc", minHeight: "100vh", padding: "28px clamp(16px, 3vw, 34px)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
        <div>
          <p style={{ color: "#7166d8", fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", margin: "0 0 8px" }}>FINANCE &amp; OPERATIONS</p>
          <h1 style={{ color: "#1c2140", fontSize: "clamp(25px, 3vw, 32px)", lineHeight: 1.15, margin: 0, fontWeight: 800 }}>Payments</h1>
          <p style={{ color: "#778096", margin: "9px 0 0", fontSize: 14 }}>Review customer transactions and delivery-charge requests.</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e9eaf2", borderRadius: 12, padding: "10px 14px", color: "#667085", fontSize: 12 }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#20b477", marginRight: 8 }} />Live order data</div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14, marginBottom: 24 }}>
        {statCards.map((card) => <div key={card.label} style={{ background: "#fff", border: "1px solid #eceef5", borderRadius: 15, padding: "17px 18px", boxShadow: "0 4px 16px rgba(31,38,80,.035)", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ color: "#778096", fontSize: 12, fontWeight: 650 }}>{card.label}</span><span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", color: card.tone, background: `${card.tone}14`, fontWeight: 800 }}>{card.icon}</span></div>
          <strong style={{ display: "block", color: "#202642", fontSize: 27, lineHeight: 1.2, marginTop: 12 }}>{card.value}</strong>
          <span style={{ display: "block", color: "#9aa1b2", fontSize: 11, marginTop: 5 }}>{card.note}</span>
        </div>)}
      </section>

      <section style={{ background: "#fff", border: "1px solid #e9ebf3", borderRadius: 16, boxShadow: "0 5px 22px rgba(31,38,80,.04)", overflow: "hidden" }}>
        <div style={{ padding: "19px 20px 0", borderBottom: "1px solid #edf0f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 17 }}>
            <div><h2 style={{ color: "#252b45", fontSize: 17, margin: 0, fontWeight: 750 }}>Payment records</h2><p style={{ color: "#9299aa", fontSize: 12, margin: "5px 0 0" }}>{visibleOrders.length} record{visibleOrders.length === 1 ? "" : "s"} found</p></div>
            <label style={{ position: "relative", display: "block", width: "min(100%, 310px)" }}><span aria-hidden="true" style={{ position: "absolute", left: 12, top: 10, color: "#9299aa" }}>⌕</span><input aria-label="Search payments" placeholder="Search order, customer, transaction..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e4e7ef", background: "#fafbfe", borderRadius: 10, padding: "10px 12px 10px 34px", outlineColor: "#7668df", fontSize: 12, color: "#30364f" }} /></label>
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>{filters.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} style={{ whiteSpace: "nowrap", border: filter === item.key ? "1px solid #6558d8" : "1px solid transparent", borderBottom: filter === item.key ? "2px solid #6558d8" : "2px solid transparent", borderRadius: "9px 9px 0 0", padding: "10px 12px", background: filter === item.key ? "#f4f2ff" : "transparent", color: filter === item.key ? "#5144c4" : "#70788d", fontWeight: filter === item.key ? 750 : 600, fontSize: 12, cursor: "pointer" }}>{item.label}<span style={{ marginLeft: 7, color: filter === item.key ? "#6558d8" : "#9ba2b2" }}>{counts[item.key]}</span></button>)}</div>
        </div>

        {notice && <div role="status" style={{ margin: 16, padding: "11px 13px", borderRadius: 9, background: "#f1efff", color: "#493ca8", fontSize: 13 }}>{notice}</div>}
        {loading ? <div style={{ padding: 48, textAlign: "center", color: "#8991a4" }}>Loading payment records...</div> : visibleOrders.length === 0 ? <div style={{ padding: "54px 20px", textAlign: "center" }}><div style={{ margin: "0 auto 12px", width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 14, background: "#f3f2ff", color: "#6558d8", fontSize: 23 }}>৳</div><h3 style={{ margin: 0, color: "#30364f", fontSize: 16 }}>No payment records found</h3><p style={{ margin: "7px 0 0", color: "#9299aa", fontSize: 13 }}>Try another filter or search term. New payment submissions will appear here.</p></div> : (
          <div style={{ overflowX: "auto" }}><table className="gs-admin-table" style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}><thead><tr style={{ background: "#fafbfe" }}>{["ORDER DETAILS", "CUSTOMER", "PAYMENT", "AMOUNT", "TRANSACTION", "STATUS", "ACTIONS"].map((heading) => <th key={heading} style={{ color: "#8b93a5", fontSize: 10, letterSpacing: ".7px", fontWeight: 750, padding: "13px 14px", textAlign: "left", borderBottom: "1px solid #edf0f5", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead><tbody>
            {visibleOrders.map((order) => {
              const pendingPayment = order.paymentStatus === "Pending Verification";
              const pendingLater = order.deliveryChargeLaterStatus === "Pending";
              const rejected = order.paymentStatus === "Rejected" || order.deliveryChargeLaterStatus === "Rejected";
              const status = pendingLater ? "Pay Later Pending" : order.paymentStatus || (order.deliveryChargeLaterStatus === "Approved" ? "Pay Later Approved" : order.deliveryChargeLaterStatus) || "Awaiting Advance Payment";
              const statusColor = pendingPayment || pendingLater ? { bg: "#fff5df", fg: "#a56808" } : rejected ? { bg: "#fff0f0", fg: "#c23d3d" } : status.includes("Verified") || status.includes("Approved") ? { bg: "#eaf8f0", fg: "#18834e" } : { bg: "#eef2ff", fg: "#5362a8" };
              const paymentLabel = order.paymentChoice === "full" ? "Full payment" : order.paymentChoice === "delivery" ? "Delivery advance + COD" : order.paymentChoice === "request_later" ? "Pay delivery later" : "Payment";
              return <tr key={order.id || order.orderNumber} style={{ borderBottom: "1px solid #f0f1f5" }}>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><strong style={{ display: "block", color: "#303653", fontSize: 12 }}>{order.orderNumber}</strong><small style={{ color: "#9aa1b1", fontSize: 11 }}>{dateText(order.createdAt)}</small></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><strong style={{ display: "block", color: "#454b63", fontSize: 12 }}>{order.customer?.name || "—"}</strong><small style={{ color: "#9299aa", fontSize: 11 }}>{order.customer?.phone || "—"}</small></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><strong style={{ display: "block", color: "#454b63", fontSize: 12 }}>{order.paymentMethod || "—"}</strong><small style={{ color: "#9299aa", fontSize: 11 }}>{paymentLabel}</small></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><strong style={{ color: "#303653", fontSize: 13 }}>{money(Number(order.paymentAmount ?? order.deliveryCharge ?? 0))}</strong><small style={{ display: "block", color: "#9299aa", fontSize: 11 }}>Order: {money(Number(order.total || 0))}</small></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><strong style={{ display: "block", color: "#454b63", fontSize: 12 }}>{order.paymentTransactionId || "—"}</strong><small style={{ color: "#9299aa", fontSize: 11 }}>{order.paymentSenderNumber || ""}</small></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><span style={{ display: "inline-block", background: statusColor.bg, color: statusColor.fg, borderRadius: 20, padding: "6px 9px", fontSize: 10, fontWeight: 750, whiteSpace: "nowrap" }}>{status}</span></td>
                <td style={{ padding: "15px 14px", verticalAlign: "middle" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><button type="button" onClick={() => setSelectedOrder(order)} style={{ border: "1px solid #e4e6ef", background: "#fff", color: "#59617a", borderRadius: 7, padding: "6px 9px", fontSize: 11, cursor: "pointer" }}>Details</button>{pendingPayment && <><button type="button" disabled={busyId === order.id} onClick={() => updatePayment(order, "approve_payment")} style={{ border: 0, background: "#e9f7ef", color: "#16804a", borderRadius: 7, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Approve</button><button type="button" disabled={busyId === order.id} onClick={() => updatePayment(order, "reject_payment")} style={{ border: 0, background: "#fff0f0", color: "#bd3d3d", borderRadius: 7, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reject</button></>}{pendingLater && <><button type="button" disabled={busyId === order.id} onClick={() => updatePayment(order, "approve_later")} style={{ border: 0, background: "#e9f7ef", color: "#16804a", borderRadius: 7, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Approve</button><button type="button" disabled={busyId === order.id} onClick={() => updatePayment(order, "reject_later")} style={{ border: 0, background: "#fff0f0", color: "#bd3d3d", borderRadius: 7, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reject</button></>}</div></td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>

      {selectedOrder && <div role="presentation" onClick={() => setSelectedOrder(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(19,23,43,.48)", display: "grid", placeItems: "center", padding: 16 }}><section role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" onClick={(e) => e.stopPropagation()} style={{ width: "min(100%, 480px)", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2 id="payment-detail-title" style={{ margin: 0, color: "#252b45", fontSize: 18 }}>Payment details</h2><button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close details" style={{ border: 0, background: "#f2f3f7", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>✕</button></div><p style={{ color: "#6558d8", fontWeight: 750, fontSize: 13 }}>{selectedOrder.orderNumber}</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>{[["Customer", selectedOrder.customer?.name || "—"], ["Phone", selectedOrder.customer?.phone || "—"], ["Method", selectedOrder.paymentMethod || "—"], ["Payment type", selectedOrder.paymentChoice || "—"], ["Amount submitted", money(Number(selectedOrder.paymentAmount ?? selectedOrder.deliveryCharge ?? 0))], ["Order total", money(Number(selectedOrder.total || 0))], ["Transaction ID", selectedOrder.paymentTransactionId || "—"], ["Sender number", selectedOrder.paymentSenderNumber || "—"], ["Payment status", selectedOrder.paymentStatus || "—"], ["Pay-later status", selectedOrder.deliveryChargeLaterStatus || "—"]].map(([label, value]) => <div key={label}><span style={{ display: "block", color: "#9299aa", marginBottom: 4 }}>{label}</span><strong style={{ color: "#30364f", overflowWrap: "anywhere" }}>{value}</strong></div>)}</div><p style={{ color: "#9a6a1a", background: "#fff7e8", borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.5, margin: "18px 0 0" }}>Manually verify the transaction in your bKash or Nagad account before approving. A submitted transaction ID is not proof of payment.</p></section></div>}
    </main>
  );
}
