"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import "./orders/admin.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/orders/login") {
    return <>{children}</>;
  }

  return (
    <main className="gs-admin">
      <AdminSidebar />
      <section className="gs-admin-main">
        {children}
      </section>
    </main>
  );
}
