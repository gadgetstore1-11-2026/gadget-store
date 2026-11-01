"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const STORAGE_KEY = "gadget-store-cart";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  description?: string;
  imageUrl: string;
  rating?: number;
  badge?: string;
  emoji?: string;
  color?: string;
};

const defaultImage =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85";

const categories = [
  { name: "All Products", label: "All Gadgets", emoji: "✨" },
  { name: "Audio", label: "Audio & Sound", emoji: "🎧" },
  { name: "Smart Watch", label: "Smart Watches", emoji: "⌚" },
  { name: "Accessories", label: "Accessories", emoji: "🔌" },
];



type StoreSettings = {
  storeName: string;
  logoUrl: string;
  phone: string;
  whatsapp: string;
  address: string;
};

const defaultSettings: StoreSettings = {
  storeName: "GADGET STORE",
  logoUrl: "",
  phone: "",
  whatsapp: "",
  address: "",
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

export default function Home() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState("All Products");
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [storeSettings, setStoreSettings] =
    useState<StoreSettings>(defaultSettings);

  // Load products from Firebase in real time
useEffect(() => {
const productsRef = collection(db, "products");

const unsubscribe = onSnapshot(
productsRef,
(snapshot) => {
console.log(
"Firebase products:",
snapshot.docs.map((doc) => doc.data())
);


  const productList: Product[] = snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      name: data.name || "Unnamed Product",
      category: data.category || "Accessories",
      price: Number(data.price) || 0,
      oldPrice: Number(data.oldPrice) || Number(data.price) || 0,
      description: data.description || "",
      imageUrl: data.imageUrl || defaultImage,
      rating: Number(data.rating) || 4.8,
      badge: data.badge || "NEW ARRIVAL",
      emoji: data.emoji || "📦",
      color: data.color || "#eee9ff",
    };
  });

  console.log("Mapped product list:", productList);

  setProducts(productList);
  setLoadingProducts(false);
},
(error) => {
  console.error("Products load error:", error);
  setLoadingProducts(false);
}


);

return () => unsubscribe();
}, []);


  // Load cart count
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = saved ? JSON.parse(saved) : [];

      if (Array.isArray(items)) {
        setCartCount(
          items.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
          )
        );
      }
    } catch {
      setCartCount(0);
    }
  }, []);

  // Load store settings from Firebase in real time
  useEffect(() => {
    const settingsRef = doc(db, "settings", "store");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          setStoreSettings({
            storeName: data.storeName || "GADGET STORE",
            logoUrl: data.logoUrl || "",
            phone: data.phone || "",
            whatsapp: data.whatsapp || "",
            address: data.address || "",
          });
        }
      },
      (error) => {
        console.error("Store settings load error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
  return products.filter((product) => {
    const matchesCategory =
      category === "All Products" ||
      product.category === category;

    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    return matchesCategory && matchesSearch;
  });
}, [products, search, category]);

const availableCategories = useMemo(() => {
  return [
    categories[0],
    ...Array.from(
      new Set(products.map((product) => product.category))
    ).map((name) => ({
      name,
      label: name,
      emoji: "📦",
    })),
  ];
}, [products]);

  // Format price
  const formatPrice = (price: number) =>
    `৳${price.toLocaleString("en-BD")}`;

  // Add product to cart
  function addToCart(productId: string) {
  const product = products.find(
    (item) => item.id === productId
  );

  if (!product) return;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const items: CartItem[] = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(items)) {
      throw new Error("Invalid cart data");
    }

    const existing = items.find(
      (item) => item.id === productId
    );

    const cartProduct: CartItem = {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: 1,
      emoji: product.emoji || "📦",
      color: product.color || "#eee9ff",
      image: product.imageUrl || defaultImage,
    };

    const updated: CartItem[] = existing
      ? items.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...items, cartProduct];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );

    setCartCount(
      updated.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      )
    );

    setNotice(`${product.name} added to your cart!`);

    window.setTimeout(() => setNotice(""), 2500);
  } catch {
    setNotice("Unable to add product to cart. Please try again.");
    window.setTimeout(() => setNotice(""), 2500);
  }
}

  // Store logo component
  function StoreLogo() {
    return storeSettings.logoUrl ? (
      <img
        src={storeSettings.logoUrl}
        alt={storeSettings.storeName}
        className="gs-store-logo"
        style={{
          width: 48,
          height: 48,
          objectFit: "contain",
          borderRadius: 10,
        }}
      />
    ) : (
      <span className="gs-store-logo">
        {storeSettings.storeName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <main className="store gs-home">
      {/* Announcement */}
      <div className="gs-announcement">
        ⚡ MEGA GADGET SALE
        <span>Save up to 30% on selected items</span>
        <b>Nationwide delivery available</b>
      </div>

      {/* Header */}
      <header className="gs-store-header">
        <Link href="/" className="gs-store-brand">
          <StoreLogo />

          <span>
            <strong>
              {storeSettings.storeName.toUpperCase()}
            </strong>
            <small>TECH FOR EVERYDAY</small>
          </span>
        </Link>

        <form
          className="gs-store-search"
          onSubmit={(e) => {
            e.preventDefault();

            document
              .getElementById("products")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span>⌕</span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search headphones, watches, chargers..."
          />

          <button type="submit">Search</button>
        </form>

        <Link href="/cart" className="gs-cart-link">
          🛒 My Cart
          <b>{cartCount}</b>
        </Link>
      </header>

      {/* Navigation */}
      <nav className="gs-store-nav">
        <div className="gs-store-nav-inner">
          <a className="selected" href="#home">
            Home
          </a>

          <a href="#categories">Categories</a>
          <a href="#products">Shop All</a>
          <a href="#why-us">Why {storeSettings.storeName}?</a>

          <span>✦ FREE DELIVERY ON SELECTED ORDERS</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="gs-hero" id="home">
        <div className="gs-hero-copy">
          <div className="gs-hero-kicker">
            <span />
            YOUR EVERYDAY TECH DESTINATION
          </div>

          <h1>
            Make every day
            <br />
            a little more <em>smart.</em>
          </h1>

          <p>
            Discover useful gadgets, smart accessories and everyday
            tech essentials — thoughtfully selected for your lifestyle.
          </p>

          <div className="gs-hero-buttons">
            <a href="#products" className="gs-button-primary">
              Shop products →
            </a>

            <a href="#categories" className="gs-button-ghost">
              Explore categories
            </a>
          </div>

          <div className="gs-hero-trust">
            <span>✓ Carefully selected gadgets</span>
            <span>✓ Shopping made simple</span>
          </div>
        </div>

        <div className="gs-hero-art">
          <div className="gs-hero-glow" />
          <div className="gs-hero-ring ring-a" />
          <div className="gs-hero-ring ring-b" />

          <div className="gs-hero-image">
            <img
  src={products[0]?.imageUrl || defaultImage}
  alt={products[0]?.name || "Featured gadget"}
/>
          </div>

          <div className="gs-float-note note-top">
            <span>✦</span>
            <div>
              <strong>Find your sound</strong>
              <small>Audio essentials</small>
            </div>
          </div>

          <div className="gs-float-note note-bottom">
            <span>⚡</span>
            <div>
              <strong>Tech for every day</strong>
              <small>Explore the collection</small>
            </div>
          </div>

          <div className="gs-hero-watch">⌚</div>
        </div>

        <div className="gs-hero-index">
          01 <span>/</span> FEATURED COLLECTION
        </div>
      </section>

      {/* Benefits */}
      <section className="gs-benefits" id="why-us">
        <div>
          <span>🚚</span>
          <p>
            <strong>Delivery across Bangladesh</strong>
            <small>Delivery options at checkout</small>
          </p>
        </div>

        <div>
          <span>🔒</span>
          <p>
            <strong>Secure shopping</strong>
            <small>Shop with confidence</small>
          </p>
        </div>

        <div>
          <span>💬</span>
          <p>
            <strong>Customer support</strong>
            <small>We are here to help</small>
          </p>
        </div>

        <div>
          <span>💳</span>
          <p>
            <strong>Cash on delivery</strong>
            <small>Pay when your order arrives</small>
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="gs-home-section" id="categories">
        <div className="gs-section-title">
          <div>
            <span>EXPLORE OUR COLLECTION</span>
            <h2>Shop by category</h2>
            <p>Find the right tech for your everyday life.</p>
          </div>

          <a href="#products">View all products →</a>
        </div>

        <div className="gs-category-grid">
          {availableCategories.map((item, index) => (
            <button
              key={item.name}
              className={`gs-category-tile tile-${index} ${
                category === item.name ? "chosen" : ""
              }`}
              onClick={() => {
                setCategory(item.name);

                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="gs-category-icon">
                {item.emoji}
              </span>

              <strong>{item.label}</strong>

              <small>
                {index === 0
                  ? "Explore the collection"
                  : index === 1
                  ? "Headphones and earbuds"
                  : index === 2
                  ? "Stay connected"
                  : "Everyday essentials"}
              </small>

              <i>↗</i>
            </button>
          ))}
        </div>
      </section>

      {/* Products */}
      <section
        className="gs-home-section gs-products-section"
        id="products"
      >
        <div className="gs-section-title gs-products-heading">
          <div>
            <span>HANDPICKED FOR YOU</span>
            <h2>Popular products</h2>
            <p>Everyday essentials, all in one collection.</p>
          </div>

          <div className="gs-product-tabs">
            {availableCategories.map((item) => (
  <button
    key={item.name}
    className={category === item.name ? "active" : ""}
    onClick={() => setCategory(item.name)}
  >
    {item.name}
  </button>
))}
              
          </div>
        </div>

        {search && (
          <p className="gs-search-result">
            Showing results for <strong>“{search}”</strong>
          </p>
        )}

{loadingProducts && (
  <div className="gs-no-products">
    <h3>Loading products...</h3>
    <p>Please wait while we load our products.</p>
  </div>
)}

        {!loadingProducts && (
  <div className="gs-product-grid">
          {filteredProducts.map((product) => {
            const discount = Math.round(
              (1 - product.price / product.oldPrice) * 100
            );

            return (
              <article
                className="gs-product-card"
                key={product.id}
              >
                <div
                  className="gs-product-visual"
                  style={{ background: product.color }}
                >
                  <span className="gs-product-badge">
                    {product.badge}
                  </span>

                  <span className="gs-discount-badge">
                    -{discount}%
                  </span>

                  <img
                    src={product.imageUrl || defaultImage}
                    alt={product.name}
                    loading="lazy"
                  />

                  <button
                    className="gs-quick-add"
                    onClick={() => addToCart(product.id)}
                    aria-label={`Add ${product.name} to cart`}
                  >
                    +
                  </button>
                </div>

                <div className="gs-product-details">
                  <span className="gs-product-category">
                    {product.category}
                  </span>

                  <h3>{product.name}</h3>

                  <div className="gs-product-rating">
                    <span>★</span> {product.rating}
                    <small> Customer rating</small>
                  </div>

                  <div className="gs-product-price">
                    <strong>
                      {formatPrice(product.price)}
                    </strong>

                    <del>
                      {formatPrice(product.oldPrice)}
                    </del>
                  </div>

                  <button
                    className="gs-add-cart"
                    onClick={() => addToCart(product.id)}
                  >
                    Add to Cart <span>+</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="gs-no-products">
            <span>⌕</span>
            <h3>No products found</h3>
            <p>
              Try a different search or browse all products.
            </p>

            <button
              onClick={() => {
                setSearch("");
                setCategory("All Products");
              }}
            >
              Show all products
            </button>
          </div>
        )}

        <div className="gs-demo-note">
          Product prices and ratings are demonstration information.
        </div>
      </section>

      {/* CTA */}
      <section className="gs-home-cta">
        <div>
          <span>
            WELCOME TO {storeSettings.storeName.toUpperCase()}
          </span>

          <h2>Your next favourite gadget is waiting.</h2>

          <p>
            Explore our collection and find something made for you.
          </p>
        </div>

        <a href="#products">Explore Products →</a>

        <div className="gs-cta-orb">
          {storeSettings.storeName.charAt(0).toUpperCase()}
        </div>
      </section>

      {/* Footer */}
      <footer className="gs-store-footer">
        <div className="gs-footer-main">
          <Link href="/" className="gs-store-brand">
            <StoreLogo />

            <span>
              <strong>
                {storeSettings.storeName.toUpperCase()}
              </strong>
              <small>TECH FOR EVERYDAY</small>
            </span>
          </Link>

          <p>
            Your everyday destination for gadgets and tech accessories.
          </p>

          {storeSettings.phone && (
            <p>
              📞 Phone:{" "}
              <a href={`tel:${storeSettings.phone}`}>
                {storeSettings.phone}
              </a>
            </p>
          )}

          {storeSettings.address && (
            <p>📍 {storeSettings.address}</p>
          )}

          {storeSettings.whatsapp && (
            <a
              href={`https://wa.me/${storeSettings.whatsapp.replace(
                /\D/g,
                ""
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Contact us on WhatsApp
            </a>
          )}

          <Link href="/cart">View Cart →</Link>
        </div>

        <div className="gs-footer-bottom">
          <span>
            © {new Date().getFullYear()} {storeSettings.storeName}.
            All rights reserved.
          </span>

          <span>
            Made for tech lovers in Bangladesh 🇧🇩
          </span>
        </div>
      </footer>

      {/* Toast */}
      {notice && (
        <div className="gs-home-toast" role="status">
          <span>✓</span>
          {notice}

          <button onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}