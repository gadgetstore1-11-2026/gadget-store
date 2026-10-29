import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type OrderItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  emoji?: string;
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

// নতুন অর্ডার অনলাইনে সংরক্ষণ
export async function createOrder(
  order: Omit<Order, "id">
): Promise<string> {
  const docRef = await addDoc(
    collection(db, ORDERS_COLLECTION),
    order
  );

  return docRef.id;
}

// অনলাইনে সংরক্ষিত সব অর্ডার লোড
export async function getOrders(): Promise<Order[]> {
  const ordersQuery = query(
    collection(db, ORDERS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Order[];
}

// অর্ডারের স্ট্যাটাস পরিবর্তন
export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status,
  });
}

// অর্ডার মুছে ফেলা
export async function removeOrder(
  orderId: string
): Promise<void> {
  await deleteDoc(doc(db, ORDERS_COLLECTION, orderId));
}