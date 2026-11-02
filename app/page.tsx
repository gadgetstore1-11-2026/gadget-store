 "use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import "./home.css";

const STORAGE_KEY = "gadget-store-cart";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85";

type Product = {
  id: string; name: string; category: string; price: number; oldPrice: number;
  description?: string; imageUrl: string; rating?: number; badge?: string;
  emoji?: string; color?: string; brand?: string;
};
type StoreSettings = { storeName: string; logoUrl: string; phone: string; whatsapp: string; address: string };
type CartItem = { id: string; name: string; category: string; price: number; quantity: number; emoji: string; color: string; image: string };

const DEFAULT_SETTINGS: StoreSettings = { storeName: "GADGET STORE", logoUrl: "", phone: "", whatsapp: "", address: "" };
const CATEGORY_META: Record<string, { emoji: string; description: string }> = {
  Audio: { emoji: "🎧", description: "Headphones, earbuds and speakers" },
  "Smart Watch": { emoji: "⌚", description: "Smart watches and wearables" },
  Accessories: { emoji: "🔌", description: "Everyday tech essentials" },
  Mobile: { emoji: "📱", description: "Useful mobile accessories" },
  Gaming: { emoji: "🎮", description: "Gear up for your games" },
};
const normalizeCategory = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s+\d+$/, "");

export default function Home() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [category, setCategory] = useState("All Products");
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [email, setEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState({ hours: 11, minutes: 59, seconds: 59 });
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsCustomerLoggedIn(!!user);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const list: Product[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id, name: data.name || "Unnamed Product",
          category: normalizeCategory(data.category || "Accessories"),
          price: Number(data.price) || 0,
          oldPrice: Number(data.oldPrice) || Number(data.price) || 0,
          description: data.description || "", imageUrl: data.imageUrl || DEFAULT_IMAGE,
          rating: Number(data.rating) || 4.8, badge: data.badge || "POPULAR",
          emoji: data.emoji || "📦", color: data.color || "#f3f6fb", brand: data.brand || "",
        };
      });
      setProducts(list); setLoadingProducts(false); setProductError("");
    }, (error) => {
      console.error("Products load error:", error);
      setProductError("We could not load products right now. Please refresh the page.");
      setLoadingProducts(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = saved ? JSON.parse(saved) : [];
      if (Array.isArray(items)) setCartCount(items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));
    } catch { setCartCount(0); }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "store"), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setStoreSettings({
        storeName: data.storeName || DEFAULT_SETTINGS.storeName, logoUrl: data.logoUrl || "",
        phone: data.phone || "", whatsapp: data.whatsapp || "", address: data.address || "",
      });
    }, (error) => console.error("Store settings load error:", error));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft((current) => {
      if (current.seconds > 0) return { ...current, seconds: current.seconds - 1 };
      if (current.minutes > 0) return { hours: current.hours, minutes: current.minutes - 1, seconds: 59 };
      if (current.hours > 0) return { hours: current.hours - 1, minutes: 59, seconds: 59 };
      return { hours: 11, minutes: 59, seconds: 59 };
    }), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const availableCategories = useMemo(() => {
    const names = Array.from(new Set(products.map((p) => normalizeCategory(p.category)).filter(Boolean)));
    return [
      { name: "All Products", label: "All gadgets", emoji: "✦", description: "Explore the full collection" },
      ...names.map((name) => ({ name, label: name, emoji: CATEGORY_META[name]?.emoji || "📦", description: CATEGORY_META[name]?.description || `Explore ${name.toLowerCase()}` })),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "All Products" || normalizeCategory(product.category) === category;
      const matchesSearch = !query || product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) || (product.brand || "").toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const saleProducts = useMemo(() => products.filter((p) => p.oldPrice > p.price).slice(0, 4), [products]);
  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand?.trim()).filter((v): v is string => Boolean(v)))).slice(0, 8), [products]);
  const formatPrice = (price: number) => `৳${price.toLocaleString("en-BD")}`;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(items)) throw new Error("Invalid cart data");
      const existing = items.find((item) => item.id === productId);
      const cartProduct: CartItem = {
        id: product.id, name: product.name, category: product.category, price: product.price,
        quantity: 1, emoji: product.emoji || "📦", color: product.color || "#f3f6fb",
        image: product.imageUrl || DEFAULT_IMAGE,
      };
      const updated = existing
        ? items.map((item) => item.id === productId ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, cartProduct];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCartCount(updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));
      showNotice(`${product.name} added to your cart!`);
    } catch { showNotice("Unable to add product to cart. Please try again."); }
  }

  function StoreLogo() {
    return storeSettings.logoUrl
      ? <img src={storeSettings.logoUrl} alt={storeSettings.storeName} className="gs-store-logo" />
      : <span className="gs-store-logo">{storeSettings.storeName.charAt(0).toUpperCase()}</span>;
  }

  function handleNewsletterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNewsletterMessage("Please enter a valid email address."); return;
    }
    setNewsletterMessage("Thanks for your interest! Newsletter subscriptions are not connected yet.");
    setEmail("");
  }

  const featuredProduct = products.find((p) => p.imageUrl && p.imageUrl !== DEFAULT_IMAGE) || products[0];

  return (
    <main className="store gs-home">
      <div className="gs-announcement"><div className="gs-container gs-announcement-inner"><span>⚡ MEGA GADGET SALE</span><span>Discover deals on everyday tech</span><b>Nationwide delivery across Bangladesh</b></div></div>

      <header className="gs-store-header gs-container">
        <Link href="/" className="gs-store-brand" aria-label="Go to homepage"><StoreLogo /><span><strong>{storeSettings.storeName.toUpperCase()}</strong><small>TECH FOR EVERYDAY</small></span></Link>
        <form className="gs-store-search" onSubmit={(e) => { e.preventDefault(); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}>
          <span aria-hidden="true">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headphones, watches, chargers..." aria-label="Search products" /><button type="submit">Search</button>
        </form>
        <Link href="/cart" className="gs-cart-link">🛒 <span>My Cart</span><b>{cartCount}</b></Link>
      </header>

      <nav className="gs-store-nav">
  <div className="gs-container gs-store-nav-inner">
    <a className="selected" href="#home">Home</a>
    <a href="#categories">Categories</a>
    <a href="#products">Shop All</a>
    <Link href="/track-order">Track Order</Link>
    <Link href={isCustomerLoggedIn ? "/account" : "/account/login"}>{isCustomerLoggedIn ? "My Account" : "Customer Login"}</Link>
    <a href="#why-us">Why Choose Us</a>
    <span>✦ FREE DELIVERY ON ORDERS OVER ৳3,000</span>
  </div>
</nav>

      <section className="gs-hero gs-container" id="home">
        <div className="gs-hero-copy"><div className="gs-hero-kicker"><span /> YOUR EVERYDAY TECH DESTINATION</div><h1>Make every day<br />a little more <em>smart.</em></h1><p>Discover useful gadgets, smart accessories and everyday tech essentials — thoughtfully selected for your lifestyle.</p><div className="gs-hero-buttons"><a href="#products" className="gs-button-primary">Shop products <span>→</span></a><a href="#categories" className="gs-button-ghost">Explore categories</a></div><div className="gs-hero-trust"><span>✓ Carefully selected gadgets</span><span>✓ Shopping made simple</span></div></div>
        <div className="gs-hero-art"><div className="gs-hero-glow" /><div className="gs-hero-ring ring-a" /><div className="gs-hero-ring ring-b" /><div className="gs-hero-image">{featuredProduct ? <img src={featuredProduct.imageUrl || DEFAULT_IMAGE} alt={featuredProduct.name} /> : <div className="gs-hero-placeholder">⌚</div>}</div><div className="gs-float-note note-top"><span>✦</span><div><strong>Smart choices</strong><small>Everyday essentials</small></div></div><div className="gs-float-note note-bottom"><span>⚡</span><div><strong>Explore the collection</strong><small>Find your next favourite</small></div></div><div className="gs-hero-watch">✦</div></div>
        <div className="gs-hero-index">01 <span>/</span> FEATURED COLLECTION</div>
      </section>

      <section className="gs-benefits gs-container" id="why-us">
        <div><span>🚚</span><p><strong>Delivery across Bangladesh</strong><small>Delivery options at checkout</small></p></div><div><span>🔒</span><p><strong>Shopping with confidence</strong><small>Simple and secure ordering</small></p></div><div><span>💬</span><p><strong>Customer support</strong><small>We are here to help</small></p></div><div><span>💳</span><p><strong>Cash on delivery</strong><small>Pay when your order arrives</small></p></div>
      </section>

      <section className="gs-home-section gs-container" id="categories">
        <div className="gs-section-title"><div><span>EXPLORE OUR COLLECTION</span><h2>Shop by category</h2><p>Find the right tech for your everyday life.</p></div><a href="#products">View all products →</a></div>
        <div className="gs-category-grid">{availableCategories.map((item, index) => <button key={item.name} className={`gs-category-tile tile-${index % 4} ${category === item.name ? "chosen" : ""}`} onClick={() => { setCategory(item.name); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}><span className="gs-category-icon">{item.emoji}</span><strong>{item.label}</strong><small>{item.description}</small><i>↗</i></button>)}</div>
      </section>

      {saleProducts.length > 0 && <section className="gs-flash-section gs-container" id="flash-sale">
        <div className="gs-flash-heading"><div><span className="gs-eyebrow">LIMITED-TIME DEALS</span><h2>⚡ Flash Sale</h2><p>Special prices on selected products.</p></div><div className="gs-countdown"><small>Offer timer</small><div><b>{String(timeLeft.hours).padStart(2, "0")}</b><span>:</span><b>{String(timeLeft.minutes).padStart(2, "0")}</b><span>:</span><b>{String(timeLeft.seconds).padStart(2, "0")}</b></div><small>Demo countdown display</small></div></div>
        <div className="gs-flash-grid">{saleProducts.map((product) => { const discount = product.oldPrice > 0 ? Math.max(0, Math.round((1 - product.price / product.oldPrice) * 100)) : 0; return <article className="gs-flash-card" key={product.id}><div className="gs-flash-image" style={{ background: product.color }}><span>-{discount}%</span><Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}><img src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} loading="lazy" /></Link></div><div className="gs-flash-info"><small>{product.category}</small><h3><Link href={`/product/${product.id}`} className="gs-product-title-link">{product.name}</Link></h3><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.oldPrice)}</del><button onClick={() => addToCart(product.id)}>Add to Cart +</button></div></article>; })}</div>
      </section>}

      <section className="gs-home-section gs-products-section" id="products">
        <div className="gs-section-title gs-products-heading"><div><span>HANDPICKED FOR YOU</span><h2>Popular products</h2><p>Everyday essentials, all in one collection.</p></div><div className="gs-product-tabs">{availableCategories.map((item) => <button key={item.name} className={category === item.name ? "active" : ""} onClick={() => setCategory(item.name)}>{item.label}</button>)}</div></div>
        {search && <p className="gs-search-result">Showing results for <strong>“{search}”</strong></p>}
        {loadingProducts && <div className="gs-empty-state"><h3>Loading products...</h3><p>Please wait while we load our products.</p></div>}
        {!loadingProducts && productError && <div className="gs-empty-state"><h3>Unable to load products</h3><p>{productError}</p></div>}
        {!loadingProducts && !productError && filteredProducts.length > 0 && <div className="gs-product-grid">{filteredProducts.map((product) => { const discount = product.oldPrice > product.price && product.oldPrice > 0 ? Math.round((1 - product.price / product.oldPrice) * 100) : 0; return <article className="gs-product-card" key={product.id}><div className="gs-product-visual" style={{ background: product.color }}><span className="gs-product-badge">{product.badge}</span>{discount > 0 && <span className="gs-discount-badge">-{discount}%</span>}<Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}><img src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} loading="lazy" /></Link><button className="gs-quick-add" onClick={() => addToCart(product.id)} aria-label={`Add ${product.name} to cart`}>+</button></div><div className="gs-product-details"><span className="gs-product-category">{product.category}</span><h3><Link href={`/product/${product.id}`} className="gs-product-title-link">{product.name}</Link></h3><div className="gs-product-rating"><span>★</span> {product.rating || 4.8}<small> Customer rating</small></div><div className="gs-product-price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice > product.price && <del>{formatPrice(product.oldPrice)}</del>}</div><button className="gs-add-cart" onClick={() => addToCart(product.id)}>Add to Cart <span>+</span></button></div></article>; })}</div>}
        {!loadingProducts && !productError && filteredProducts.length === 0 && <div className="gs-empty-state"><span>⌕</span><h3>No products found</h3><p>Try a different search or browse all products.</p><button onClick={() => { setSearch(""); setCategory("All Products"); }}>Show all products</button></div>}
      </section>

      <section className="gs-offer-banner gs-container"><div className="gs-offer-copy"><span>MORE REASONS TO SHOP</span><h2>Enjoy free delivery<br />on orders over ৳3,000.</h2><p>Fill your cart with everyday favourites and save on delivery.</p><a href="#products">Start shopping →</a></div><div className="gs-offer-art"><div className="gs-offer-circle">৳<strong>0</strong><small>DELIVERY FEE</small></div><span className="gs-offer-spark">✦</span></div></section>

      <section className="gs-brands-section gs-container"><div className="gs-section-title"><div><span>OUR PRODUCT RANGE</span><h2>Explore popular brands</h2><p>Browse brands available in our product collection.</p></div></div>{brands.length > 0 ? <div className="gs-brand-list">{brands.map((brand) => <button key={brand} onClick={() => { setSearch(brand); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}>{brand}</button>)}</div> : <div className="gs-brand-empty">Brand names will appear here when they are added to product details.</div>}</section>

      <section className="gs-why-section gs-container"><div className="gs-why-intro"><span>THE GADGET STORE DIFFERENCE</span><h2>Tech shopping,<br />made refreshingly simple.</h2><p>Discover useful products, place your order with ease and get support when you need it.</p><a href="#products">Explore the collection →</a></div><div className="gs-why-grid"><article><span>01</span><b>Curated collection</b><p>Explore practical gadgets and accessories for everyday use.</p></article><article><span>02</span><b>Easy ordering</b><p>A simple shopping experience from product selection to checkout.</p></article><article><span>03</span><b>Cash on delivery</b><p>Pay for your order when it arrives at your doorstep.</p></article><article><span>04</span><b>Helpful support</b><p>Reach out to our team whenever you need assistance.</p></article></div></section>

      <section className="gs-newsletter gs-container"><div><span>STAY IN THE LOOP</span><h2>Get updates from our store.</h2><p>Be the first to hear about new arrivals and special offers.</p></div><form onSubmit={handleNewsletterSubmit}><label className="gs-sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" required /><button type="submit">Subscribe →</button>{newsletterMessage && <small role="status">{newsletterMessage}</small>}</form></section>

      <section className="gs-home-cta gs-container"><div><span>WELCOME TO {storeSettings.storeName.toUpperCase()}</span><h2>Your next favourite gadget is waiting.</h2><p>Explore our collection and find something made for you.</p></div><a href="#products">Explore Products →</a><div className="gs-cta-orb">{storeSettings.storeName.charAt(0).toUpperCase()}</div></section>

      <footer className="gs-store-footer"><div className="gs-container gs-footer-main"><div className="gs-footer-about"><Link href="/" className="gs-store-brand"><StoreLogo /><span><strong>{storeSettings.storeName.toUpperCase()}</strong><small>TECH FOR EVERYDAY</small></span></Link><p>Your everyday destination for gadgets and tech accessories.</p></div><div className="gs-footer-column">
  <h3>Quick links</h3>
  <a href="#home">Home</a>
  <a href="#categories">Categories</a>
  <a href="#products">Shop all</a>
  <Link href="/track-order">Track Order</Link>
  <Link href="/cart">My cart</Link>
</div><div className="gs-footer-column"><h3>Customer care</h3>{storeSettings.phone ? <a href={`tel:${storeSettings.phone}`}>Phone: {storeSettings.phone}</a> : <span>Customer support</span>}{storeSettings.whatsapp && <a href={`https://wa.me/${storeSettings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp support</a>}{storeSettings.address && <p>{storeSettings.address}</p>}</div><div className="gs-footer-column"><h3>Shopping information</h3><span>Delivery across Bangladesh</span><span>Cash on delivery</span><span>Free delivery over ৳3,000</span></div></div><div className="gs-container gs-footer-bottom"><span>© {new Date().getFullYear()} {storeSettings.storeName}. All rights reserved.</span><span>Made for tech lovers in Bangladesh 🇧🇩</span></div></footer>

      {notice && <div className="gs-home-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
    </main>
  );
}
