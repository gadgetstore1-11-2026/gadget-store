"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import CustomerExportButton from "./export-button";
import { subscribeToOrders, type Order } from "@/lib/orders";

type FirestoreCustomer = {
  name?: string;
  phone?: string;
  district?: string;
  address?: string;
  customerId?: string;
  totalOrders?: number;
  totalSpent?: number;
  firstOrderAt?: unknown;
  lastOrderAt?: unknown;
  rewardPoints?: number;
  totalRewardPointsEarned?: number;
};

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  district: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  rewardPoints: number;
  totalRewardPointsEarned: number;
  lastOrder: string;
  orders: Order[];
};

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";
type OpeningBalancePreview = {
  success: boolean;
  readOnly: boolean;
  summary: {
    totalCustomers: number;
    customersWithPoints: number;
    openingBalancesNeeded: number;
    totalOpeningPoints: number;
    discrepancies: number;
  };
  openingBalances: {
    customerId: string;
    currentPoints: number;
    ledgerPoints: number;
    openingPoints: number;
    action: string;
  }[];
  discrepancies: {
    customerId: string;
    currentPoints: number;
    ledgerPoints: number;
    openingPoints: number;
    action: string;
  }[];
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const toDateString = (value: unknown): string => {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;

    if (typeof toDate === "function") {
      return toDate().toISOString();
    }
  }

  return "";
};

const dateFormat = (date: string) => {
  if (!date) return "N/A";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "N/A";

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTime = (date: string) => {
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const isVIPCustomer = (customer: CustomerRecord) =>
  customer.totalSpent >= 10000 || customer.totalOrders >= 3;

function buildCustomerList(
  customerDocs: FirestoreCustomer[],
  orders: Order[]
): CustomerRecord[] {
  const customerMap = new Map<string, CustomerRecord>();
  const phoneMap = new Map<string, CustomerRecord>();

  customerDocs.forEach((doc) => {
    const phone = doc.phone?.trim() || "";
    const id = doc.customerId || phone;

    const customer: CustomerRecord = {
      id,
      name: doc.name?.trim() || "Unknown Customer",
      phone,
      district: doc.district || "",
      address: doc.address || "",
      totalOrders: Number(doc.totalOrders || 0),
      totalSpent: Number(doc.totalSpent || 0),
      rewardPoints: Number(doc.rewardPoints || 0),
      totalRewardPointsEarned: Number(
        doc.totalRewardPointsEarned || 0
      ),
      lastOrder: toDateString(doc.lastOrderAt),
      orders: [],
    };

    if (id) {
      customerMap.set(id, customer);
    }

    if (phone) {
      phoneMap.set(phone, customer);
    }
  });

  orders.forEach((order) => {
    const phone = order.customer?.phone?.trim() || "";

    let customer: CustomerRecord | undefined = order.customerId
      ? customerMap.get(order.customerId)
      : undefined;

    if (!customer && phone) {
      customer = phoneMap.get(phone);
    }

    if (!customer) {
      const id =
        order.customerId || phone || `legacy-${order.orderNumber}`;

      customer = {
        id,
        name: order.customer?.name?.trim() || "Unknown Customer",
        phone,
        district: order.customer?.district || "",
        address: order.customer?.address || "",
        totalOrders: 0,
        totalSpent: 0,
        rewardPoints: 0,
        totalRewardPointsEarned: 0,
        lastOrder: order.createdAt || "",
        orders: [],
      };

      customerMap.set(id, customer);

      if (phone) {
        phoneMap.set(phone, customer);
      }
    }

    customer.orders.push(order);

    if (getTime(order.createdAt) > getTime(customer.lastOrder)) {
      customer.lastOrder = order.createdAt;
    }
  });

  const customerList = Array.from(customerMap.values());

  customerList.forEach((customer) => {
    const validOrders = customer.orders.filter(
      (order) => order.status !== "Cancelled"
    );

    customer.totalOrders = validOrders.length;

    customer.totalSpent = validOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );
  });

  return customerList.sort(
    (a, b) => getTime(b.lastOrder) - getTime(a.lastOrder)
  );
}

export default function CustomersPage() {
  const router = useRouter();

  const [customerDocs, setCustomerDocs] = useState<FirestoreCustomer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRecord | null>(null);

  const [error, setError] = useState("");
  const [openingPreview, setOpeningPreview] =
    useState<OpeningBalancePreview | null>(null);
  const [openingPreviewLoading, setOpeningPreviewLoading] = useState(false);
  const [openingPreviewError, setOpeningPreviewError] = useState("");

  const handleOpeningBalancePreview = async () => {
    try {
      setOpeningPreviewLoading(true);
      setOpeningPreviewError("");
      setOpeningPreview(null);

      const user = auth.currentUser;

      if (!user) {
        throw new Error("Admin authentication required.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        "/api/admin/rewards/opening-balance/preview",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to generate preview.");
      }

      setOpeningPreview(data as OpeningBalancePreview);
    } catch (error) {
      console.error("Opening balance preview failed:", error);
      setOpeningPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to generate preview."
      );
    } finally {
      setOpeningPreviewLoading(false);
    }
  };
  useEffect(() => {
    let unsubscribeCustomers: (() => void) | null = null;
    let unsubscribeOrders: (() => void) | null = null;
    let active = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeCustomers?.();
      unsubscribeOrders?.();

      unsubscribeCustomers = null;
      unsubscribeOrders = null;

      if (!user) {
        router.replace("/admin/orders/login");
        return;
      }

      if (user.uid !== ADMIN_UID) {
        setError("You do not have permission to access this page.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setCustomerDocs([]);
      setOrders([]);

      unsubscribeCustomers = onSnapshot(
        collection(db, "customers"),
        (snapshot) => {
          if (!active) return;

          const data = snapshot.docs.map((item) => ({
            ...item.data(),
          })) as FirestoreCustomer[];

          setCustomerDocs(data);
          setLoading(false);
          setError("");
        },
        (err) => {
          if (!active) return;

          console.error("Customer loading failed:", err);

          setError(
            "Unable to load customers. Please check Firestore permissions."
          );

          setLoading(false);
        }
      );

      unsubscribeOrders = subscribeToOrders(
        (data) => {
          if (!active) return;

          setOrders(data);
          setLoading(false);
        },
        (err) => {
          if (!active) return;

          console.error("Order loading failed:", err);
          setError("Unable to load customer order history.");
          setLoading(false);
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeCustomers?.();
      unsubscribeOrders?.();
    };
  }, [router]);

  const customers = useMemo(
    () => buildCustomerList(customerDocs, orders),
    [customerDocs, orders]
  );

  const filteredCustomers = useMemo(() => {
    const value = search.toLowerCase().trim();

    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(value) ||
        customer.phone.toLowerCase().includes(value) ||
        customer.district.toLowerCase().includes(value);

      const isVIP = isVIPCustomer(customer);

      const matchesFilter =
        customerFilter === "all" ||
        (customerFilter === "vip" && isVIP) ||
        (customerFilter === "regular" && !isVIP);

      return matchesSearch && matchesFilter;
    });
  }, [customers, search, customerFilter]);

  const totalOrders = customers.reduce(
    (sum, customer) => sum + customer.totalOrders,
    0
  );

  const totalRevenue = customers.reduce(
    (sum, customer) => sum + customer.totalSpent,
    0
  );

  const vipCustomerCount = customers.filter(isVIPCustomer).length;

  const totalRewardPoints = customers.reduce(
    (sum, customer) => sum + customer.rewardPoints,
    0
  );

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e8edf3",
    borderRadius: "16px",
    padding: "22px",
    boxShadow: "0 3px 12px rgba(15,23,42,0.035)",
  } as const;

  const buttonStyle = {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: "9px",
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 600,
  } as const;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <CustomerExportButton customers={customers} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Admin Panel / Customers
            </div>

            <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 800 }}>
              Customers
            </h1>

            <p
              style={{
                color: "#64748b",
                margin: "9px 0 0",
                fontSize: "14px",
              }}
            >
              Manage and track all Gadget Store customers.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
  <button
    onClick={handleOpeningBalancePreview}
    disabled={openingPreviewLoading}
    style={{
      ...buttonStyle,
      padding: "12px 18px",
      background: "#7c3aed",
      color: "#ffffff",
      border: "none",
      opacity: openingPreviewLoading ? 0.7 : 1,
    }}
  >
    {openingPreviewLoading ? "Loading Preview..." : "Preview Opening Balance"}
  </button>

  <button
    onClick={() => router.push("/admin/orders")}
    style={{
      ...buttonStyle,
      padding: "12px 18px",
      color: "#334155",
    }}
  >
    ← Dashboard
  </button>
</div>
        </div>

        {openingPreviewError && (
          <div
            style={{
              ...cardStyle,
              marginBottom: "20px",
              color: "#dc2626",
            }}
          >
            {openingPreviewError}
          </div>
        )}

        {openingPreview && (
          <section
            style={{
              ...cardStyle,
              marginBottom: "25px",
              border: "1px solid #c4b5fd",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "19px" }}>
                  Opening Balance Preview
                </h2>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  Read-only report. No reward points have been changed.
                </p>
              </div>

              <button
                onClick={() => setOpeningPreview(null)}
                style={buttonStyle}
              >
                Close Preview
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                {
                  label: "Total Customers",
                  value: openingPreview.summary.totalCustomers,
                },
                {
                  label: "Customers with Points",
                  value: openingPreview.summary.customersWithPoints,
                },
                {
                  label: "Opening Balances Needed",
                  value: openingPreview.summary.openingBalancesNeeded,
                },
                {
                  label: "Total Opening Points",
                  value: openingPreview.summary.totalOpeningPoints,
                },
                {
                  label: "Discrepancies",
                  value: openingPreview.summary.discrepancies,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#f8fafc",
                    borderRadius: "11px",
                    padding: "15px",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: "12px" }}>
                    {item.label}
                  </div>
                  <strong style={{ fontSize: "23px" }}>
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>

            {openingPreview.discrepancies.length > 0 && (
              <div style={{ marginTop: "22px" }}>
                <h3 style={{ color: "#dc2626", fontSize: "15px" }}>
                  Balance Discrepancies
                </h3>
                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  These customers need investigation before migration.
                </p>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: "550px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fef2f2" }}>
                        <th style={{ padding: "10px", textAlign: "left" }}>
                          Customer ID
                        </th>
                        <th style={{ padding: "10px" }}>Current Points</th>
                        <th style={{ padding: "10px" }}>Ledger Points</th>
                        <th style={{ padding: "10px" }}>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openingPreview.discrepancies.map((item) => (
                        <tr key={item.customerId}>
                          <td
                            style={{
                              padding: "10px",
                              fontSize: "11px",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {item.customerId}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            {item.currentPoints}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            {item.ledgerPoints}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            {item.openingPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p
              style={{
                marginTop: "18px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              This report is for review only. Opening balances have not been
              created.
            </p>
          </section>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "18px",
            marginBottom: "25px",
          }}
        >
          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Total Customers
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                marginTop: "12px",
              }}
            >
              {customers.length}
            </div>

            <div style={{ color: "#16a34a", fontSize: "12px", marginTop: 5 }}>
              Registered customers
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Total Orders
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                marginTop: "12px",
              }}
            >
              {totalOrders}
            </div>

            <div style={{ color: "#64748b", fontSize: "12px", marginTop: 5 }}>
              All customer orders
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Customer Order Value
            </div>

            <div
              style={{
                fontSize: "27px",
                fontWeight: 800,
                marginTop: "12px",
                color: "#16a34a",
              }}
            >
              {money(totalRevenue)}
            </div>

            <div style={{ color: "#64748b", fontSize: "12px", marginTop: 5 }}>
              Recorded customer order value
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              VIP Customers
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                marginTop: "12px",
                color: "#d97706",
              }}
            >
              {vipCustomerCount}
            </div>

            <div style={{ color: "#64748b", fontSize: "12px", marginTop: 5 }}>
              High-value customers
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Total Available Reward Points
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                marginTop: "12px",
                color: "#7c3aed",
              }}
            >
              ⭐ {totalRewardPoints}
            </div>

            <div style={{ color: "#64748b", fontSize: "12px", marginTop: 5 }}>
              Points available across customers
            </div>
          </div>
        </div>

        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
              marginBottom: "22px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                Customer Directory
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  fontSize: "13px",
                  color: "#64748b",
                }}
              >
                Showing {filteredCustomers.length} of {customers.length} customers
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                style={{
                  padding: "12px 14px",
                  border: "1px solid #dce3ed",
                  borderRadius: "10px",
                  fontSize: "13px",
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Customers</option>
                <option value="vip">⭐ VIP Customers</option>
                <option value="regular">Regular Customers</option>
              </select>

              <input
                type="text"
                placeholder="Search by name, phone or district..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "min(100%, 330px)",
                  padding: "12px 14px",
                  border: "1px solid #dce3ed",
                  borderRadius: "10px",
                  outline: "none",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: "60px 10px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading customer information...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "35px 10px",
                textAlign: "center",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div
              style={{
                padding: "55px 10px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "38px", marginBottom: "12px" }}>
                👥
              </div>

              <h3 style={{ color: "#334155" }}>No Customers Found</h3>

              <p style={{ fontSize: "13px" }}>
                Try changing your search or customer filter.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "1000px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "CUSTOMER",
                      "PHONE",
                      "LOCATION",
                      "ORDERS",
                      "TOTAL SPENT",
                      "REWARD POINTS",
                      "LAST ORDER",
                      "ACTION",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "15px 12px",
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 700,
                          borderBottom: "1px solid #e8edf3",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      style={{ borderBottom: "1px solid #edf0f5" }}
                    >
                      <td style={{ padding: "16px 12px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "11px",
                          }}
                        >
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background: "#e8efff",
                              color: "#315bd6",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {customer.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div style={{ fontWeight: 700, fontSize: "13px" }}>
                              {customer.name}
                            </div>

                            <div
                              style={{
                                color: "#94a3b8",
                                fontSize: "11px",
                                marginTop: "4px",
                              }}
                            >
                              Customer #{index + 1}

                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                  marginTop: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "4px 8px",
                                    borderRadius: "20px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background:
                                      customer.totalOrders > 1
                                        ? "#dcfce7"
                                        : "#eff6ff",
                                    color:
                                      customer.totalOrders > 1
                                        ? "#15803d"
                                        : "#2563eb",
                                  }}
                                >
                                  {customer.totalOrders > 1
                                    ? "Repeat Customer"
                                    : "New Customer"}
                                </span>

                                {isVIPCustomer(customer) && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "4px 8px",
                                      borderRadius: "20px",
                                      background: "#fef3c7",
                                      color: "#92400e",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                    }}
                                  >
                                    ⭐ VIP
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "16px 12px",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {customer.phone || "N/A"}
                      </td>

                      <td style={{ padding: "16px 12px", fontSize: "13px" }}>
                        {customer.district || "N/A"}
                      </td>

                      <td style={{ padding: "16px 12px" }}>
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#2563eb",
                            borderRadius: "20px",
                            padding: "6px 11px",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {customer.totalOrders}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "16px 12px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#16a34a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {money(customer.totalSpent)}
                      </td>

                      <td
                        style={{
                          padding: "16px 12px",
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "#7c3aed",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ⭐ {customer.rewardPoints} Points
                      </td>

                      <td
                        style={{
                          padding: "16px 12px",
                          fontSize: "12px",
                          color: "#64748b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dateFormat(customer.lastOrder)}
                      </td>

                      <td style={{ padding: "16px 12px" }}>
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          style={{
                            background: "#eef2ff",
                            color: "#4f46e5",
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedCustomer && (
          <div
            onClick={() => setSelectedCustomer(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.55)",
              zIndex: 1000,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "15px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#ffffff",
                width: "100%",
                maxWidth: "650px",
                maxHeight: "85vh",
                overflowY: "auto",
                borderRadius: "18px",
                padding: "25px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "21px" }}>
                  Customer Details
                </h2>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  style={{
                    ...buttonStyle,
                    fontSize: "18px",
                    padding: "5px 11px",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "13px",
                  padding: "18px",
                  marginTop: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom: "15px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "19px" }}>
                    {selectedCustomer.name}
                  </h3>

                  {isVIPCustomer(selectedCustomer) && (
                    <span
                      style={{
                        padding: "5px 10px",
                        borderRadius: "20px",
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      ⭐ VIP CUSTOMER
                    </span>
                  )}
                </div>

                <p style={{ fontSize: "13px", color: "#475569" }}>
                  Phone: {selectedCustomer.phone || "N/A"}
                </p>

                <p style={{ fontSize: "13px", color: "#475569" }}>
                  District: {selectedCustomer.district || "N/A"}
                </p>

                <p style={{ fontSize: "13px", color: "#475569" }}>
                  Address: {selectedCustomer.address || "N/A"}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "20px",
                    marginTop: "18px",
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                      Total Orders
                    </div>

                    <strong style={{ fontSize: "21px" }}>
                      {selectedCustomer.totalOrders}
                    </strong>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                      Total Order Value
                    </div>

                    <strong style={{ fontSize: "21px", color: "#16a34a" }}>
                      {money(selectedCustomer.totalSpent)}
                    </strong>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                      Available Reward Points
                    </div>

                    <strong style={{ fontSize: "21px", color: "#7c3aed" }}>
                      ⭐ {selectedCustomer.rewardPoints}
                    </strong>

                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Lifetime Earned:{" "}
                      {selectedCustomer.totalRewardPointsEarned}
                    </div>
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: "16px", marginTop: "25px" }}>
                Order History
              </h3>

              <div style={{ display: "grid", gap: "12px" }}>
                {selectedCustomer.orders.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: "13px" }}>
                    No order history available.
                  </p>
                ) : (
                  selectedCustomer.orders.map((order, index) => (
                    <div
                      key={order.id || index}
                      style={{
                        border: "1px solid #e8edf3",
                        borderRadius: "11px",
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong style={{ fontSize: "13px" }}>
                          {order.orderNumber}
                        </strong>

                        <span
                          style={{
                            fontSize: "11px",
                            background:
                              order.status === "Cancelled"
                                ? "#fee2e2"
                                : order.status === "Delivered"
                                  ? "#dcfce7"
                                  : "#eff6ff",
                            color:
                              order.status === "Cancelled"
                                ? "#dc2626"
                                : order.status === "Delivered"
                                  ? "#15803d"
                                  : "#2563eb",
                            padding: "5px 9px",
                            borderRadius: "20px",
                            fontWeight: 700,
                          }}
                        >
                          {order.status}
                        </span>
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginTop: "9px",
                        }}
                      >
                        {dateFormat(order.createdAt)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          marginTop: "12px",
                          fontSize: "13px",
                        }}
                      >
                        <span>{order.items?.length || 0} product(s)</span>

                        <strong>{money(order.total)}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
