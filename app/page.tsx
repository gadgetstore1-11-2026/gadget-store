"use client";
import Image from "next/image";
import { Search, Heart, UserRound, ShoppingBag, Menu, ChevronDown, ChevronLeft, ChevronRight, Plus, Eye, Smartphone, Headphones, Watch, Laptop, Camera, Gamepad2, Speaker, BatteryCharging, Cable, Tablet, Monitor, LayoutGrid, Package, type LucideIcon } from "lucide-react";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import StoreHeader from "@/components/store/StoreHeader";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";



function getCategoryIcon(category: string): LucideIcon {
  const name = category.toLowerCase();

  if (name.includes("all product")) return LayoutGrid;
  if (name.includes("phone") || name.includes("mobile")) return Smartphone;
  if (name.includes("headphone") || name.includes("earbud") || name.includes("audio")) return Headphones;
  if (name.includes("watch")) return Watch;
  if (name.includes("laptop") || name.includes("computer")) return Laptop;
  if (name.includes("camera")) return Camera;
  if (name.includes("gaming") || name.includes("game")) return Gamepad2;
  if (name.includes("speaker")) return Speaker;
  if (name.includes("power bank") || name.includes("battery")) return BatteryCharging;
  if (name.includes("charger") || name.includes("cable") || name.includes("accessor")) return Cable;
  if (name.includes("tablet")) return Tablet;
  if (name.includes("monitor") || name.includes("display")) return Monitor;

  return Package;
}
const STORAGE_KEY = "gadget-store-cart";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85";

type Product = {
  id: string; name: string; category: string; categoryId?: string;
  subcategory?: string; subcategoryId?: string; price: number; oldPrice: number;
  description?: string; imageUrl: string; rating?: number; badge?: string;
  emoji?: string; color?: string; brand?: string; stock: number; createdAt?: number; reviewCount?: number; isFeatured?: boolean;
};
type CustomerReview = {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string | null;
};
type StoreCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};
type StoreSubcategory = {
  id: string;
  name: string;
  parentCategoryId: string;
  isActive: boolean;
  sortOrder: number;
};
type SortOption = "featured" | "price-low" | "price-high" | "newest" | "top-rated";
type StoreSettings = { storeName: string; logoUrl: string; phone: string; whatsapp: string; address: string };
type HomepageSettings = {
  announcement?: { enabled?: boolean; text?: string; link?: string };
  hero?: { eyebrow?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string; desktopImage?: string; mobileImage?: string; slides?: string[]; intervalSeconds?: number };
  freshShelf?: { enabled?: boolean; eyebrow?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string; imageUrl?: string };
  sections?: { categories?: boolean; featuredProducts?: boolean; freshShelf?: boolean; allProducts?: boolean; reviews?: boolean; newsletter?: boolean };
  productDisplay?: { featuredCount?: number; allProductsCount?: number };
};
const DEFAULT_HOMEPAGE_SETTINGS: Required<HomepageSettings> = {
  announcement: { enabled: true, text: "Free delivery on orders over ৳3,000", link: "/products" },
  hero: { eyebrow: "GADGET STORE · NEW ARRIVALS", title: "Upgrade Your Everyday", description: "Discover smart technology and everyday essentials, carefully selected for you.", buttonText: "Shop Now", buttonLink: "/products", desktopImage: "", mobileImage: "", slides: [], intervalSeconds: 5 },
  freshShelf: { enabled: true, eyebrow: "JUST LANDED", title: "Fresh Shelf", description: "Explore the latest additions to our collection.", buttonText: "Explore New Arrivals", buttonLink: "/products", imageUrl: "" },
  sections: { categories: true, featuredProducts: true, freshShelf: true, allProducts: true, reviews: true, newsletter: true },
  productDisplay: { featuredCount: 8, allProductsCount: 8 },
};
type CartItem = { id: string; name: string; category: string; price: number; quantity: number; emoji: string; color: string; image: string };

const DEFAULT_SETTINGS: StoreSettings = { storeName: "GADGET STORE", logoUrl: "", phone: "", whatsapp: "", address: "" };
const CATEGORY_META: Record<string, { emoji: string; description: string }> = {
  Audio: { emoji: "🎧", description: "Headphones, earbuds and speakers" },
  car: { emoji: "🚗", description: "Smart devices for your car" },
  home: { emoji: "🏠", description: "Smart home essentials" },
  mobile: { emoji: "📱", description: "Phones and mobile accessories" },
  power: { emoji: "🔋", description: "Power banks and charging gear" },
  tv: { emoji: "📺", description: "TV and entertainment accessories" },
  watch: { emoji: "⌚", description: "Smart watches and wearables" },
 "Smart Watch": { emoji: "⌚", description: "Smart watches and wearables" },
  Accessories: { emoji: "🔌", description: "Everyday tech essentials" },
  Mobile: { emoji: "📱", description: "Useful mobile accessories" },
  Gaming: { emoji: "🎮", description: "Gear up for your games" },
};
const normalizeCategory = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s+\d+$/, "");
function StoreLogo({ logoUrl, storeName }: { logoUrl: string; storeName: string }) {
  return logoUrl
    ? <Image src={logoUrl} alt={storeName} width={46} height={46} unoptimized className="gs-store-logo" />
    : <span className="gs-store-logo">✦</span>;
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
  const [storeSubcategories, setStoreSubcategories] = useState<StoreSubcategory[]>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [expandedMegaCategory, setExpandedMegaCategory] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [category, setCategory] = useState("All Products");
  const categorySliderRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoryLeft, setCanScrollCategoryLeft] = useState(false);
  const [canScrollCategoryRight, setCanScrollCategoryRight] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [homepageSettings, setHomepageSettings] = useState<Required<HomepageSettings>>(DEFAULT_HOMEPAGE_SETTINGS);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState({ hours: 11, minutes: 59, seconds: 59 });
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("featured");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minPrice, setMinPrice] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

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
          categoryId: String(data.categoryId || ""),
          subcategory: normalizeCategory(String(data.subcategory || "")),
          subcategoryId: String(data.subcategoryId || ""),
          price: Number(data.price) || 0,
          oldPrice: Number(data.oldPrice) || Number(data.price) || 0,
          description: data.description || "", imageUrl: data.imageUrl || DEFAULT_IMAGE,
          rating: Number(data.rating) || 0, badge: data.badge || "POPULAR",
          emoji: data.emoji || "📦", color: data.color || "#f3f6fb", brand: data.brand || "",
          stock: Math.max(0, Number(data.stock ?? 0)),
          reviewCount: Math.max(0, Number(data.reviewCount || 0)),
          isFeatured: data.isFeatured === true,
          createdAt: typeof data.createdAt?.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt instanceof Date
              ? data.createdAt.getTime()
              : typeof data.createdAt === "string" ? new Date(data.createdAt).getTime() || 0 : 0,
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
    const unsubscribe = onSnapshot(collection(db, "subcategories"), (snapshot) => {
      const list: StoreSubcategory[] = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          name: normalizeCategory(String(data.name || "")),
          parentCategoryId: String(data.parentCategoryId || ""),
          isActive: data.isActive !== false,
          sortOrder: Number(data.sortOrder) || 0,
        };
      }).filter((item) => item.name && item.parentCategoryId);

      list.sort((a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      );

      setStoreSubcategories(list);
      console.log("[Subcategory Debug]", list);
      console.log("[Subcategory Debug]", list);
    }, (error) => {
      console.error("Subcategories load error:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews/featured")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Review request failed")))
      .then((result) => {
        if (active && result.success && Array.isArray(result.reviews)) {
          setCustomerReviews(result.reviews);
        }
      })
      .catch((error) => console.error("Customer reviews load error:", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
      const list: StoreCategory[] = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          name: normalizeCategory(String(data.name || "")),
          description: String(data.description || ""),
          imageUrl: String(data.imageUrl || ""),
          icon: String(data.icon || ""),
          sortOrder: Number(data.sortOrder) || 0,
          isActive: data.isActive !== false,
        };
      }).filter((item) => item.name);

      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      setStoreCategories(list);
    }, (error) => {
      console.error("Categories load error:", error);
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const readIds = (key: string): string[] => {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string").slice(0, 50)
          : [];
      } catch {
        return [];
      }
    };

    setWishlist(readIds("gadget-store-wishlist"));
    setRecentlyViewedIds(readIds("gadget-store-recently-viewed"));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "gadget-store-wishlist") {
        setWishlist(readIds("gadget-store-wishlist"));
      }
      if (event.key === "gadget-store-recently-viewed") {
        setRecentlyViewedIds(readIds("gadget-store-recently-viewed"));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "homepage"), (snapshot) => {
      if (!snapshot.exists()) { setHomepageSettings(DEFAULT_HOMEPAGE_SETTINGS); return; }
      const data = snapshot.data() as HomepageSettings;
      setHomepageSettings({
        announcement: { ...DEFAULT_HOMEPAGE_SETTINGS.announcement, ...(data.announcement ?? {}) },
        hero: { ...DEFAULT_HOMEPAGE_SETTINGS.hero, ...(data.hero ?? {}), slides: Array.isArray(data.hero?.slides) ? data.hero.slides : [], intervalSeconds: Number(data.hero?.intervalSeconds) || 5 },
        freshShelf: { ...DEFAULT_HOMEPAGE_SETTINGS.freshShelf, ...(data.freshShelf ?? {}) },
        sections: { ...DEFAULT_HOMEPAGE_SETTINGS.sections, ...(data.sections ?? {}) },
        productDisplay: { ...DEFAULT_HOMEPAGE_SETTINGS.productDisplay, ...(data.productDisplay ?? {}) },
      });
    }, (error) => console.error("Homepage settings load error:", error));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const slides = homepageSettings.hero.slides ?? [];

    if (slides.length <= 1) {
      setHeroSlideIndex(0);
      return;
    }

    const intervalSeconds = Math.max(
      3,
      Math.min(10, Number(homepageSettings.hero.intervalSeconds) || 5)
    );

    const timer = window.setInterval(() => {
      setHeroSlideIndex(current => (current + 1) % slides.length);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [homepageSettings.hero.slides, homepageSettings.hero.intervalSeconds]);

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

  const highestProductPrice = useMemo(
    () => Math.max(50000, ...products.map((product) => product.price)),
    [products]
  );

  useEffect(() => {
    setMaxPrice((current) => Math.max(current, highestProductPrice));
  }, [highestProductPrice]);

  const availableCategories = useMemo(() => {
    const knownNames = new Set(
      storeCategories.map((item) => item.name.toLowerCase())
    );

    const activeCategories = storeCategories
      .filter((item) => item.isActive)
      .map((item) => ({
        name: item.name,
        label: item.name,
        emoji: item.icon || CATEGORY_META[item.name]?.emoji || "📦",
        description: item.description || CATEGORY_META[item.name]?.description || `Explore ${item.name.toLowerCase()}`,
        imageUrl: item.imageUrl,
      }));

    const legacyNames = Array.from(
      new Set(
        products
          .map((product) => normalizeCategory(product.category))
          .filter((name) => name && !knownNames.has(name.toLowerCase()))
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      {
        name: "All Products",
        label: "All Products",
        emoji: "✦",
        description: "Explore the full collection",
        imageUrl: "",
      },
      ...activeCategories,
      ...legacyNames.map((name) => ({
        name,
        label: name,
        emoji: CATEGORY_META[name]?.emoji || "📦",
        description: CATEGORY_META[name]?.description || `Explore ${name.toLowerCase()}`,
        imageUrl: "",
      })),
    ];
  }, [products, storeCategories]);
  useEffect(() => {
    const slider = categorySliderRef.current;
    if (!slider) return;

    const updateArrows = () => {
      setCanScrollCategoryLeft(slider.scrollLeft > 2);
      setCanScrollCategoryRight(
        slider.scrollLeft + slider.clientWidth < slider.scrollWidth - 2
      );
    };

    updateArrows();
    slider.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);

    return () => {
      slider.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [availableCategories.length]);

  const scrollCategories = (direction: "left" | "right") => {
    const slider = categorySliderRef.current;
    if (!slider) return;

    slider.scrollBy({
      left: direction === "right"
        ? slider.clientWidth * 0.75
        : -slider.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  const selectedMainCategory = storeCategories.find(
    (item) => item.name.toLowerCase() === category.toLowerCase()
  );

  const visibleSubcategories = useMemo(() => {
    if (category === "All Products" || !selectedMainCategory) return [];

    return storeSubcategories.filter(
      (item) => item.isActive && item.parentCategoryId === selectedMainCategory.id
    );
  }, [storeSubcategories, selectedMainCategory, category]);

  const selectedSubcategory = visibleSubcategories.find(
    (item) => item.id === selectedSubcategoryId
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory =
        category === "All Products" ||
        normalizeCategory(product.category).toLowerCase() === category.toLowerCase();

      const matchesSubcategory =
        !selectedSubcategoryId ||
        product.subcategoryId === selectedSubcategoryId ||
        (
          product.subcategoryId === "" &&
          product.subcategory?.toLowerCase() === selectedSubcategory?.name.toLowerCase()
        );

      const searchableText = [
        product.name,
        product.category,
        product.subcategory || "",
        product.brand || "",
        product.description || "",
      ].join(" ").toLowerCase();
      const searchTerms = query.split(/\s+/).filter(Boolean);
      const matchesSearch =
        !query || searchTerms.every((term) => searchableText.includes(term));

      const matchesBrand =
        selectedBrand === "All Brands" ||
        (product.brand || "").trim() === selectedBrand;

      const matchesPrice = product.price >= minPrice && product.price <= maxPrice;
      const matchesRating = (product.rating || 0) >= minRating;
      const matchesStock = !inStockOnly || product.stock > 0;

      return matchesCategory && matchesSubcategory && matchesSearch && matchesBrand && matchesPrice && matchesRating && matchesStock;
    });

    if (sortOption === "price-low") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortOption === "price-high") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortOption === "newest") {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortOption === "top-rated") {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else {
      filtered.sort((a, b) =>
        (b.rating || 0) - (a.rating || 0) ||
        (b.reviewCount || 0) - (a.reviewCount || 0) ||
        a.name.localeCompare(b.name)
      );
    }

    return filtered;
  }, [products, search, category, selectedSubcategoryId, selectedSubcategory, selectedBrand, minPrice, maxPrice, minRating, inStockOnly, sortOption]);
  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return products
      .filter((product) =>
        [product.name, product.category, product.brand || "", product.description || ""]
          .some((value) => value.toLowerCase().includes(query))
      )
      .slice(0, 6);
  }, [products, search]);

  const saleProducts = useMemo(
    () => products
      .filter((product) => product.stock > 0 && product.price > 0 && product.oldPrice > product.price)
      .sort((a, b) => (1 - b.price / b.oldPrice) - (1 - a.price / a.oldPrice))
      .slice(0, 4),
    [products]
  );
  const featuredProducts = useMemo(() => {
    const available = products.filter((product) => product.stock > 0 && product.price > 0);
    const manuallyFeatured = available.filter((product) => product.isFeatured === true);
    const source = manuallyFeatured.length > 0 ? manuallyFeatured : available;
    return source.slice(0, Math.max(1, Math.min(6, homepageSettings.productDisplay.featuredCount || 6)));
  }, [products, homepageSettings.productDisplay.featuredCount]);
  const newArrivalProducts = useMemo(
    () => products
      .filter((product) => product.stock > 0 && product.price > 0 && (product.createdAt || 0) > 0)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 4),
    [products]
  );
  const brands = useMemo(
    () => Array.from(new Set(products.map((product) => product.brand?.trim()).filter((value): value is string => Boolean(value))))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8),
    [products]
  );
  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [recentlyViewedIds, products]
  );


  const formatPrice = (price: number) => `৳${price.toLocaleString("en-BD")}`;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  function toggleWishlist(productId: string) {
    const updated = wishlist.includes(productId)
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];

    setWishlist(updated);
    localStorage.setItem("gadget-store-wishlist", JSON.stringify(updated));

    showNotice(
      updated.includes(productId)
        ? "Product added to wishlist!"
        : "Product removed from wishlist!"
    );
  }
  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    if (product.stock <= 0) {
      showNotice("This product is currently out of stock.");
      return;
    }
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


  function handleNewsletterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNewsletterMessage("Please enter a valid email address."); return;
    }
    setNewsletterMessage("Thanks for your interest! Newsletter subscriptions are not connected yet.");
    setEmail("");
  }

  const featuredProduct = products.find((p) => p.imageUrl && p.imageUrl !== DEFAULT_IMAGE) || products[0];

  const heroImageSrc = homepageSettings.hero.slides?.length
    ? homepageSettings.hero.slides[heroSlideIndex] || DEFAULT_IMAGE
    : homepageSettings.hero.desktopImage || featuredProduct?.imageUrl || DEFAULT_IMAGE;

  return (
    <main className="store gs-home">
      <StoreHeader
        isCategoryPage={false}
        storeName={storeSettings.storeName}
        logoUrl={storeSettings.logoUrl}
        phone={storeSettings.phone}
        announcementEnabled={homepageSettings.announcement.enabled ?? true}
        announcementText={homepageSettings.announcement.text ?? "Free delivery on orders over ৳3,000"}
        announcementLink={homepageSettings.announcement.link ?? "/products"}
        categories={availableCategories
          .filter((item) => item.name !== "All Products")
          .map((item) => {
            const mainCategory = storeCategories.find(
              (categoryItem) =>
                categoryItem.name.toLowerCase() === item.name.toLowerCase()
            );

            return {
              name: item.name,
              label: item.label,
              subcategories: storeSubcategories
                .filter(
                  (subitem) =>
                    subitem.isActive &&
                    mainCategory &&
                    subitem.parentCategoryId === mainCategory.id
                )
                .map((subitem) => ({
                  id: subitem.id,
                  name: subitem.name,
                })),
            };
          })}
        activeCategory={category}
        selectedSubcategoryId={selectedSubcategoryId}
        onSelectCategory={(name) => {
          setCategory(name);
          setSelectedSubcategoryId("");
        }}
        onSelectSubcategory={setSelectedSubcategoryId}
        search={search}
        onSearchChange={setSearch}
        searchSuggestions={searchSuggestions.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
        }))}
        onSearchSubmit={() => {
          document.getElementById("products")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
        onSearchSuggestionSelect={(product) => {
          setSearch(product.name);
          document.getElementById("products")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
        wishlistCount={wishlist.length}
        isCustomerLoggedIn={isCustomerLoggedIn}
        cartCount={cartCount}
      />

            <section className="gs-hero gs-container gs-hero-image-only" id="home">
<picture className="gs-hero-picture">
          <img
            key={(homepageSettings.hero.slides?.length ?? 0) > 0 ? heroSlideIndex : "default"}
            src={heroImageSrc}

            alt="Featured Gadget Collection"
            className="gs-hero-product-image"
            fetchPriority="high"
          />
        </picture>

        {(homepageSettings.hero.slides?.length ?? 0) > 1 && (
          <div className="gs-hero-dots" aria-label="Hero slideshow navigation">
            {(homepageSettings.hero.slides ?? []).map((slide, index) => (
              <button
                key={`${slide}-${index}`}
                type="button"
                className={`gs-hero-dot ${heroSlideIndex === index ? "active" : ""}`}
                onClick={() => setHeroSlideIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={heroSlideIndex === index ? "true" : undefined}
              />
            ))}
          </div>
        )}

      </section>

      <section className="gs-benefits gs-container" id="why-us">
        <div><span>🚚</span><p><strong>Delivery across Bangladesh</strong><small>Delivery options at checkout</small></p></div><div><span>🔒</span><p><strong>Shopping with confidence</strong><small>Simple and secure ordering</small></p></div><div><span>💬</span><p><strong>Customer support</strong><small>We are here to help</small></p></div><div><span>💳</span><p><strong>Cash on delivery</strong><small>Pay when your order arrives</small></p></div>
      </section>

      {homepageSettings.sections.categories && <section className="gs-home-section gs-container" id="categories">
        <div className="gs-section-title gs-category-heading"><div><h2>Categories</h2></div><div className="gs-category-arrows">{canScrollCategoryLeft && <button type="button" aria-label="Previous categories" onClick={() => scrollCategories("left")}><ChevronLeft size={20} /></button>}{canScrollCategoryRight && <button type="button" aria-label="Next categories" onClick={() => scrollCategories("right")}><ChevronRight size={20} /></button>}</div></div>
<div className="gs-category-grid" ref={categorySliderRef}>{availableCategories.filter((item) => item.name !== "All Products").map((item) => { const CategoryIcon = getCategoryIcon(item.name); const categorySlug = item.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); return <Link key={item.name} href={`/category/${categorySlug}`} className="gs-category-tile"><span className="gs-category-icon" aria-hidden="true">{item.imageUrl ? <img className="gs-category-image" src={item.imageUrl} alt={item.label} loading="lazy" /> : item.emoji ? <span className="gs-category-custom-icon">{item.emoji}</span> : <CategoryIcon size={34} strokeWidth={1.6} />}</span><strong>{item.label}</strong></Link>; })}</div>
      </section>}

      {saleProducts.length > 0 && <section className="gs-flash-section gs-container" id="flash-sale">
        <div className="gs-flash-heading"><div><span className="gs-eyebrow">LIMITED-TIME DEALS</span><h2>⚡ Flash Sale</h2><p>Special prices on selected products.</p></div><div className="gs-countdown"><small>Offer timer</small><div><b>{String(timeLeft.hours).padStart(2, "0")}</b><span>:</span><b>{String(timeLeft.minutes).padStart(2, "0")}</b><span>:</span><b>{String(timeLeft.seconds).padStart(2, "0")}</b></div><small>Demo countdown display</small></div></div>
        <div className="gs-flash-grid">{saleProducts.map((product) => { const discount = product.oldPrice > 0 ? Math.max(0, Math.round((1 - product.price / product.oldPrice) * 100)) : 0; return <article className="gs-flash-card" key={product.id}><div className="gs-flash-image" style={{ background: product.color }}><span>-{discount}%</span><Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}><Image src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} width={400} height={400} unoptimized loading="lazy" /></Link></div><div className="gs-flash-info"><small>{product.category}</small><h3><Link href={`/product/${product.id}`} className="gs-product-title-link">{product.name}</Link></h3><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.oldPrice)}</del><button onClick={() => addToCart(product.id)} disabled={product.stock <= 0}>{product.stock > 0 ? "Add to Cart +" : "Out of Stock"}</button></div></article>; })}</div>
      </section>}

      {homepageSettings.sections.featuredProducts && featuredProducts.length > 0 && (
        <section className="gs-home-section gs-container gs-curated-section" id="featured-products">
          <div className="gs-section-title">
            <div><span>HANDPICKED FOR YOU</span><h2>Featured products</h2><p>Our selected picks, chosen by the Gadget Store team.</p></div>
            <a href="#products">Explore all products →</a>
          </div>
          <div className="gs-curated-grid">
            {featuredProducts.map((product) => (
              <article className="gs-curated-card" key={product.id}>
                <Link href={`/product/${product.id}`} className="gs-curated-image" style={{ background: product.color }}>
                  <Image src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} width={360} height={300} unoptimized loading="lazy" />
                  <span>FEATURED</span>
                </Link>
                <div className="gs-curated-info">
                  <small>{product.category}</small>
                  <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
                  <strong>{formatPrice(product.price)}</strong>
                  <button onClick={() => addToCart(product.id)}>Add to Cart +</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {homepageSettings.freshShelf.enabled && homepageSettings.sections.freshShelf && (
        <section className="gs-fresh-shelf gs-container" style={homepageSettings.freshShelf.imageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(23,21,45,.94), rgba(23,21,45,.25)), url("${homepageSettings.freshShelf.imageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <div className="gs-fresh-copy"><span>{homepageSettings.freshShelf.eyebrow}</span><h2>{homepageSettings.freshShelf.title}</h2><p>{homepageSettings.freshShelf.description}</p><a href={homepageSettings.freshShelf.buttonLink || "/products"}>{homepageSettings.freshShelf.buttonText} →</a></div>
          <div className="gs-fresh-products" aria-hidden="true">{(newArrivalProducts.length ? newArrivalProducts : products.filter((product) => product.imageUrl).slice(0, 3)).slice(0, 3).map((product, index) => <div className={`gs-fresh-product gs-fresh-product-${index + 1}`} key={product.id}><Image src={product.imageUrl || DEFAULT_IMAGE} alt="" width={220} height={220} unoptimized /></div>)}</div>
        </section>
      )}

      {newArrivalProducts.length > 0 && (
        <section className="gs-home-section gs-container gs-curated-section" id="new-arrivals">
          <div className="gs-section-title">
            <div><span>JUST LANDED</span><h2>New arrivals</h2><p>Discover the latest additions to our collection.</p></div>
            <a href="#products">Shop collection →</a>
          </div>
          <div className="gs-curated-grid">
            {newArrivalProducts.map((product) => (
              <article className="gs-curated-card" key={product.id}>
                <Link href={`/product/${product.id}`} className="gs-curated-image" style={{ background: product.color }}>
                  <Image src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} width={360} height={300} unoptimized loading="lazy" />
                  <span>NEW</span>
                </Link>
                <div className="gs-curated-info">
                  <small>{product.category}</small>
                  <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
                  <strong>{formatPrice(product.price)}</strong>
                  <button onClick={() => addToCart(product.id)}>Add to Cart +</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {homepageSettings.sections.reviews && (
        <section className="gs-home-section gs-container gs-customer-reviews" id="customer-reviews">
          <div className="gs-section-title">
            <div><span>REAL CUSTOMER FEEDBACK</span><h2>What customers say</h2><p>Reviews shared by customers after their delivered orders.</p></div>
          </div>
          {customerReviews.length > 0 ? <div className="gs-review-grid">
            {customerReviews.map((review) => (
              <article className="gs-review-card" key={review.id}>
                <div className="gs-review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                <p>“{review.comment}”</p>
                <div className="gs-review-author"><span>{review.customerName.slice(0, 1).toUpperCase()}</span><div><strong>{review.customerName}</strong><small>{review.productName}</small></div></div>
              </article>
            ))}
          </div> : <div className="gs-reviews-empty"><span>★★★★★</span><strong>Customer reviews are coming soon</strong><p>We look forward to sharing feedback from our Gadget Store customers.</p></div>}
        </section>
      )}

      {homepageSettings.sections.allProducts && <section className="gs-home-section gs-products-section" id="products">
        <div className="gs-section-title gs-products-heading"><div><span>THE GADGET STORE COLLECTION</span><h2>Explore our products</h2><p>Compare prices, discover everyday essentials and find the right fit.</p></div><div className="gs-product-tabs">{availableCategories.map((item) => <button key={item.name} className={category === item.name ? "active" : ""} onClick={() => { setCategory(item.name); setSelectedSubcategoryId(""); }}>{item.label}</button>)}</div></div>
        {visibleSubcategories.length > 0 && (
          <div className="gs-product-tabs gs-subcategory-tabs" aria-label="Filter by subcategory">
            <button
              type="button"
              className={!selectedSubcategoryId ? "active" : ""}
              onClick={() => setSelectedSubcategoryId("")}
            >
              All {category}
            </button>
            {visibleSubcategories.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedSubcategoryId === item.id ? "active" : ""}
                onClick={() => setSelectedSubcategoryId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}

        <div className="gs-filter-toolbar">
          <label>
            Sort by
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}>
              <option value="featured">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="top-rated">Top Rated</option>
            </select>
          </label>
          <label>
            Brand
            <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
              <option value="All Brands">All Brands</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </label>
          <label className="gs-price-filter">
            Minimum price
            <input type="number" min="0" max={maxPrice} value={minPrice} onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="gs-price-filter">
            Maximum price: <strong>{formatPrice(maxPrice)}</strong>
            <input type="range" min="0" max={highestProductPrice} step="500" value={maxPrice} onChange={(e) => { const value = Number(e.target.value); setMaxPrice(value); setMinPrice((current) => Math.min(current, value)); }} />
          </label>
          <label>
            Minimum rating
            <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Any rating</option>
              <option value={3}>3+ stars</option>
              <option value={4}>4+ stars</option>
              <option value={4.5}>4.5+ stars</option>
            </select>
          </label>
          <label className="gs-stock-filter">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock only
          </label>
          <button className="gs-reset-filters" onClick={() => {
            setSortOption("featured");
            setSelectedBrand("All Brands");
            setMinPrice(0);
            setMaxPrice(highestProductPrice);
            setMinRating(0);
            setInStockOnly(false);
            setSearch("");
            setCategory("All Products");
            setSelectedSubcategoryId("");
          }}>Reset filters</button>
          <Link href="/wishlist" className="gs-wishlist-link">♡ Wishlist ({wishlist.length})</Link>
        </div>
        {!loadingProducts && !productError && <div className="gs-catalog-summary"><span>{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found</span><span>{category === "All Products" ? "All categories" : category}{selectedSubcategory ? ` · ${selectedSubcategory.name}` : ""}{selectedBrand !== "All Brands" ? ` · ${selectedBrand}` : ""}</span></div>}
        {search && <p className="gs-search-result">Showing results for <strong>“{search}”</strong></p>}
        {loadingProducts && <div className="gs-empty-state"><h3>Loading products...</h3><p>Please wait while we load our products.</p></div>}
        {!loadingProducts && productError && <div className="gs-empty-state"><h3>Unable to load products</h3><p>{productError}</p></div>}
        {!loadingProducts && !productError && filteredProducts.length > 0 && <div className="gs-product-grid">{filteredProducts.slice(0, homepageSettings.productDisplay.allProductsCount || 8).map((product) => { const discount = product.oldPrice > product.price && product.oldPrice > 0 ? Math.round((1 - product.price / product.oldPrice) * 100) : 0; return <article className="gs-product-card" key={product.id}><div className="gs-product-visual" style={{ background: product.color }}><span className="gs-product-badge">{product.badge}</span>{discount > 0 && <span className="gs-discount-badge">-{discount}%</span>}<Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}><Image src={product.imageUrl || DEFAULT_IMAGE} alt={product.name} width={400} height={400} unoptimized loading="lazy" /></Link><button className="gs-quick-add" onClick={() => addToCart(product.id)} aria-label={`Add ${product.name} to cart`} disabled={product.stock <= 0} title={product.stock <= 0 ? "Out of stock" : "Add to cart"}><Plus size={18} strokeWidth={2} aria-hidden="true" /></button>
<button className={`gs-wishlist-button ${wishlist.includes(product.id) ? "is-active" : ""}`} onClick={() => toggleWishlist(product.id)} aria-label="Toggle wishlist"><Heart size={19} strokeWidth={1.8} fill={wishlist.includes(product.id) ? "currentColor" : "none"} aria-hidden="true" /></button>
<button className="gs-quick-view-button" onClick={() => setQuickViewProduct(product)}><Eye size={15} aria-hidden="true" /> Quick View</button>
</div><div className="gs-product-details"><span className="gs-product-category">{product.category}</span><h3><Link href={`/product/${product.id}`} className="gs-product-title-link">{product.name}</Link></h3><div className="gs-product-rating">{(product.rating || 0) > 0 ? <><span>★</span> {Number(product.rating).toFixed(1)}<small> ({product.reviewCount || 0} review{product.reviewCount === 1 ? "" : "s"})</small></> : <small>No reviews yet</small>}</div><div className="gs-product-price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice > product.price && <del>{formatPrice(product.oldPrice)}</del>}</div><button className="gs-add-cart" onClick={() => addToCart(product.id)} disabled={product.stock <= 0}>{product.stock > 0 ? <>Add to Cart <span>+</span></> : "Out of Stock"}</button></div></article>; })}</div>}
        {!loadingProducts && !productError && filteredProducts.length === 0 && <div className="gs-empty-state"><Search size={28} aria-hidden="true" /><h3>No matching products</h3><p>Try changing your search or filters. Your full product collection is still available.</p><button onClick={() => { setSearch(""); setCategory("All Products"); setSelectedBrand("All Brands"); setMaxPrice(highestProductPrice); setSortOption("featured"); }}>Clear all filters</button></div>}
      </section>}

      {recentlyViewedProducts.length > 0 && (
        <section className="gs-home-section gs-container gs-recently-viewed">
          <div className="gs-section-title">
            <div>
              <span>YOUR BROWSING HISTORY</span>
              <h2>Recently viewed</h2>
              <p>Pick up where you left off.</p>
            </div>
            <button
              className="gs-recent-clear"
              onClick={() => {
                localStorage.removeItem("gadget-store-recently-viewed");
                setRecentlyViewedIds([]);
              }}
            >
              Clear history
            </button>
          </div>

          <div className="gs-recent-grid">
            {recentlyViewedProducts.map((product) => (
              <article className="gs-recent-card" key={product.id}>
                <Link
                  href={`/product/${product.id}`}
                  className="gs-recent-image"
                  style={{ background: product.color }}
                >
                  <Image
                    src={product.imageUrl || DEFAULT_IMAGE}
                    alt={product.name}
                    width={300}
                    height={300}
                    unoptimized
                    loading="lazy"
                  />
                </Link>

                <div className="gs-recent-info">
                  <span>{product.category}</span>
                  <h3>
                    <Link href={`/product/${product.id}`}>
                      {product.name}
                    </Link>
                  </h3>
                  <strong>{formatPrice(product.price)}</strong>
                  {product.oldPrice > product.price && (
                    <del>{formatPrice(product.oldPrice)}</del>
                  )}
                  <button onClick={() => addToCart(product.id)}>
                    Add to Cart +
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}



      <section className="gs-offer-banner gs-container"><div className="gs-offer-copy"><span>MORE REASONS TO SHOP</span><h2>Enjoy free delivery<br />on orders over ৳3,000.</h2><p>Fill your cart with everyday favourites and save on delivery.</p><a href="#products">Start shopping →</a></div><div className="gs-offer-art"><div className="gs-offer-circle">৳<strong>0</strong><small>DELIVERY FEE</small></div><span className="gs-offer-spark">✦</span></div></section>

      <section className="gs-brands-section gs-container" id="brands"><div className="gs-section-title"><div><span>OUR PRODUCT RANGE</span><h2>Explore popular brands</h2><p>Browse brands available in our product collection.</p></div></div>{brands.length > 0 ? <div className="gs-brand-list">{brands.map((brand) => <button key={brand} onClick={() => { setSearch(brand); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}>{brand}</button>)}</div> : <div className="gs-brand-empty">Brand names will appear here when they are added to product details.</div>}</section>

      <section className="gs-why-section gs-container"><div className="gs-why-intro"><span>THE GADGET STORE DIFFERENCE</span><h2>Tech shopping,<br />made refreshingly simple.</h2><p>Discover useful products, place your order with ease and get support when you need it.</p><a href="#products">Explore the collection →</a></div><div className="gs-why-grid"><article><span>01</span><b>Curated collection</b><p>Explore practical gadgets and accessories for everyday use.</p></article><article><span>02</span><b>Easy ordering</b><p>A simple shopping experience from product selection to checkout.</p></article><article><span>03</span><b>Cash on delivery</b><p>Pay for your order when it arrives at your doorstep.</p></article><article><span>04</span><b>Helpful support</b><p>Reach out to our team whenever you need assistance.</p></article></div></section>

      {homepageSettings.sections.newsletter && <section className="gs-newsletter gs-container"><div><span>STAY IN THE LOOP</span><h2>Get updates from our store.</h2><p>Be the first to hear about new arrivals and special offers.</p></div><form onSubmit={handleNewsletterSubmit}><label className="gs-sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" required /><button type="submit">Subscribe →</button>{newsletterMessage && <small role="status">{newsletterMessage}</small>}</form></section>}

      <section className="gs-home-cta gs-container"><div><span>WELCOME TO {storeSettings.storeName.toUpperCase()}</span><h2>Your next favourite gadget is waiting.</h2><p>Explore our collection and find something made for you.</p></div><a href="#products">Explore Products →</a><div className="gs-cta-orb">{storeSettings.storeName.charAt(0).toUpperCase()}</div></section>

      <footer className="gs-store-footer"><div className="gs-container gs-footer-main"><div className="gs-footer-about"><Link href="/" className="gs-store-brand"><StoreLogo logoUrl={storeSettings.logoUrl} storeName={storeSettings.storeName} /><span><strong>{storeSettings.storeName.toUpperCase()}</strong><small>TECH FOR EVERYDAY</small></span></Link><p>Your everyday destination for gadgets and tech accessories.</p></div><div className="gs-footer-column">
  <h3>Quick links</h3>
  <a href="#home">Home</a>
  <a href="#categories">Categories</a>
  <a href="#products">Shop all</a>
  <Link href="/track-order">Track Order</Link>
  <Link href="/cart">My cart</Link>
</div><div className="gs-footer-column"><h3>Customer care</h3>{storeSettings.phone ? <a href={`tel:${storeSettings.phone}`}>Phone: {storeSettings.phone}</a> : <span>Customer support</span>}{storeSettings.whatsapp && <a href={`https://wa.me/${storeSettings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp support</a>}{storeSettings.address && <p>{storeSettings.address}</p>}</div><div className="gs-footer-column"><h3>Shopping information</h3><span>Delivery across Bangladesh</span><span>Cash on delivery</span><span>Free delivery over ৳3,000</span></div></div><div className="gs-container gs-footer-bottom"><span>© {new Date().getFullYear()} {storeSettings.storeName}. All rights reserved.</span><span>Made for tech lovers in Bangladesh 🇧🇩</span></div></footer>

      {quickViewProduct && (
        <div className="gs-quick-view-overlay" onClick={() => setQuickViewProduct(null)}>
          <section className="gs-quick-view-modal" role="dialog" aria-modal="true" aria-label="Product quick view" onClick={(e) => e.stopPropagation()}>
            <button className="gs-quick-view-close" onClick={() => setQuickViewProduct(null)} aria-label="Close">×</button>
            <div className="gs-quick-view-image" style={{ background: quickViewProduct.color }}>
              <Image src={quickViewProduct.imageUrl || DEFAULT_IMAGE} alt={quickViewProduct.name} width={500} height={500} unoptimized />
            </div>
            <div className="gs-quick-view-info">
              <span>{quickViewProduct.category}</span>
              <h2>{quickViewProduct.name}</h2>
              {quickViewProduct.brand && <p>Brand: {quickViewProduct.brand}</p>}
              <strong>{formatPrice(quickViewProduct.price)}</strong>
              {quickViewProduct.oldPrice > quickViewProduct.price && <del>{formatPrice(quickViewProduct.oldPrice)}</del>}
              <p>{quickViewProduct.description || "Discover this product from our collection."}</p>
              <div className="gs-quick-view-actions">
                <button onClick={() => { addToCart(quickViewProduct.id); setQuickViewProduct(null); }}>Add to Cart</button>
                <Link href={`/product/${quickViewProduct.id}`}>View Details →</Link>
              </div>
            </div>
          </section>
        </div>
      )}
      {notice && <div className="gs-home-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
    </main>
  );
}

