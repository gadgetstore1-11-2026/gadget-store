"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToOrders, type Order } from "@/lib/orders";

type CustomerRecord = {
name: string;
phone: string;
district: string;
address: string;
totalOrders: number;
totalSpent: number;
lastOrder: string;
orders: Order[];
};

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

const money = (amount: number) =>
new Intl.NumberFormat("en-BD", {
style: "currency",
currency: "BDT",
maximumFractionDigits: 0,
}).format(amount || 0);

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

function buildCustomerList(orders: Order[]): CustomerRecord[] {
const customerMap = new Map<string, CustomerRecord>();

orders.forEach((order) => {
const phone = order.customer?.phone?.trim() || "";
const name = order.customer?.name?.trim() || "Unknown Customer";
const address = order.customer?.address || "";

const key = phone || `${name}-${address}`;

if (!customerMap.has(key)) {
  customerMap.set(key, {
    name,
    phone,
    district: order.customer?.district || "",
    address,
    totalOrders: 0,
    totalSpent: 0,
    lastOrder: order.createdAt || "",
    orders: [],
  });
}

const customer = customerMap.get(key)!;

customer.totalOrders += 1;
customer.orders.push(order);

if (order.status !== "Cancelled") {
  customer.totalSpent += Number(order.total || 0);
}

if (getTime(order.createdAt) > getTime(customer.lastOrder)) {
  customer.lastOrder = order.createdAt;
}

});

return Array.from(customerMap.values()).sort(
(a, b) => getTime(b.lastOrder) - getTime(a.lastOrder)
);
}

export default function CustomersPage() {
const router = useRouter();

const [customers, setCustomers] = useState<CustomerRecord[]>([]);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");
const [selectedCustomer, setSelectedCustomer] =
useState<CustomerRecord | null>(null);
const [error, setError] = useState("");

useEffect(() => {
let unsubscribeOrders: (() => void) | null = null;
let active = true;

const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
  unsubscribeOrders?.();
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

  unsubscribeOrders = subscribeToOrders(
    (orders) => {
      if (!active) return;

      setCustomers(buildCustomerList(orders));
      setLoading(false);
      setError("");
    },
    (err) => {
      if (!active) return;

      console.error("Customers loading failed:", err);
      setError("Unable to load customer information. Please try again.");
      setLoading(false);
    }
  );
});

return () => {
  active = false;
  unsubscribeAuth();
  unsubscribeOrders?.();
};

}, [router]);

const filteredCustomers = useMemo(() => {
const value = search.toLowerCase().trim();

if (!value) return customers;

return customers.filter(
  (customer) =>
    customer.name.toLowerCase().includes(value) ||
    customer.phone.toLowerCase().includes(value) ||
    customer.district.toLowerCase().includes(value)
);

}, [customers, search]);

const totalOrders = customers.reduce(
(sum, customer) => sum + customer.totalOrders,
0
);

const totalRevenue = customers.reduce(
(sum, customer) => sum + customer.totalSpent,
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
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
flexWrap: "wrap",
gap: "15px",
marginBottom: "28px",
}}
> <div>
<div
style={{
color: "#64748b",
fontSize: "13px",
marginBottom: "8px",
}}
>
Admin Panel / Customers </div>

```
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
          All registered customers
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
          Customer Revenue
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
          Excluding cancelled orders
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
            {customers.length} customers found
          </p>
        </div>

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

          <h3 style={{ color: "#334155" }}>
            No Customers Found
          </h3>

          <p style={{ fontSize: "13px" }}>
            New customers will appear here when orders are placed.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "850px",
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
                  key={`${customer.phone || customer.name}-${index}`}
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
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "13px",
                          }}
                        >
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
            <h3 style={{ margin: "0 0 15px", fontSize: "19px" }}>
              {selectedCustomer.name}
            </h3>

            <p style={{ fontSize: "13px", color: "#475569" }}>
              📞 Phone: {selectedCustomer.phone || "N/A"}
            </p>

            <p style={{ fontSize: "13px", color: "#475569" }}>
              📍 District: {selectedCustomer.district || "N/A"}
            </p>

            <p style={{ fontSize: "13px", color: "#475569" }}>
              🏠 Address: {selectedCustomer.address || "N/A"}
            </p>

            <div
              style={{
                display: "flex",
                gap: "25px",
                flexWrap: "wrap",
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
                  Total Spent
                </div>

                <strong
                  style={{ fontSize: "21px", color: "#16a34a" }}
                >
                  {money(selectedCustomer.totalSpent)}
                </strong>
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: "16px", marginTop: "25px" }}>
            Order History
          </h3>

          <div style={{ display: "grid", gap: "12px" }}>
            {selectedCustomer.orders.map((order, index) => (
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
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
</main>


);
}
