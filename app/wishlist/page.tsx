"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STORAGE_KEY = "gadget-store-wishlist";
const DEFAULT_IMAGE = "/placeholder.png";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  imageUrl: string;
  brand: string;
};

export default function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWishlist() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        const ids = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [];

        setWishlistIds(ids);

        if (ids.length === 0) {
          setProducts([]);
          return;
        }

        const snapshot = await getDocs(collection(db, "products"));

        const wishlistProducts = snapshot.docs
          .filter((item) => ids.includes(item.id))
          .map((item) => {
            const data = item.data();

            return {
              id: item.id,
              name: String(data.name || "Unnamed Product"),
              category: String(data.category || "Accessories"),
              price: Number(data.price || 0),
              oldPrice: Number(data.oldPrice || 0),
              imageUrl: String(data.imageUrl || DEFAULT_IMAGE),
              brand: String(data.brand || ""),
            };
          });

        wishlistProducts.sort(
          (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
        );

        setProducts(wishlistProducts);
      } catch (error) {
        console.error("Wishlist loading error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadWishlist();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue || "[]");
        const ids = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [];
        setWishlistIds(ids);
        setProducts((current) => current.filter((product) => ids.includes(product.id)));
      } catch {
        setWishlistIds([]);
        setProducts([]);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function removeFromWishlist(productId: string) {
    const updated = wishlistIds.filter((id) => id !== productId);

    setWishlistIds(updated);
    setProducts((previous) =>
      previous.filter((product) => product.id !== productId)
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function formatPrice(price: number) {
    return `৳${price.toLocaleString("en-BD")}`;
  }

  return (
    <main className="wishlist-page">
      <header className="wishlist-header">
        <Link href="/" className="wishlist-back">← Back to Store</Link>
        <span>YOUR COLLECTION</span>
        <h1>My Wishlist <span>♡</span></h1>
        <p>Keep track of the products you love.</p>
      </header>

      <section className="wishlist-content">
        {loading ? (
          <div className="wishlist-empty">
            <h2>Loading your wishlist...</h2>
          </div>
        ) : products.length === 0 ? (
          <div className="wishlist-empty">
            <span className="wishlist-empty-icon">♡</span>
            <h2>Your wishlist is empty</h2>
            <p>Save your favourite products here and find them whenever you need.</p>
            <Link href="/">Explore Products →</Link>
          </div>
        ) : (
          <>
            <div className="wishlist-section-heading">
              <div>
                <h2>Saved Products</h2>
                <p>{products.length} product(s) in your wishlist</p>
              </div>
              <Link href="/">Continue Shopping →</Link>
            </div>

            <div className="wishlist-grid">
              {products.map((product) => (
                <article className="wishlist-card" key={product.id}>
                  <Link
                    href={`/product/${product.id}`}
                    className="wishlist-image"
                  >
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={400}
                      height={400}
                      unoptimized
                    />
                  </Link>

                  <div className="wishlist-details">
                    <span>{product.brand || product.category}</span>
                    <h3>
                      <Link href={`/product/${product.id}`}>
                        {product.name}
                      </Link>
                    </h3>

                    <div className="wishlist-price">
                      <strong>{formatPrice(product.price)}</strong>
                      {product.oldPrice > product.price && (
                        <del>{formatPrice(product.oldPrice)}</del>
                      )}
                    </div>

                    <div className="wishlist-actions">
                      <Link href={`/product/${product.id}`}>
                        View Product
                      </Link>
                      <button onClick={() => removeFromWishlist(product.id)}>
                        Remove ♡
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
