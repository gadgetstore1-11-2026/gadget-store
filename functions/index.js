const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

setGlobalOptions({ maxInstances: 5 });

initializeApp();

const db = getFirestore();

// Server-side product prices
// These prices must match the website's actual product prices.
const PRODUCTS = {
  1: { name: "Premium Wireless Headphone", price: 2490 },
  2: { name: "Smart Watch Series 9", price: 3590 },
  3: { name: "Portable Bluetooth Speaker", price: 1890 },
  4: { name: "Fast Charging Power Bank", price: 1590 },
  5: { name: "Wireless Earbuds Pro", price: 2190 },
  6: { name: "65W Fast Charger", price: 990 },
};

exports.placeOrder = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const data = request.data || {};
    const customer = data.customer || {};

    // Validate customer information
    const name = typeof customer.name === "string"
      ? customer.name.trim()
      : "";

    const phone = typeof customer.phone === "string"
      ? customer.phone.trim()
      : "";

    const district = typeof customer.district === "string"
      ? customer.district.trim()
      : "";

    const address = typeof customer.address === "string"
      ? customer.address.trim()
      : "";

    if (name.length < 2 || name.length > 100) {
      throw new HttpsError("invalid-argument", "Please enter a valid name.");
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "Please enter a valid Bangladesh phone number.");
    }

    if (district.length < 2 || district.length > 100) {
      throw new HttpsError("invalid-argument", "Please enter a valid district.");
    }

    if (address.length < 8 || address.length > 500) {
      throw new HttpsError("invalid-argument", "Please enter a valid delivery address.");
    }

    if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) {
      throw new HttpsError("invalid-argument", "Your cart is empty or contains too many items.");
    }

    // Recalculate prices and totals on the server.
    const items = data.items.map((item) => {
      const productId = Number(item.id);
      const product = PRODUCTS[productId];
      const quantity = Number(item.quantity);

      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new HttpsError("invalid-argument", "A product or quantity is invalid.");
      }

      return {
        id: productId,
        name: product.name,
        price: product.price,
        quantity,
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const deliveryCharge = subtotal >= 3000 ? 0 : 80;
    const total = subtotal + deliveryCharge;

    const orderNumber = `GS${Date.now().toString().slice(-8)}`;

    const order = {
      orderNumber,
      customer: { name, phone, district, address },
      items,
      subtotal,
      deliveryCharge,
      total,
      paymentMethod: "Cash on Delivery",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      const docRef = await db.collection("orders").add(order);

      return {
        success: true,
        orderNumber,
        orderId: docRef.id,
        total,
      };
    } catch (error) {
      console.error("Failed to save order:", error);
      throw new HttpsError("internal", "We could not save your order. Please try again.");
    }
  }
);