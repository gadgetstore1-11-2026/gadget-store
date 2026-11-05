"use client";
import Image from "next/image";

import "../../product-details.css";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

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
  images?: string[];
  specifications?: Record<string, string>;
};

type Review = {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string | null;
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
  const [selectedImage, setSelectedImage] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  async function loadReviews() {
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `/api/reviews?productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load reviews.");
      }
      setReviews(Array.isArray(result.reviews) ? result.reviews : []);
      setAverageRating(Number(result.averageRating) || 0);
      setTotalReviews(Number(result.totalReviews) || 0);
    } catch (error) {
      console.error("Review loading error:", error);
      setReviews([]);
      setAverageRating(0);
      setTotalReviews(0);
    } finally {
      setReviewsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const requestedOrderId = new URLSearchParams(window.location.search).get("reviewOrderId");
    if (!requestedOrderId) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      void (async () => {
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/customer/account", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const result = await response.json();
          if (!response.ok || !result.success) return;

          const order = (result.orders || []).find((entry: { id: string; status: string; items: { id?: string | number }[] }) => entry.id === requestedOrderId);
          const ownsProduct = order?.items?.some((item: { id?: string | number }) => String(item.id) === productId);
          if (!active || !order || order.status !== "Delivered" || !ownsProduct) return;

          setReviewOrderId(order.id);
          setOrderNumber(order.orderNumber || "");
          setReviewPhone(result.customer?.phone || "");
          setReviewMessage("Your delivered order has been selected. Please add your rating and comment.");
        } catch (error) {
          console.error("Unable to load review order details:", error);
        }
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [productId]);

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
          images: Array.isArray(data.images)
            ? data.images.filter((value: unknown): value is string => typeof value === "string" && value.trim() !== "")
            : [],
          specifications: data.specifications && typeof data.specifications === "object" && !Array.isArray(data.specifications)
            ? Object.fromEntries(
                Object.entries(data.specifications).map(([key, value]) => [key, String(value ?? "")])
              )
            : {},
        };

        setProduct(currentProduct);
        setSelectedImage(currentProduct.imageUrl);
        void loadReviews();

        try {
          const storageKey = "gadget-store-recently-viewed";
          const saved = localStorage.getItem(storageKey);
          const previousIds: string[] = saved ? JSON.parse(saved) : [];

          const updatedIds = [
            currentProduct.id,
            ...previousIds.filter((id) => id !== currentProduct.id),
          ].slice(0, 8);

          localStorage.setItem(storageKey, JSON.stringify(updatedIds));
        } catch (error) {
          console.error("Recently viewed update error:", error);
        }

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

    setSelectedImage("");
    setReviews([]);
    setAverageRating(0);
    setTotalReviews(0);
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

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewMessage("");

    if (!/^GS-[A-Z0-9-]+$/i.test(orderNumber.trim())) {
      setReviewMessage("Please enter a valid order number.");
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(reviewPhone.replace(/\D/g, ""))) {
      setReviewMessage("Please enter a valid Bangladesh phone number.");
      return;
    }
    if (reviewComment.trim().length < 10) {
      setReviewMessage("Please write at least 10 characters.");
      return;
    }

    setReviewSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      const reviewHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser && reviewOrderId) {
        reviewHeaders.Authorization = `Bearer ${await currentUser.getIdToken()}`;
      }
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: reviewHeaders,
        body: JSON.stringify({
          productId,
          orderId: reviewOrderId,
          orderNumber: orderNumber.trim().toUpperCase(),
          phone: reviewPhone.replace(/\D/g, ""),
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not submit your review.");
      }
      setReviewMessage(result.message || "Your review has been submitted for approval.");
      setReviewComment("");
      await loadReviews();
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not submit your review.");
    } finally {
      setReviewSubmitting(false);
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

  const productStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: Array.from(new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))),
    sku: product.id,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: product.price,
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(totalReviews > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: averageRating,
        reviewCount: totalReviews,
      },
    } : {}),
  };

  return (
    <main className="pd-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productStructuredData).replace(/</g, "\\u003c"),
        }}
      />
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

            <Image src={selectedImage || product.imageUrl || DEFAULT_IMAGE} alt={product.name} width={600} height={430} unoptimized priority />
          </div>
          {Array.from(new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))).length > 1 && (
            <div className="pd-gallery" aria-label="Product image gallery">
              {Array.from(new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))).map((imageUrl, index) => (
                <button
                  type="button"
                  key={`${imageUrl}-${index}`}
                  className={selectedImage === imageUrl ? "active" : ""}
                  onClick={() => setSelectedImage(imageUrl)}
                  aria-label={`View product image ${index + 1}`}
                  aria-pressed={selectedImage === imageUrl}
                >
                  <Image src={imageUrl} alt={`${product.name} view ${index + 1}`} width={90} height={90} unoptimized />
                </button>
              ))}
            </div>
          )}

          <div className="pd-info">
            <span className="pd-category">{product.category}</span>

            <h1>{product.name}</h1>

            <div className="pd-rating">
              {totalReviews > 0 ? (
                <><span>★</span> {averageRating.toFixed(1)} <small>({totalReviews} verified review{totalReviews === 1 ? "" : "s"})</small></>
              ) : (
                <small>No customer reviews yet</small>
              )}
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

            {Object.keys(product.specifications || {}).length > 0 && (
              <section className="pd-specifications">
                <h3>Product Specifications</h3>
                <dl>
                  {Object.entries(product.specifications || {}).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
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

        <section className="pd-reviews" id="customer-reviews">
          <div className="pd-section-heading">
            <span>REAL CUSTOMER FEEDBACK</span>
            <h2>Customer Reviews</h2>
          </div>
          <div className="pd-review-summary">
            <strong>{totalReviews > 0 ? averageRating.toFixed(1) : "—"}</strong>
            <span className="pd-review-stars" aria-label={`${averageRating} out of 5 stars`}>
              {"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}
            </span>
            <small>{totalReviews} approved review{totalReviews === 1 ? "" : "s"}</small>
          </div>

          {reviewsLoading ? (
            <p className="pd-review-empty">Loading customer reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="pd-review-empty">No approved reviews yet. Be the first to share your experience after your order is delivered.</p>
          ) : (
            <div className="pd-review-list">
              {reviews.map((review) => (
                <article className="pd-review-card" key={review.id}>
                  <div className="pd-review-card-top">
                    <strong>{review.customerName || "Verified Customer"}</strong>
                    <span className="pd-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  </div>
                  <p>{review.comment}</p>
                  {review.createdAt && <small>{new Date(review.createdAt).toLocaleDateString("en-BD")}</small>}
                </article>
              ))}
            </div>
          )}

          <form className="pd-review-form" onSubmit={handleReviewSubmit}>
            <h3>Write a Review</h3>
            <p>Reviews are accepted only for delivered orders and are published after admin approval.</p>
            <div className="pd-review-form-grid">
              <label>
                Order Number
                <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="GS-XXXXXXXX" required maxLength={60} readOnly={Boolean(reviewOrderId)} />
              </label>
              <label>
                Phone Number
                <input value={reviewPhone} onChange={(event) => setReviewPhone(event.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" required maxLength={20} readOnly={Boolean(reviewOrderId)} />
              </label>
            </div>
            <div className="pd-review-rating-label">
              <span>Your Rating</span>
              <span className="pd-rating-picker">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button type="button" key={value} onClick={() => setReviewRating(value)} className={value <= reviewRating ? "active" : ""} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={reviewRating === value}>★</button>
                ))}
              </span>
            </div>
            <label>
              Your Review
              <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} minLength={10} maxLength={1000} rows={4} placeholder="Share your experience with this product..." required />
            </label>
            {reviewMessage && <p className="pd-review-message" role="status">{reviewMessage}</p>}
            <button className="pd-review-submit" type="submit" disabled={reviewSubmitting}>
              {reviewSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
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
                    <Image src={item.imageUrl || DEFAULT_IMAGE} alt={item.name} width={300} height={170} unoptimized />
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