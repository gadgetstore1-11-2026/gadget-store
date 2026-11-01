const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

setGlobalOptions({
  region: "us-central1",
  maxInstances: 5,
});

initializeApp();

const db = getFirestore();

exports.placeOrder = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const data = request.data || {};
      const customer = data.customer;
      const items = data.items;

      // Customer validation
      if (
        !customer ||
        typeof customer.name !== "string" ||
        customer.name.trim().length < 2 ||
        typeof customer.phone !== "string" ||
        !/^01[3-9]\d{8}$/.test(customer.phone) ||
        typeof customer.district !== "string" ||
        customer.district.trim().length < 2 ||
        typeof customer.address !== "string" ||
        customer.address.trim().length < 8
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Customer information is invalid."
        );
      }

      // Product validation
      if (
        !Array.isArray(items) ||
        items.length < 1 ||
        items.length > 20
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid order items."
        );
      }

      // Get current product information from Firestore
      const orderItems = await Promise.all(
        items.map(async (item) => {
          const productId = String(item.id || "");
          const quantity = Number(item.quantity);

          if (
            !productId ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 10
          ) {
            throw new HttpsError(
              "invalid-argument",
              "Invalid product or quantity."
            );
          }

          const productDoc = await db
            .collection("products")
            .doc(productId)
            .get();

          if (!productDoc.exists) {
            throw new HttpsError(
              "not-found",
              "A selected product is unavailable."
            );
          }

          const product = productDoc.data();
          const price = Number(product.price);

          if (!Number.isFinite(price) || price < 0) {
            throw new HttpsError(
              "failed-precondition",
              "Invalid product price."
            );
          }

          return {
            id: productDoc.id,
            name: product.name,
            price,
            quantity,
            emoji: product.emoji || "📦",
            imageUrl: product.imageUrl || "",
          };
        })
      );

      // Calculate total on the server
      const subtotal = orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Read delivery settings
      const settingsDoc = await db
        .collection("settings")
        .doc("store")
        .get();

      const settings = settingsDoc.exists
        ? settingsDoc.data()
        : {};

      const deliveryCharge = Number(settings.deliveryCharge ?? 80);
      const freeDeliveryMinimum = Number(
        settings.freeDeliveryMinimum ?? 3000
      );

      if (
        !Number.isFinite(deliveryCharge) ||
        deliveryCharge < 0 ||
        !Number.isFinite(freeDeliveryMinimum) ||
        freeDeliveryMinimum < 0
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Invalid delivery settings."
        );
      }

      const finalDeliveryCharge =
        subtotal >= freeDeliveryMinimum ? 0 : deliveryCharge;

      const total = subtotal + finalDeliveryCharge;

      const orderNumber = `GS-${Date.now()
        .toString()
        .slice(-8)}`;

      const order = {
        orderNumber,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          district: customer.district.trim(),
          address: customer.address.trim(),
        },
        items: orderItems,
        subtotal,
        deliveryCharge: finalDeliveryCharge,
        total,
        paymentMethod: "Cash on Delivery",
        status: "Pending",
        createdAt: new Date().toISOString(),
      };

      const orderRef = await db
        .collection("orders")
        .add(order);

      return {
        success: true,
        orderId: orderRef.id,
        orderNumber,
        total,
      };
    } catch (error) {
      console.error("Order creation failed:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Unable to place order. Please try again."
      );
    }
  }
);