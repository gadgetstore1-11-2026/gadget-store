"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => pathname === path;

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/admin/orders/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const links = [
    { href: "/admin/orders#dashboard", icon: "▦", label: "Dashboard", path: "/admin/orders" },
    { href: "/admin/orders#orders", icon: "▤", label: "Orders", path: "/admin/orders" },
    { href: "/admin/products", icon: "▣", label: "Products", path: "/admin/products" },
    { href: "/admin/inventory", icon: "▦", label: "Inventory", path: "/admin/inventory" },
    { href: "/admin/categories", icon: "▦", label: "Categories", path: "/admin/categories" },
    { href: "/admin/customers", icon: "👥", label: "Customers", path: "/admin/customers" },
    { href: "/admin/reviews", icon: "★", label: "Reviews", path: "/admin/reviews" },
    { href: "/admin/settings", icon: "⚙", label: "Settings", path: "/admin/settings" },
  ];

  return (
    <aside className="gs-sidebar">
      <Link href="/" className="gs-sidebar-brand">
        <span className="gs-brand-icon">G</span>
        <span>
          <strong>GADGET STORE</strong>
          <small>ADMIN PANEL</small>
        </span>
      </Link>

      <div className="gs-sidebar-section">
        <span className="gs-sidebar-heading">MENU</span>

        {links.map((link, index) => (
          <Link
            key={`${link.label}-${index}`}
            href={link.href}
            className={`gs-sidebar-link ${
              isActive(link.path) &&
              (link.label === "Dashboard" || link.label === "Orders")
                ? "active"
                : isActive(link.path) && link.label !== "Dashboard" && link.label !== "Orders"
                  ? "active"
                  : ""
            }`}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}

        <Link href="/" className="gs-sidebar-link">
          <span>▣</span>
          View Store
        </Link>
      </div>

      <div className="gs-sidebar-bottom">
        <div className="gs-sidebar-help">
          <span>💜</span>
          <strong>Need assistance?</strong>
          <p>Manage your store from one place.</p>
        </div>

        <button
          type="button"
          className="gs-sidebar-logout"
          onClick={handleLogout}
        >
          <span>↪</span> Logout
        </button>
      </div>
    </aside>
  );
}
