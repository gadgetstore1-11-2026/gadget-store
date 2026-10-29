"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getOrders,
  changeOrderStatus,
  removeOrder,
} from "@/lib/orders";

type OrderItem = {
id: number;
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


const ORDERS_KEY = "gadget-store-orders";

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

useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
console.log(
"Firebase current user:",
user?.email ?? "NOT LOGGED IN"
);


if (!user) {
  setIsAuthenticated(false);
  setAuthChecked(true);
  setReady(false);
  window.location.replace("/admin/orders/login");
  return;
}

setIsAuthenticated(true);
setAuthChecked(true);

try {
  const onlineOrders = await getOrders();

  const validOrders = onlineOrders.map((order) => ({
    ...order,
    status: order.status || "Pending",
  }));

  setOrders(validOrders);
  setMessage("");
} catch (error) {
  console.error("Firestore order loading failed:", error);
  setOrders([]);
  setMessage("Firebase থেকে অর্ডার লোড করা যায়নি। Rules ও সংযোগ পরীক্ষা করো।");
} finally {
  setReady(true);
}

});

return () => unsubscribe();
}, []);


async function updateStatus(
orderNumber: string,
status: OrderStatus
) {
const order = orders.find(
(item) => item.orderNumber === orderNumber
);

if (!order?.id) {
setMessage("অর্ডারের Firebase ID পাওয়া যায়নি।");
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

setMessage("অর্ডারের স্ট্যাটাস আপডেট হয়েছে।");

} catch (error) {
console.error("Order status update failed:", error);
setMessage("স্ট্যাটাস আপডেট করা যায়নি।");
}
}

async function deleteOrder(orderNumber: string) {
  const confirmed = window.confirm(
    `তুমি কি ${orderNumber} অর্ডারটি মুছে ফেলতে চাও?`
  );

  if (!confirmed) return;

  const order = orders.find(
    (item) => item.orderNumber === orderNumber
  );

  if (!order?.id) {
    setMessage("অর্ডারের Firebase ID পাওয়া যায়নি।");
    return;
  }

  try {
    await removeOrder(order.id);

    setOrders((currentOrders) =>
      currentOrders.filter(
        (item) => item.orderNumber !== orderNumber
      )
    );

    setMessage("অর্ডারটি Firebase থেকে মুছে ফেলা হয়েছে।");
  } catch (error) {
    console.error("Order deletion failed:", error);
    setMessage("অর্ডার মুছে ফেলা যায়নি।");
  }
}

async function handleLogout() {
try {
await signOut(auth);
window.location.replace("/admin/orders/login");
} catch (error) {
console.error("Logout failed:", error);
setMessage("Logout করা যায়নি। আবার চেষ্টা করো।");
}
}

const money = (amount: number) =>
`৳${amount.toLocaleString("en-BD")}`;

if (!authChecked || !ready) {
return ( <main className="admin-orders-page"> <p>Admin Login যাচাই করা হচ্ছে...</p> </main>
);
}

if (!isAuthenticated) {
return ( <main className="admin-orders-page"> <p>Login পেজে পাঠানো হচ্ছে...</p> </main>
);
}

return ( <main className="admin-orders-page"> <header className="admin-orders-header"> <Link href="/" className="admin-orders-brand"> <span>G</span> <strong>GADGET STORE</strong> </Link>


    <Link href="/" className="admin-back-link">
      ← ওয়েবসাইটে ফিরে যাও
    </Link>
    <button
  type="button"
  className="admin-back-link"
  onClick={handleLogout}
>
  Logout
</button>
  </header>

  <section className="admin-orders-content">
    <div className="admin-orders-title">
      <div>
        <span>ADMIN PANEL</span>
        <h1>অর্ডার ম্যানেজমেন্ট</h1>
        <p>
          তোমার Gadget Store-এর সংরক্ষিত অর্ডারগুলো এখানে দেখো।
        </p>
      </div>

      <button
        className="admin-refresh-button"
        onClick={() => window.location.reload()}
      >
        ↻ Refresh
      </button>
    </div>

    <div className="admin-orders-stats">
      <article>
        <span>মোট অর্ডার</span>
        <strong>{orders.length}</strong>
      </article>

      <article>
        <span>Pending</span>
        <strong>
          {orders.filter((o) => o.status === "Pending").length}
        </strong>
      </article>

      <article>
        <span>Confirmed</span>
        <strong>
          {orders.filter((o) => o.status === "Confirmed").length}
        </strong>
      </article>

      <article>
        <span>Delivered</span>
        <strong>
          {orders.filter((o) => o.status === "Delivered").length}
        </strong>
      </article>
    </div>

    {message && (
      <p className="admin-orders-message" role="status">
        {message}
      </p>
    )}

    {orders.length === 0 ? (
      <section className="admin-orders-empty">
        <div>📦</div>
        <h2>এখনো কোনো অর্ডার নেই</h2>
        <p>
          ওয়েবসাইটে গিয়ে একটি পরীক্ষামূলক অর্ডার তৈরি করো।
          তারপর এখানে Refresh চাপো।
        </p>

        <Link href="/" className="admin-primary-button">
          ওয়েবসাইট দেখো
        </Link>
      </section>
    ) : (
      <div className="admin-order-list">
        {orders.map((order) => (
          <article
            className="admin-order-card"
            key={order.orderNumber}
          >
            <div className="admin-order-card-header">
              <div>
                <span className="admin-order-label">
                  ORDER NUMBER
                </span>

                <h2>{order.orderNumber}</h2>

                <p>
                  {new Date(order.createdAt).toLocaleString("en-BD")}
                </p>
              </div>

              <div className="admin-order-total">
                <span>মোট মূল্য</span>
                <strong>{money(order.total)}</strong>
              </div>
            </div>

            <div className="admin-order-divider" />

            <div className="admin-customer-info">
              <h3>কাস্টমারের তথ্য</h3>

              <p>
                <strong>নাম:</strong> {order.customer.name}
              </p>

              <p>
                <strong>ফোন:</strong> {order.customer.phone}
              </p>

              <p>
                <strong>জেলা:</strong> {order.customer.district}
              </p>

              <p>
                <strong>ঠিকানা:</strong> {order.customer.address}
              </p>
            </div>

            <div className="admin-order-divider" />

            <div className="admin-products-info">
              <h3>অর্ডার করা পণ্য</h3>

              {order.items.map((item, index) => (
                <div
                  className="admin-product-row"
                  key={`${item.id}-${index}`}
                >
                  <span>
                    {item.emoji || "📦"} {item.name} × {item.quantity}
                  </span>

                  <strong>
                    {money(item.price * item.quantity)}
                  </strong>
                </div>
              ))}

              <div className="admin-product-row">
                <span>ডেলিভারি চার্জ</span>
                <strong>{money(order.deliveryCharge)}</strong>
              </div>

              <div className="admin-product-row admin-grand-total">
                <span>সর্বমোট</span>
                <strong>{money(order.total)}</strong>
              </div>

              <p className="admin-payment-method">
                পেমেন্ট: {order.paymentMethod}
              </p>
            </div>

            <div className="admin-order-divider" />

            <div className="admin-order-actions">
              <label>
                অর্ডারের স্ট্যাটাস

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
                className="admin-delete-button"
                onClick={() => deleteOrder(order.orderNumber)}
              >
                অর্ডার মুছে ফেলো
              </button>
            </div>
          </article>
        ))}
      </div>
    )}

    <p className="admin-demo-notice">
      Demo mode: অর্ডারগুলো শুধু এই ব্রাউজারের localStorage-এ
      সংরক্ষিত। বাস্তব ব্যবসার জন্য নিরাপদ backend, database
      এবং Admin authorization প্রয়োজন।
    </p>
  </section>
</main>


);
}
