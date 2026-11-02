"use client";

import "../../product-details.css";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STORAGE_KEY = "gadget-store-cart";
const DEFAULT_IMAGE = "/placeholder.png";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  description: string;
  imageUrl: string;
  stock: number;
  rating?: number;
  badge?: string;
  emoji?: string;
  color?: string;
  brand?: string;
};

type CartItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  emoji: string;
  color: string;
  image: string;
};

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadProduct() {
      try {
        const productRef = doc(db, "products", productId);
        const productSnapshot = await getDoc(productRef);

        if (!productSnapshot.exists()) {
          setProduct(null);
          setLoading(false);
          return;
        }

        const data = productSnapshot.data();

        const currentProduct: Product = {
          id: productSnapshot.id,
          name: String(data.name || ""),
          category: String(data.category || ""),
          price: Number(data.price || 0),
          oldPrice: Number(data.oldPrice || 0),
          description: String(data.description || ""),
          imageUrl: String(data.imageUrl || DEFAULT_IMAGE),
          stock: Math.max(0, Number(data.stock ?? 0)),
          rating: Number(data.rating || 4.8),
          badge: String(data.badge || ""),
          emoji: String(data.emoji || "📦"),
          color: String(data.color || "#f3f6fb"),
          brand: String(data.brand || ""),
        };

        setProduct(currentProduct);

        const relatedQuery = query(
          collection(db, "products"),
          where("category", "==", currentProduct.category),
          limit(5)
        );

        const relatedSnapshot = await getDocs(relatedQuery);

        const related = relatedSnapshot.docs
          .filter((item) => item.id !== currentProduct.id)
          .map((item) => {
            const itemData = item.data();

            return {
              id: item.id,
              name: String(itemData.name || ""),
              category: String(itemData.category || ""),
              price: Number(itemData.price || 0),
              oldPrice: Number(itemData.oldPrice || 0),
              description: String(itemData.description || ""),
              imageUrl: String(itemData.imageUrl || DEFAULT_IMAGE),
              stock: Math.max(0, Number(itemData.stock ?? 0)),
              emoji: String(itemData.emoji || "📦"),
              color: String(itemData.color || "#f3f6fb"),
            };
          });

        setRelatedProducts(related);
      } catch (error) {
        console.error("Product loading error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  function addToCart(buyNow = false) {
    if (!product || product.stock <= 0) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = saved ? JSON.parse(saved) : [];

      if (!Array.isArray(items)) {
        throw new Error("Invalid cart data");
      }

      const existing = items.find((item) => item.id === product.id);
      const currentQuantity = existing ? existing.quantity : 0;

      if (currentQuantity + quantity > product.stock) {
        setNotice(`Only ${product.stock} items are available.`);
        return;
      }

      const cartProduct: CartItem = {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity,
        emoji: product.emoji || "📦",
        color: product.color || "#f3f6fb",
        image: product.imageUrl || DEFAULT_IMAGE,
      };

      const updated = existing
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...items, cartProduct];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      if (buyNow) {
        router.push("/cart");
      } else {
        setNotice("Product added to cart successfully!");
      }
    } catch (error) {
      console.error("Cart error:", error);
      setNotice("Unable to add product to cart.");
    }
  }

  const formatPrice = (price: number) =>
    `৳${price.toLocaleString("en-BD")}`;

  if (loading) {
    return (
      <main className="pd-page">
        <div className="pd-message">Loading product details...</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="pd-page">
        <div className="pd-message">
          <h2>Product not found</h2>
          <p>This product may have been removed or is unavailable.</p>
          <Link href="/">Back to Store</Link>
        </div>
      </main>
    );
  }

  const discount =
    product.oldPrice > product.price && product.oldPrice > 0
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  return (
    <main className="pd-page">
      <header className="pd-header">
        <Link href="/" className="pd-logo">
          GADGET STORE
        </Link>

        <nav>
          <Link href="/">Home</Link>
          <Link href="/#products">Shop</Link>
          <Link href="/cart">🛒 My Cart</Link>
        </nav>
      </header>

      <div className="pd-container">
        <div className="pd-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/#products">Products</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <section className="pd-main">
          <div className="pd-image-box" style={{ background: product.color }}>
            {discount > 0 && (
              <span className="pd-discount">-{discount}% OFF</span>
            )}

            <img
              src={product.imageUrl || DEFAULT_IMAGE}
              alt={product.name}
            />
          </div>

          <div className="pd-info">
            <span className="pd-category">{product.category}</span>

            <h1>{product.name}</h1>

            <div className="pd-rating">
              <span>★</span> {product.rating || 4.8}
              <small> Customer rating</small>
            </div>

            <div className="pd-prices">
              <strong>{formatPrice(product.price)}</strong>

              {product.oldPrice > product.price && (
                <del>{formatPrice(product.oldPrice)}</del>
              )}

              {discount > 0 && (
                <span>Save {discount}%</span>
              )}
            </div>

            <div
              className={`pd-stock ${
                product.stock > 0 ? "in-stock" : "out-stock"
              }`}
            >
              {product.stock > 0
                ? `✓ In Stock — ${product.stock} available`
                : "✕ Currently Out of Stock"}
            </div>

            <div className="pd-description">
              <h3>Product Description</h3>
              <p>
                {product.description || "No description available for this product."}
              </p>
            </div>

            {product.brand && (
              <p className="pd-brand">
                <strong>Brand:</strong> {product.brand}
              </p>
            )}

            <div className="pd-quantity">
              <strong>Quantity</strong>

              <div>
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>

                <span>{quantity}</span>

                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(product.stock, q + 1))
                  }
                  disabled={quantity >= product.stock}
                >
                  +
                </button>
              </div>
            </div>

            <div className="pd-actions">
              <button
                className="pd-add"
                onClick={() => addToCart(false)}
                disabled={product.stock <= 0}
              >
                Add to Cart
              </button>

              <button
                className="pd-buy"
                onClick={() => addToCart(true)}
                disabled={product.stock <= 0}
              >
                Buy Now →
              </button>
            </div>

            <div className="pd-benefits">
              <span>🚚 Delivery across Bangladesh</span>
              <span>💳 Cash on Delivery</span>
              <span>🔒 Shopping with confidence</span>
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="pd-related">
            <div className="pd-section-heading">
              <span>YOU MAY ALSO LIKE</span>
              <h2>Related Products</h2>
            </div>

            <div className="pd-related-grid">
              {relatedProducts.map((item) => (
                <Link
                  href={`/product/${item.id}`}
                  className="pd-related-card"
                  key={item.id}
                >
                  <div style={{ background: item.color }}>
                    <img src={item.imageUrl} alt={item.name} />
                  </div>

                  <span>{item.category}</span>
                  <h3>{item.name}</h3>
                  <strong>{formatPrice(item.price)}</strong>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {notice && (
        <div className="pd-toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <footer className="pd-footer">
        © {new Date().getFullYear()} Gadget Store. All rights reserved.
      </footer>
    </main>
  );
}