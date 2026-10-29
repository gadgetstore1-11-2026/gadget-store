"use client";

import { useEffect, useMemo, useState } from "react";
const STORAGE_KEY = "gadget-store-cart";

const products = [
  {
    id: 1,
    name: "Premium Wireless Headphone",
    category: "Audio",
    price: 2490,
    oldPrice: 3290,
    rating: 4.8,
    badge: "BEST SELLER",
    emoji: "🎧",
    color: "#eee9ff",
  },
  {
    id: 2,
    name: "Smart Watch Series 9",
    category: "Smart Watch",
    price: 3590,
    oldPrice: 4590,
    rating: 4.9,
    badge: "HOT DEAL",
    emoji: "⌚",
    color: "#e5efff",
  },
  {
    id: 3,
    name: "Portable Bluetooth Speaker",
    category: "Audio",
    price: 1890,
    oldPrice: 2490,
    rating: 4.7,
    badge: "SALE",
    emoji: "🔊",
    color: "#e4f5ee",
  },
  {
    id: 4,
    name: "Fast Charging Power Bank",
    category: "Accessories",
    price: 1590,
    oldPrice: 1990,
    rating: 4.6,
    badge: "POPULAR",
    emoji: "🔋",
    color: "#fff0dc",
  },
  {
    id: 5,
    name: "Wireless Earbuds Pro",
    category: "Audio",
    price: 2190,
    oldPrice: 2990,
    rating: 4.8,
    badge: "TRENDING",
    emoji: "🎵",
    color: "#ffe9ee",
  },
  {
    id: 6,
    name: "65W Fast Charger",
    category: "Accessories",
    price: 990,
    oldPrice: 1290,
    rating: 4.5,
    badge: "GREAT VALUE",
    emoji: "🔌",
    color: "#e6f1ff",
  },
];

const categories = [
  { name: "All Products", emoji: "✨" },
  { name: "Audio", emoji: "🎧" },
  { name: "Smart Watch", emoji: "⌚" },
  { name: "Accessories", emoji: "🔌" },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Products");
  const [cart, setCart] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const items = JSON.parse(saved);

      if (Array.isArray(items)) {
        const ids = items.flatMap((item) =>
          Array.from(
            { length: Math.max(0, Number(item.quantity) || 0) },
            () => Number(item.id)
          )
        );

        setCart(ids);
      }
    }
  } catch {
    setCart([]);
  }
}, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        category === "All Products" || product.category === category;

      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const formatPrice = (price: number) =>
    `৳${price.toLocaleString("en-BD")}`;


function addToCart(id: number, name: string) {
  const product = products.find((item) => item.id === id);

  if (!product) return;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const items = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(items)) {
      throw new Error("Invalid cart data");
    }

    const existing = items.find((item) => item.id === id);

    let updatedCart;

    if (existing) {
      updatedCart = items.map((item) =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [
        ...items,
        {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: 1,
          emoji: product.emoji,
          color: product.color,
        },
      ];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCart));

    setCart(
      updatedCart.flatMap((item) =>
        Array.from(
          { length: Math.max(0, Number(item.quantity) || 0) },
          () => Number(item.id)
        )
      )
    );

    setNotice(`${name} added to your cart!`);
    window.setTimeout(() => setNotice(""), 2500);
  } catch {
    setNotice("পণ্য কার্টে যোগ করা যায়নি। আবার চেষ্টা করো।");
  }
}



  return (
    <main className="store">
      {/* Announcement bar */}
      <div className="announcement">
        <span>⚡</span> Mega Gadget Sale — Save up to 30% on selected items
        <span className="announcement-extra"> | Nationwide delivery</span>
      </div>

      {/* Header */}
      <header className="header">
        <a className="brand" href="#" aria-label="Gadget Store home">
          <span className="brand-icon">G</span>
          <span>
            <strong>GADGET</strong>
            <small>STORE</small>
          </span>
        </a>

        <div className="search-box">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search headphones, watches, chargers..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            aria-label="Search products"
          />
          <button
            onClick={() =>
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Search
          </button>
        </div>

        <button
          className="cart-button"
          onClick={() => {
  window.location.href = "/cart";
}}
        >
          <span className="cart-icon">🛒</span>
          <span className="cart-label">My Cart</span>
          <span className="cart-count">{cart.length}</span>
        </button>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <a href="#home" className="nav-active">
          Home
        </a>
        <a href="#categories">Categories</a>
        <a href="#products">Shop All</a>
        <a href="#why-us">Why Gadget Store?</a>
        <span className="nav-promo">FREE DELIVERY ON SELECTED ORDERS</span>
      </nav>

      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-content">
          <div className="hero-label">
            <span className="hero-dot" />
            YOUR EVERYDAY TECH DESTINATION
          </div>

          <h1>
            Upgrade Your
            <br />
            <span>Everyday.</span>
          </h1>

          <p>
            Discover the latest gadgets, smart accessories and everyday tech
            essentials — all in one place.
          </p>

          <div className="hero-actions">
            <a href="#products" className="primary-button">
              Shop Products <span>→</span>
            </a>
            <a href="#categories" className="secondary-button">
              Explore Categories
            </a>
          </div>

          <div className="hero-benefits">
            <span>✓ Quality-focused selection</span>
            <span>✓ Convenient shopping</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />

          <div className="hero-product hero-headphone">🎧</div>
          <div className="floating-card floating-top">
            <span className="floating-icon">⚡</span>
            <span>
              <strong>Tech made simple</strong>
              <small>Everyday essentials</small>
            </span>
          </div>

          <div className="floating-card floating-bottom">
            <span className="floating-star">★</span>
            <span>
              <strong>Find your next favourite</strong>
              <small>Explore our collection</small>
            </span>
          </div>

          <div className="hero-small-product">⌚</div>
        </div>

        <div className="hero-number">01 / TECH COLLECTION</div>
      </section>

      {/* Service highlights */}
      <section className="service-strip" id="why-us">
        <div className="service-item">
          <span className="service-icon">🚚</span>
          <span>
            <strong>Delivery Across Bangladesh</strong>
            <small>Delivery options at checkout</small>
          </span>
        </div>

        <div className="service-item">
          <span className="service-icon">🔒</span>
          <span>
            <strong>Secure Shopping</strong>
            <small>Shop with confidence</small>
          </span>
        </div>

        <div className="service-item">
          <span className="service-icon">💬</span>
          <span>
            <strong>Customer Support</strong>
            <small>We are here to help</small>
          </span>
        </div>

        <div className="service-item">
          <span className="service-icon">💳</span>
          <span>
            <strong>Convenient Payments</strong>
            <small>Payment options coming soon</small>
          </span>
        </div>
      </section>

      {/* Categories */}
      <section className="section categories-section" id="categories">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR FAVOURITE</span>
            <h2>Shop by Category</h2>
            <p>Discover tech that fits your lifestyle.</p>
          </div>

          <a href="#products" className="text-link">
            View all products →
          </a>
        </div>

        <div className="category-grid">
          <button
            className={`category-card category-purple ${
              category === "Audio" ? "category-selected" : ""
            }`}
            onClick={() => {
              setCategory("Audio");
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="category-emoji">🎧</span>
            <span className="category-name">Audio & Sound</span>
            <span className="category-subtitle">Headphones & earbuds</span>
            <span className="category-arrow">↗</span>
          </button>

          <button
            className={`category-card category-blue ${
              category === "Smart Watch" ? "category-selected" : ""
            }`}
            onClick={() => {
              setCategory("Smart Watch");
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="category-emoji">⌚</span>
            <span className="category-name">Smart Watches</span>
            <span className="category-subtitle">Stay connected</span>
            <span className="category-arrow">↗</span>
          </button>

          <button
            className={`category-card category-green ${
              category === "Accessories" ? "category-selected" : ""
            }`}
            onClick={() => {
              setCategory("Accessories");
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="category-emoji">🔌</span>
            <span className="category-name">Accessories</span>
            <span className="category-subtitle">Chargers & essentials</span>
            <span className="category-arrow">↗</span>
          </button>

          <button
            className="category-card category-orange"
            onClick={() => {
              setCategory("All Products");
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="category-emoji">✨</span>
            <span className="category-name">Explore Everything</span>
            <span className="category-subtitle">Browse our collection</span>
            <span className="category-arrow">↗</span>
          </button>
        </div>
      </section>

      {/* Products */}
      <section className="section products-section" id="products">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDPICKED FOR YOU</span>
            <h2>Popular Products</h2>
            <p>Everyday essentials, all in one collection.</p>
          </div>

          <div className="product-filter">
            {categories.map((item) => (
              <button
                key={item.name}
                className={category === item.name ? "filter-active" : ""}
                onClick={() => setCategory(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {search && (
          <p className="results-message">
            Search results for: <strong>{search}</strong>
          </p>
        )}

        <div className="product-grid">
          {filteredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div
                className="product-image"
                style={{ backgroundColor: product.color }}
              >
                <span className="product-badge">{product.badge}</span>
                <span className="product-emoji" aria-label={product.name}>
                  {product.emoji}
                </span>

                <button
                  className="quick-add"
                  onClick={() => addToCart(product.id, product.name)}
                  aria-label={`Add ${product.name} to cart`}
                  title="Add to cart"
                >
                  +
                </button>
              </div>

              <div className="product-info">
                <span className="product-category">{product.category}</span>
                <h3>{product.name}</h3>

                <div className="rating">
                  <span>★</span> {product.rating}
                  <small> · Sample rating</small>
                </div>

                <div className="price-row">
                  <strong>{formatPrice(product.price)}</strong>
                  <del>{formatPrice(product.oldPrice)}</del>
                </div>

                <button
                  className="add-button"
                  onClick={() => addToCart(product.id, product.name)}
                >
                  Add to Cart <span>+</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="empty-state">
            <span>🔎</span>
            <h3>No products found</h3>
            <p>Try a different search or browse all products.</p>
            <button
              className="primary-button"
              onClick={() => {
                setSearch("");
                setCategory("All Products");
              }}
            >
              Show all products
            </button>
          </div>
        )}

        <div className="catalog-note">
          These are demonstration products. Prices, ratings and stock have not
          been verified for real sales.
        </div>
      </section>

      {/* Bottom banner */}
      <section className="newsletter">
        <div>
          <span className="eyebrow">WELCOME TO GADGET STORE</span>
          <h2>Your next favourite gadget is waiting.</h2>
          <p>Explore our collection and find something made for you.</p>
        </div>
        <a href="#products" className="newsletter-button">
          Explore Products →
        </a>
      </section>

      {/* Footer */}
      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon">G</span>
          <span>
            <strong>GADGET</strong>
            <small>STORE</small>
          </span>
        </a>

        <p>
          Your everyday destination for gadgets and tech accessories.
        </p>

        <div className="footer-bottom">
          <span>© 2026 Gadget Store. All rights reserved.</span>
          <span>Made for tech lovers in Bangladesh 🇧🇩</span>
        </div>
      </footer>

      {/* Notification */}
      {notice && (
        <div className="toast" role="status">
          <span>✓</span> {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </main>
  );
}