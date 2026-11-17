"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Heart,
  UserRound,
  ShoppingBag,
  Menu,
} from "lucide-react";

type HeaderSubcategory = {
  id: string;
  name: string;
};

type HeaderCategory = {
  id?: string;
  name: string;
  label: string;
  subcategories: HeaderSubcategory[];
};

type HeaderProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
};

type StoreHeaderProps = {
  isCategoryPage: boolean;

  storeName: string;
  logoUrl: string;
  phone: string;

  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;

  categories: HeaderCategory[];
  activeCategory: string;
  selectedSubcategoryId: string;

  onSelectCategory: (name: string) => void;
  onSelectSubcategory: (id: string) => void;

  search: string;
  onSearchChange: (value: string) => void;
  searchSuggestions: HeaderProduct[];
  onSearchSubmit: () => void;
  onSearchSuggestionSelect: (product: HeaderProduct) => void;

  wishlistCount: number;
  isCustomerLoggedIn: boolean;
  cartCount: number;
};

function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPrice(value: number) {
  return `৳${value.toLocaleString("en-BD")}`;
}

export default function StoreHeader({
  isCategoryPage,
  storeName,
  logoUrl,
  phone,
  announcementEnabled,
  announcementText,
  announcementLink,
  categories,
  activeCategory,
  selectedSubcategoryId,
  onSelectCategory,
  onSelectSubcategory,
  search,
  onSearchChange,
  searchSuggestions,
  onSearchSubmit,
  onSearchSuggestionSelect,
  wishlistCount,
  isCustomerLoggedIn,
  cartCount,
}: StoreHeaderProps) {
  const [expandedCategory, setExpandedCategory] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sectionLink = (section: string) =>
    isCategoryPage ? `/#${section}` : `#${section}`;

  return (
    <div className="gs-header-sticky">
      {announcementEnabled && (
        <div className="gs-announcement gs-topbar">
          <div className="gs-container gs-announcement-inner">
            <div className="gs-top-links">
              <Link href={announcementLink || "/products"}>
                {announcementText || "Free delivery on orders over ৳3,000"}
              </Link>
            </div>

            <div className="gs-top-contact">
              <span>
                {phone ? `☎ ${phone}` : "Nationwide delivery across Bangladesh"}
              </span>
              <span>🇧🇩 Bangladesh</span>
            </div>
          </div>
        </div>
      )}

      <header className="gs-header-shell">
        <div className="gs-store-header gs-container">
          <details className="gs-explore-menu">
            <summary aria-label="Open menu" title="Menu">
              <Menu size={22} strokeWidth={1.9} aria-hidden="true" />
            </summary>

            <div className="gs-mega-panel">
              <div className="gs-mega-categories">
                {categories.map((item) => (
                  <div className="gs-mega-category-group" key={item.name}>
                    <button
                      type="button"
                      className={activeCategory === item.name ? "active" : ""}
                      onClick={() => {
                        if (isCategoryPage) {
                          if (activeCategory !== item.name) {
                            window.location.href = `/category/${slugify(item.name)}`;
                            return;
                          }
                        }

                        onSelectCategory(item.name);

                        setExpandedCategory((current) =>
                          current === item.name ? "" : item.name
                        );
                      }}
                      aria-expanded={expandedCategory === item.name}
                    >
                      <span className="gs-mega-category-label">
                        {item.label}
                      </span>

                      <i className="gs-mega-chevron" aria-hidden="true">
                        {expandedCategory === item.name ? "⌄" : "›"}
                      </i>
                    </button>

                    {expandedCategory === item.name &&
                      item.subcategories.length > 0 && (
                        <div className="gs-mega-subcategories">
                          {item.subcategories.map((subitem) => (
                            <button
                              type="button"
                              key={subitem.id}
                              className={
                                selectedSubcategoryId === subitem.id
                                  ? "active"
                                  : ""
                              }
                              onClick={() => {
                                onSelectSubcategory(subitem.id);

                                if (isCategoryPage) {
                                  window.dispatchEvent(
                                    new CustomEvent("gs-category-subcategory", {
                                      detail: subitem.id,
                                    })
                                  );
                                } else {
                                  document
                                    .getElementById("products")
                                    ?.scrollIntoView({ behavior: "smooth" });
                                }

                                document
                                  .querySelector(".gs-explore-menu")
                                  ?.removeAttribute("open");

                                setExpandedCategory("");
                              }}
                            >
                              {subitem.name}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </details>

          <Link
            href="/"
            className="gs-store-brand"
            aria-label="Go to homepage"
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={storeName}
                width={46}
                height={46}
                unoptimized
                className="gs-store-logo"
              />
            ) : (
              <span className="gs-store-logo">✦</span>
            )}

            <span>
              <strong>{storeName.toUpperCase()}</strong>
              <small>TECH FOR EVERYDAY</small>
            </span>
          </Link>

          <div className="gs-header-links">
            <Link href={sectionLink("brands")}>Brands</Link>
            <Link href={sectionLink("featured-products")}>
              Online Exclusive
            </Link>
            <Link
              href={sectionLink("flash-sale")}
              className="gs-header-offer"
            >
              Offers
            </Link>
            <Link href={sectionLink("products")}>Shop All</Link>
          </div>

          <form
            className="gs-store-search"
            onSubmit={(event) => {
              event.preventDefault();
              setShowSuggestions(false);
              onSearchSubmit();
            }}
          >
            <Search size={19} strokeWidth={1.8} aria-hidden="true" />

            <div className="gs-search-field">
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() =>
                  window.setTimeout(() => setShowSuggestions(false), 120)
                }
                placeholder="Search phones, laptops, audio, gadgets..."
                aria-label="Search products"
                aria-autocomplete="list"
                aria-expanded={
                  showSuggestions && searchSuggestions.length > 0
                }
              />

              {showSuggestions && searchSuggestions.length > 0 && (
                <div
                  className="gs-search-suggestions"
                  role="listbox"
                  aria-label="Product suggestions"
                >
                  {searchSuggestions.map((product) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={product.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onSearchSuggestionSelect(product);
                        setShowSuggestions(false);
                      }}
                    >
                      <span>{product.name}</span>
                      <small>
                        {product.category} · {formatPrice(product.price)}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="submit">
              <Search size={16} aria-hidden="true" />
              Search
            </button>
          </form>

          <div className="gs-header-actions">
            <Link
              href="/wishlist"
              className="gs-header-icon"
              aria-label="Wishlist"
            >
              <Heart size={20} strokeWidth={1.8} aria-hidden="true" />
              <small>Wishlist</small>
              <b>{wishlistCount}</b>
            </Link>

            <Link
              href={isCustomerLoggedIn ? "/account" : "/account/login"}
              className="gs-header-icon"
              aria-label="My account"
            >
              <UserRound size={20} strokeWidth={1.8} aria-hidden="true" />
              <small>Account</small>
            </Link>

            <Link
              href="/cart"
              className="gs-header-icon gs-cart-link"
              aria-label="Shopping cart"
            >
              <ShoppingBag size={20} strokeWidth={1.8} aria-hidden="true" />
              <small>Cart</small>
              <b>{cartCount}</b>
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
