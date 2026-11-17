"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/admin/orders/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const links = [
    { href: "/admin/dashboard", path: "/admin/dashboard", icon: "▦", label: "Dashboard" },
    { href: "/admin/orders", path: "/admin/orders", icon: "▤", label: "Orders" },
    { href: "/admin/payments", path: "/admin/payments", icon: "৳", label: "Payments" },
    { href: "/admin/products", path: "/admin/products", icon: "▣", label: "Products" },
    { href: "/admin/inventory", path: "/admin/inventory", icon: "▦", label: "Inventory" },
    { href: "/admin/categories", path: "/admin/categories", icon: "▦", label: "Categories" },
    { href: "/admin/customers", path: "/admin/customers", icon: "👥", label: "Customers" },
    { href: "/admin/reviews", path: "/admin/reviews", icon: "★", label: "Reviews" },
    { href: "/admin/homepage", path: "/admin/homepage", icon: "▣", label: "Homepage" },
    { href: "/admin/settings", path: "/admin/settings", icon: "⚙", label: "Settings" },
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

        {links.map((link) => {
          const active = pathname === link.path;

          return (
            <Link
              key={link.label}
              href={link.href}
              className={`gs-sidebar-link ${active ? "active" : ""}`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}

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
