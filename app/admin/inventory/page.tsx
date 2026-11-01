"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string;
};

type FilterType = "All" | "Low Stock" | "Out of Stock" | "In Stock";

export default function InventoryPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("All");
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.uid !== ADMIN_UID) {
        router.replace("/admin/orders/login");
        return;
      }

      const unsubscribeProducts = onSnapshot(
        collection(db, "products"),
        (snapshot) => {
          const list = snapshot.docs.map((item) => {
            const data = item.data();

            return {
              id: item.id,
              name: data.name || "Unnamed Product",
              category: data.category || "Uncategorized",
              price: Number(data.price || 0),
              stock: Math.max(0, Math.floor(Number(data.stock ?? 0))),
              imageUrl: data.imageUrl || "",
            };
          });

          list.sort((a, b) => a.name.localeCompare(b.name));
          setProducts(list);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          setMessage("Unable to load inventory.");
          setLoading(false);
        }
      );

      return () => unsubscribeProducts();
    });

    return () => unsubscribeAuth();
  }, [router]);

  const stats = useMemo(() => {
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStock = products.filter(
      (p) => p.stock > 0 && p.stock <= 5
    ).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const stockValue = products.reduce(
      (sum, p) => sum + p.price * p.stock,
      0
    );

    return {
      totalProducts: products.length,
      totalUnits,
      lowStock,
      outOfStock,
      stockValue,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase());

      let matchesFilter = true;

      if (filter === "Low Stock") {
        matchesFilter = product.stock > 0 && product.stock <= 5;
      } else if (filter === "Out of Stock") {
        matchesFilter = product.stock === 0;
      } else if (filter === "In Stock") {
        matchesFilter = product.stock > 5;
      }

      return matchesSearch && matchesFilter;
    });
  }, [products, search, filter]);

  async function saveStock(productId: string) {
    const value = stockInputs[productId];

    if (value === undefined || value.trim() === "") {
      setMessage("Please enter a stock quantity.");
      return;
    }

    const quantity = Number(value);

    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 1000000
    ) {
      setMessage("Enter a valid stock quantity between 0 and 1,000,000.");
      return;
    }

    const user = auth.currentUser;

    if (!user || user.uid !== ADMIN_UID) {
      setMessage("You are not authorized to update inventory.");
      return;
    }

    setSaving(productId);
    setMessage("");

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", productId);
        const productSnapshot = await transaction.get(productRef);

        if (!productSnapshot.exists()) {
          throw new Error("Product not found.");
        }

        transaction.update(productRef, {
          stock: quantity,
          updatedAt: serverTimestamp(),
        });
      });

      setMessage("Stock updated successfully.");
      setStockInputs((previous) => {
        const updated = { ...previous };
        delete updated[productId];
        return updated;
      });
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Failed to update stock."
      );
    } finally {
      setSaving(null);
    }
  }

  const money = (amount: number) =>
    `৳${amount.toLocaleString("en-BD")}`;

  if (loading) {
    return (
      <main style={styles.loading}>
        <p>Loading inventory...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>STORE MANAGEMENT</p>
            <h1 style={styles.title}>Inventory Dashboard</h1>
            <p style={styles.subtitle}>
              Monitor product stock and manage inventory.
            </p>
          </div>

          <div style={styles.headerButtons}>
            <a href="/admin/products" style={styles.secondaryButton}>
              Manage Products
            </a>
            <a href="/admin/orders" style={styles.secondaryButton}>
              Orders
            </a>
          </div>
        </header>

        {message && (
          <div style={styles.message} role="status">
            {message}
          </div>
        )}

        <section style={styles.statsGrid}>
          <StatCard
            label="Total Products"
            value={stats.totalProducts.toLocaleString()}
            detail="Products in store"
          />
          <StatCard
            label="Total Stock Units"
            value={stats.totalUnits.toLocaleString()}
            detail="Available inventory"
          />
          <StatCard
            label="Low Stock"
            value={stats.lowStock.toLocaleString()}
            detail="1 to 5 units remaining"
            warning
          />
          <StatCard
            label="Out of Stock"
            value={stats.outOfStock.toLocaleString()}
            detail="Products needing restock"
            danger
          />
        </section>

        <section style={styles.valueCard}>
          <div>
            <p style={styles.valueLabel}>Estimated Stock Value</p>
            <h2 style={styles.valueAmount}>{money(stats.stockValue)}</h2>
            <p style={styles.valueHint}>
              Based on current selling prices and stock quantities.
            </p>
          </div>
          <div style={styles.valueIcon}>৳</div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Product Inventory</h2>
              <p style={styles.panelSubtitle}>
                Search products, check stock and update quantities.
              </p>
            </div>
            <span style={styles.productCount}>
              {filteredProducts.length} Products
            </span>
          </div>

          <div style={styles.toolbar}>
            <input
              style={styles.search}
              type="search"
              placeholder="Search by product name or category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              style={styles.select}
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as FilterType)
              }
            >
              <option>All</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
              <option>In Stock</option>
            </select>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Product</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Current Stock</th>
                  <th style={styles.th}>Stock Status</th>
                  <th style={styles.th}>Update Stock</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const status =
                    product.stock === 0
                      ? "Out of Stock"
                      : product.stock <= 5
                        ? "Low Stock"
                        : "In Stock";

                  return (
                    <tr key={product.id}>
                      <td style={styles.td}>
                        <div style={styles.productCell}>
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              style={styles.productImage}
                            />
                          ) : (
                            <div style={styles.imagePlaceholder}>📦</div>
                          )}
                          <strong>{product.name}</strong>
                        </div>
                      </td>

                      <td style={styles.td}>{product.category}</td>
                      <td style={styles.td}>{money(product.price)}</td>
                      <td style={styles.td}>
                        <strong>{product.stock}</strong>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(status === "Out of Stock"
                              ? styles.dangerBadge
                              : status === "Low Stock"
                                ? styles.warningBadge
                                : styles.successBadge),
                          }}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.updateCell}>
                          <input
                            type="number"
                            min="0"
                            max="1000000"
                            step="1"
                            aria-label={`New stock for ${product.name}`}
                            placeholder={String(product.stock)}
                            value={stockInputs[product.id] ?? ""}
                            onChange={(event) =>
                              setStockInputs((previous) => ({
                                ...previous,
                                [product.id]: event.target.value,
                              }))
                            }
                            style={styles.stockInput}
                          />
                          <button
                            style={{
                              ...styles.saveButton,
                              opacity: saving === product.id ? 0.6 : 1,
                            }}
                            disabled={saving === product.id}
                            onClick={() => saveStock(product.id)}
                          >
                            {saving === product.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={styles.empty}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={styles.footer}>
          Inventory updates are synchronized with your product database.
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  warning,
  danger,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <article style={styles.statCard}>
      <div
        style={{
          ...styles.statDot,
          background: danger ? "#dc2626" : warning ? "#d97706" : "#2563eb",
        }}
      />
      <p style={styles.statLabel}>{label}</p>
      <h2 style={styles.statValue}>{value}</h2>
      <p style={styles.statDetail}>{detail}</p>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "36px 20px",
    color: "#172033",
  },
  container: {
    maxWidth: 1450,
    margin: "0 auto",
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 28,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
    margin: "0 0 8px",
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    margin: "8px 0 0",
  },
  headerButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    textDecoration: "none",
    background: "#fff",
    border: "1px solid #dbe2ec",
    padding: "11px 16px",
    borderRadius: 9,
    color: "#263449",
    fontWeight: 700,
    fontSize: 13,
  },
  message: {
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    fontWeight: 600,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e7ebf2",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 3px 12px rgba(15,23,42,.03)",
  },
  statDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    marginBottom: 14,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
  },
  statValue: {
    fontSize: 30,
    margin: "8px 0",
    fontWeight: 800,
  },
  statDetail: {
    color: "#94a3b8",
    fontSize: 12,
    margin: 0,
  },
  valueCard: {
    background: "#172554",
    color: "#fff",
    borderRadius: 15,
    padding: "23px 26px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  valueLabel: {
    color: "#bfdbfe",
    margin: 0,
    fontSize: 13,
  },
  valueAmount: {
    fontSize: 30,
    margin: "8px 0",
  },
  valueHint: {
    color: "#cbd5e1",
    fontSize: 12,
    margin: 0,
  },
  valueIcon: {
    fontSize: 42,
    fontWeight: 800,
    color: "#93c5fd",
    padding: 10,
  },
  panel: {
    background: "#fff",
    border: "1px solid #e7ebf2",
    borderRadius: 15,
    overflow: "hidden",
  },
  panelHeader: {
    padding: "22px 22px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  panelTitle: {
    margin: 0,
    fontSize: 19,
  },
  panelSubtitle: {
    color: "#64748b",
    fontSize: 12,
    margin: "6px 0 0",
  },
  productCount: {
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 11px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  toolbar: {
    display: "flex",
    gap: 12,
    padding: "0 22px 18px",
    flexWrap: "wrap",
  },
  search: {
    flex: "1 1 260px",
    minWidth: 0,
    border: "1px solid #dbe2ec",
    borderRadius: 9,
    padding: "12px 14px",
    fontSize: 13,
  },
  select: {
    border: "1px solid #dbe2ec",
    borderRadius: 9,
    padding: "12px 14px",
    background: "#fff",
    minWidth: 150,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 900,
  },
  th: {
    background: "#f8fafc",
    color: "#64748b",
    textAlign: "left",
    padding: "13px 16px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    borderTop: "1px solid #edf0f5",
    borderBottom: "1px solid #edf0f5",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #edf0f5",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  productCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 190,
  },
  productImage: {
    width: 42,
    height: 42,
    objectFit: "cover",
    borderRadius: 8,
    background: "#f1f5f9",
  },
  imagePlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
  },
  badge: {
    display: "inline-block",
    borderRadius: 20,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 700,
  },
  successBadge: {
    background: "#dcfce7",
    color: "#15803d",
  },
  warningBadge: {
    background: "#fef3c7",
    color: "#b45309",
  },
  dangerBadge: {
    background: "#fee2e2",
    color: "#b91c1c",
  },
  updateCell: {
    display: "flex",
    gap: 7,
    alignItems: "center",
  },
  stockInput: {
    width: 75,
    padding: "8px",
    border: "1px solid #dbe2ec",
    borderRadius: 7,
  },
  saveButton: {
    border: 0,
    background: "#2563eb",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 7,
    fontWeight: 700,
    cursor: "pointer",
  },
  empty: {
    textAlign: "center",
    padding: 35,
    color: "#64748b",
  },
  footer: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    padding: 22,
  },
};