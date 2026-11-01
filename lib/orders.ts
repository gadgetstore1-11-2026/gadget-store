import {
  collection,
  getDocs,
  orderBy,
  query,
  onSnapshot,
} from "firebase/firestore";

import type { Unsubscribe } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type OrderItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  emoji?: string;
  imageUrl?: string;
};

export type Customer = {
  name: string;
  phone: string;
  district: string;
  address: string;
};

export type Order = {
  id?: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  status: OrderStatus;
};

const ORDERS_COLLECTION = "orders";

export type PlaceOrderResponse = {
  success: boolean;
  orderId: string;
  orderNumber: string;
  total: number;
};

// Create an order through the secure Next.js API
export async function createOrder(
  order: Pick<Order, "customer" | "items">
): Promise<PlaceOrderResponse> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.error || "Unable to place your order."
    );
  }

  return result as PlaceOrderResponse;
}

// Retrieve all orders
export async function getOrders(): Promise<Order[]> {
  const ordersQuery = query(
    collection(db, ORDERS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs.map((item) => ({
    ...item.data(),
    id: item.id,
  })) as Order[];
}

// Subscribe to real-time order updates
export function subscribeToOrders(
  onOrdersChange: (orders: Order[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ordersQuery = query(
    collection(db, ORDERS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })) as Order[];

      onOrdersChange(orders);
    },
    (error) => {
      console.error("Real-time order listener failed:", error);
      onError?.(error);
    }
  );
}

// Update order status
export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in as administrator.");
  }

  const token = await user.getIdToken();

  const response = await fetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Could not update order status.");
  }
}

// Delete an order
export async function removeOrder(
  orderId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please log in as administrator.");
  }
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Could not delete order.");
  }
}