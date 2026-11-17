"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import StoreHeader from "@/components/store/StoreHeader";
import {
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Package,
  ChevronRight,
  Star,
  RotateCcw,
} from "lucide-react";

const STORAGE_KEY = "gadget-store-cart";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85";

type Category = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  heroBannerImageUrl?: string;
  heroBannerImages?: string[];
  heroBannerInterval?: number;
  isActive: boolean;
  sortOrder: number;
};

type Subcategory = {
  id: string;
  name: string;
  parentCategoryId: string;
  isActive: boolean;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  brand: string;
  description: string;
  price: number;
  oldPrice: number;
  imageUrl: string;
  heroBannerImageUrl?: string;
  emoji: string;
  color: string;
  rating: number;
  reviewCount: number;
  stock: number;
  isFeatured: boolean;
  createdAt: number;
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

type SortOption = "featured" | "price-low" | "price-high" | "newest" | "top-rated";
type StoreSettings = {
  storeName: string;
  logoUrl: string;
  phone: string;
};

type HomepageSettings = {
  announcement?: {
    enabled?: boolean;
    text?: string;
    link?: string;
  };
};

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "GADGET STORE",
  logoUrl: "",
  phone: "",
};

const DEFAULT_ANNOUNCEMENT = {
  enabled: true,
  text: "Free delivery on orders over ৳3,000",
  link: "/products",
};

function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value).replace("BDT", "৳");
}

function getTimestamp(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value &&
      typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("featured");
  const [toast, setToast] = useState("");
  const [activeHeroBannerIndex, setActiveHeroBannerIndex] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsCustomerLoggedIn(!!user);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "store"), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      setStoreSettings({
        storeName: data.storeName || DEFAULT_STORE_SETTINGS.storeName,
        logoUrl: data.logoUrl || "",
        phone: data.phone || "",
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "homepage"), (snapshot) => {
      if (!snapshot.exists()) {
        setAnnouncement(DEFAULT_ANNOUNCEMENT);
        return;
      }

      const saved = snapshot.data().announcement || {};

      setAnnouncement({
        enabled: saved.enabled ?? DEFAULT_ANNOUNCEMENT.enabled,
        text: saved.text || DEFAULT_ANNOUNCEMENT.text,
        link: saved.link || DEFAULT_ANNOUNCEMENT.link,
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const readCounts = () => {
      try {
        const wishlist = JSON.parse(
          localStorage.getItem("gadget-store-wishlist") || "[]"
        );

        const cart = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        );

        setWishlistCount(
          Array.isArray(wishlist) ? wishlist.length : 0
        );

        setCartCount(
          Array.isArray(cart)
            ? cart.reduce(
                (total, item) =>
                  total + Math.max(0, Number(item.quantity) || 0),
                0
              )
            : 0
        );
      } catch {
        setWishlistCount(0);
        setCartCount(0);
      }
    };

    readCounts();

    window.addEventListener("storage", readCounts);
    window.addEventListener("focus", readCounts);

    return () => {
      window.removeEventListener("storage", readCounts);
      window.removeEventListener("focus", readCounts);
    };
  }, []);

  useEffect(() => {
    const handleSubcategory = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setSelectedSubcategory(customEvent.detail || "");
    };

    window.addEventListener("gs-category-subcategory", handleSubcategory);

    return () => {
      window.removeEventListener("gs-category-subcategory", handleSubcategory);
    };
  }, []);
  useEffect(() => {
    let categoriesLoaded = false;
    let productsLoaded = false;
    let subcategoriesLoaded = false;

    const updateLoading = () => {
      if (categoriesLoaded && productsLoaded && subcategoriesLoaded) {
        setLoading(false);
      }
    };

    const unsubCategories = onSnapshot(collection(db, "categories"), (snapshot) => {
      const list: Category[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: String(data.name || ""),
          description: String(data.description || ""),
          imageUrl: String(data.imageUrl || ""),
          heroBannerImageUrl: String(data.heroBannerImageUrl || ""),
          heroBannerImages: Array.isArray(data.heroBannerImages) ? data.heroBannerImages.filter((url: unknown): url is string => typeof url === "string" && !!url) : [],
          heroBannerInterval: Math.min(10, Math.max(3, Number(data.heroBannerInterval) || 5)),
          isActive: data.isActive !== false,
          sortOrder: Number(data.sortOrder) || 0,
        };
      }).filter((item) => item.name && item.isActive);

      list.sort((a, b) => a.sortOrder - b.sortOrder);
      setCategories(list);
      categoriesLoaded = true;
      updateLoading();
    }, (err) => {
      console.error("Category load error:", err);
      setError("Unable to load category information. Please refresh the page.");
      setLoading(false);
    });

    const unsubSubcategories = onSnapshot(collection(db, "subcategories"), (snapshot) => {
      const list: Subcategory[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: String(data.name || ""),
          parentCategoryId: String(data.parentCategoryId || ""),
          isActive: data.isActive !== false,
          sortOrder: Number(data.sortOrder) || 0,
        };
      }).filter((item) => item.name && item.parentCategoryId && item.isActive);

      list.sort((a, b) => a.sortOrder - b.sortOrder);
      setSubcategories(list);
      subcategoriesLoaded = true;
      updateLoading();
    }, (err) => {
      console.error("Subcategory load error:", err);
      setError("Unable to load subcategories. Please refresh the page.");
      setLoading(false);
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const list: Product[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: String(data.name || "Unnamed Product"),
          category: String(data.category || "Accessories"),
          categoryId: String(data.categoryId || ""),
          subcategory: String(data.subcategory || ""),
          subcategoryId: String(data.subcategoryId || ""),
          brand: String(data.brand || ""),
          description: String(data.description || ""),
          price: Number(data.price) || 0,
          oldPrice: Number(data.oldPrice) || Number(data.price) || 0,
          imageUrl: String(data.imageUrl || DEFAULT_IMAGE),
          emoji: String(data.emoji || "📦"),
          color: String(data.color || "#f3f6fb"),
          rating: Number(data.rating) || 0,
          reviewCount: Number(data.reviewCount) || 0,
          stock: Math.max(0, Number(data.stock ?? 0)),
          isFeatured: data.isFeatured === true,
          createdAt: getTimestamp(data.createdAt),
        };
      });

      setProducts(list);
      productsLoaded = true;
      updateLoading();
    }, (err) => {
      console.error("Product load error:", err);
      setError("Unable to load products. Please refresh the page.");
      setLoading(false);
    });

    return () => {
      unsubCategories();
      unsubSubcategories();
      unsubProducts();
    };
  }, []);

  const category = useMemo(() => {
    return categories.find((item) => slugify(item.name) === slug);
  }, [categories, slug]);

  const heroBannerImages = useMemo(() => {
    if (!category) return [];
    if (category.heroBannerImages?.length) return category.heroBannerImages;
    if (category.heroBannerImageUrl) return [category.heroBannerImageUrl];
    return category.imageUrl ? [category.imageUrl] : [];
  }, [category]);

  useEffect(() => {
    setActiveHeroBannerIndex(0);

    if (heroBannerImages.length <= 1) return;

    const interval = Math.min(10, Math.max(3, category?.heroBannerInterval || 5));

    const timer = window.setInterval(() => {
      setActiveHeroBannerIndex((current) => (current + 1) % heroBannerImages.length);
    }, interval * 1000);

    return () => window.clearInterval(timer);
  }, [heroBannerImages, category?.heroBannerInterval]);

  const categorySubcategories = useMemo(() => {
    if (!category) return [];
    return subcategories.filter((item) => item.parentCategoryId === category.id);
  }, [subcategories, category]);

  const categoryProducts = useMemo(() => {
    if (!category) return [];

    return products.filter((item) =>
      item.categoryId === category.id ||
      slugify(item.category) === slug
    );
  }, [products, category, slug]);

  const highestPrice = useMemo(() => {
    return Math.max(100000, ...products.map((item) => item.price));
  }, [products]);

  useEffect(() => {
    setMaxPrice(highestPrice);
  }, [highestPrice]);

  const filteredProducts = useMemo(() => {
    let result = categoryProducts.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand.toLowerCase().includes(search.toLowerCase());

      const matchesSubcategory =
        !selectedSubcategory || item.subcategoryId === selectedSubcategory;

      const matchesPrice =
        item.price >= minPrice && item.price <= maxPrice;

      const matchesStock = !inStockOnly || item.stock > 0;

      return matchesSearch && matchesSubcategory && matchesPrice && matchesStock;
    });

    switch (sortOption) {
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "top-rated":
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        result.sort((a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.rating - a.rating
        );
    }

    return result;
  }, [categoryProducts, search, selectedSubcategory, minPrice, maxPrice, inStockOnly, sortOption]);

  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length < 2) return [];

    return products
      .filter((product) =>
        [product.name, product.category, product.brand, product.description]
          .some((value) => value.toLowerCase().includes(query))
      )
      .slice(0, 6)
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
      }));
  }, [products, search]);

  const sharedHeader = (
    <StoreHeader
      isCategoryPage={true}
      storeName={storeSettings.storeName}
      logoUrl={storeSettings.logoUrl}
      phone={storeSettings.phone}
      announcementEnabled={announcement.enabled}
      announcementText={announcement.text}
      announcementLink={announcement.link}
      categories={categories.map((item) => ({
        name: item.name,
        label: item.name,
        subcategories: subcategories
          .filter((subitem) => subitem.parentCategoryId === item.id)
          .map((subitem) => ({
            id: subitem.id,
            name: subitem.name,
          })),
      }))}
      activeCategory={category?.name || ""}
      selectedSubcategoryId={selectedSubcategory}
      onSelectCategory={() => {
        setSelectedSubcategory("");
      }}
      onSelectSubcategory={setSelectedSubcategory}
      search={search}
      onSearchChange={setSearch}
      searchSuggestions={searchSuggestions}
      onSearchSubmit={() => {}}
      onSearchSuggestionSelect={(product) => {
        setSearch(product.name);
      }}
      wishlistCount={wishlistCount}
      isCustomerLoggedIn={isCustomerLoggedIn}
      cartCount={cartCount}
    />
  );
  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setToast("This product is currently out of stock.");
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = saved ? JSON.parse(saved) : [];

      if (!Array.isArray(items)) throw new Error("Invalid cart data");

      const existing = items.find((item) => item.id === product.id);

      const cartProduct: CartItem = {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity: 1,
        emoji: product.emoji || "📦",
        color: product.color || "#f3f6fb",
        image: product.imageUrl || DEFAULT_IMAGE,
      };

      const updated = existing
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...items, cartProduct];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));

      setToast(`${product.name} added to your cart!`);
    } catch {
      setToast("Unable to add product to cart. Please try again.");
    }

    window.setTimeout(() => setToast(""), 2500);
  }

  function resetFilters() {
    setSearch("");
    setSelectedSubcategory("");
    setMinPrice(0);
    setMaxPrice(highestPrice);
    setInStockOnly(false);
    setSortOption("featured");
  }

  if (loading) {
    return (
      <main className="gs-category-page">
        {sharedHeader}
        <div className="gs-category-empty">
          <h2>Loading category...</h2>
          <p>Please wait while we load our collection.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="gs-category-page">
        {sharedHeader}
        <div className="gs-category-empty">
          <h2>Something went wrong</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="gs-category-page">
        {sharedHeader}
        <div className="gs-category-empty">
          <h2>Category not found</h2>
          <p>This category may have been removed or is currently unavailable.</p>
          <Link href="/">Back to Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="gs-category-page">
        {sharedHeader}
      <div className="gs-category-breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight size={15} />
        <span>Categories</span>
        <ChevronRight size={15} />
        <strong>{category.name}</strong>
      </div>

      <section className="gs-category-content">

        <div className="gs-category-layout">
          <aside className="gs-category-sidebar">
        <div className="gs-filter-panel">
  <div className="gs-filter-heading">
    <div>
      <span className="gs-filter-eyebrow">REFINE YOUR SEARCH</span>
      <h3>Filters</h3>
    </div>
    <SlidersHorizontal size={20} />
  </div>

  <div className="gs-filter-section">
    <h4>Price Range</h4>

    <div className="gs-price-values">
      <div>
        <span>Minimum</span>
        <strong>৳{minPrice.toLocaleString("en-BD")}</strong>
      </div>
      <div>
        <span>Maximum</span>
        <strong>৳{maxPrice.toLocaleString("en-BD")}</strong>
      </div>
    </div>

    <div className="gs-dual-range">
      <input
        type="range"
        min="0"
        max={Math.max(highestPrice, 1)}
        step="50"
        value={Math.min(minPrice, highestPrice)}
        onChange={(event) => {
          setMinPrice(Math.min(Number(event.target.value), maxPrice));
        }}
        aria-label="Minimum price"
        className="gs-range-min"
      />

      <input
        type="range"
        min="0"
        max={Math.max(highestPrice, 1)}
        step="50"
        value={Math.min(maxPrice, highestPrice)}
        onChange={(event) => {
          setMaxPrice(Math.max(Number(event.target.value), minPrice));
        }}
        aria-label="Maximum price"
        className="gs-range-max"
      />
    </div>

    <div className="gs-price-limits">
      <span>৳0</span>
      <span>৳{highestPrice.toLocaleString("en-BD")}</span>
    </div>
  </div>

  <div className="gs-filter-section">
    <h4>Availability</h4>

    <label className="gs-stock-toggle">
      <span>
        <strong>In Stock Only</strong>
        <small>Show available products</small>
      </span>

      <input
        type="checkbox"
        checked={inStockOnly}
        onChange={(event) => setInStockOnly(event.target.checked)}
      />

      <span className="gs-toggle-track"></span>
    </label>
  </div>

  <div className="gs-filter-section">
    <h4>Sort By</h4>

    <label className="gs-sidebar-sort">
      <select
        value={sortOption}
        onChange={(event) => setSortOption(event.target.value as SortOption)}
      >
        <option value="featured">Featured</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
        <option value="newest">Newest</option>
        <option value="top-rated">Top Rated</option>
      </select>
    </label>
  </div>

  <button
    type="button"
    className="gs-category-reset"
    onClick={resetFilters}
  >
    <RotateCcw size={15} />
    Reset All Filters
  </button>
</div>
          </aside>

          <div className="gs-category-main">
            <section className="gs-category-hero gs-category-image-banner">
              {heroBannerImages.length > 0 && (
                <img
                  key={activeHeroBannerIndex}
                  className="gs-category-full-banner"
                  src={heroBannerImages[activeHeroBannerIndex]}
                  alt={`${category.name} banner ${activeHeroBannerIndex + 1}`}
                />
              )}

              {heroBannerImages.length > 1 && (
                <div className="gs-category-banner-dots">
                  {heroBannerImages.map((_: string, index: number) => (
                    <button
                      key={index}
                      type="button"
                      className={`gs-category-banner-dot ${activeHeroBannerIndex === index ? "active" : ""}`}
                      onClick={() => setActiveHeroBannerIndex(index)}
                      aria-label={`Show banner ${index + 1}`}
                      aria-current={activeHeroBannerIndex === index ? "true" : undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="gs-category-heading">
          <div>
            <span className="gs-category-eyebrow">OUR COLLECTION</span>
            <h2>Explore {category.name}</h2>
            <p>Find the right product for your everyday needs.</p>
          </div>
        </div>

        <div className="gs-category-results">
          <span>{filteredProducts.length} products found</span>
          <span>{category.name}</span>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="gs-category-product-grid">
            {filteredProducts.map((product) => {
              const discount = product.oldPrice > product.price && product.oldPrice > 0
                ? Math.round((1 - product.price / product.oldPrice) * 100)
                : 0;

              return (
                <article className="gs-product-card" key={product.id}>
                  <div className="gs-product-visual" style={{ background: product.color }}>
                    {product.isFeatured && (
                      <span className="gs-product-badge">FEATURED</span>
                    )}

                    {discount > 0 && (
                      <span className="gs-discount-badge">-{discount}%</span>
                    )}

                    <Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
                      <img
                        src={product.imageUrl || DEFAULT_IMAGE}
                        alt={product.name}
                        loading="lazy"
                      />
                    </Link>

                    <button
                      type="button"
                      className="gs-quick-add"
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      <ShoppingCart size={18} />
                    </button>
                  </div>

                  <div className="gs-product-details">
                    <span className="gs-product-category">
                      {product.subcategory || product.category}
                    </span>

                    <h3>
                      <Link
                        href={`/product/${product.id}`}
                        className="gs-product-title-link"
                      >
                        {product.name}
                      </Link>
                    </h3>

                    <div className="gs-product-rating">
                      {product.rating > 0 ? (
                        <>
                          <Star size={14} fill="currentColor" />
                          {product.rating.toFixed(1)}
                          <small>({product.reviewCount} reviews)</small>
                        </>
                      ) : (
                        <small>No reviews yet</small>
                      )}
                    </div>

                    <div className="gs-product-price">
                      <strong>{formatPrice(product.price)}</strong>
                      {product.oldPrice > product.price && (
                        <del>{formatPrice(product.oldPrice)}</del>
                      )}
                    </div>

                    <button
                      type="button"
                      className="gs-add-cart"
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                    >
                      {product.stock > 0 ? (
                        <>Add to Cart <span>+</span></>
                      ) : "Out of Stock"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="gs-category-empty">
            <Package size={34} />
            <h3>No matching products</h3>
            <p>Try changing your search or filters to find more products.</p>

          </div>
        )}
          </div>
        </div>
      </section>

      {toast && (
        <div className="gs-category-toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
