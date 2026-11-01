"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type Category = {
  id: string;
  name: string;
  createdAt?: unknown;
};

type Product = {
  id: string;
  category: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Admin authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== ADMIN_UID) {
        window.location.replace("/admin/orders/login");
        return;
      }

      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load categories and products
  async function loadData() {
    try {
      const [categorySnapshot, productSnapshot] = await Promise.all([
        getDocs(collection(db, "categories")),
        getDocs(collection(db, "products")),
      ]);

      const categoryItems: Category[] = categorySnapshot.docs.map(
        (item) => {
          const data = item.data();

          return {
            id: item.id,
            name: String(data.name || ""),
            createdAt: data.createdAt,
          };
        }
      );

      const productItems: Product[] = productSnapshot.docs.map(
        (item) => {
          const data = item.data();

          return {
            id: item.id,
            category: String(data.category || ""),
          };
        }
      );

      categoryItems.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setCategories(categoryItems);
      setProducts(productItems);
    } catch (error) {
      console.error("Data loading error:", error);
      setMessage("Unable to load data. Please try again.");
    }
  }

  // Count products in a category
  function getProductCount(categoryName: string) {
    return products.filter(
      (product) =>
        product.category.toLowerCase() === categoryName.toLowerCase()
    ).length;
  }

  // Reset form
  function resetForm() {
    setName("");
    setEditingId(null);
  }

  // Add or update category
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const categoryName = name.trim();

    if (!categoryName) {
      setMessage("Please enter a category name.");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.name.toLowerCase() === categoryName.toLowerCase() &&
        category.id !== editingId
    );

    if (duplicate) {
      setMessage("This category already exists.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), {
          name: categoryName,
          updatedAt: serverTimestamp(),
        });

        setMessage("Category updated successfully!");
      } else {
        await addDoc(collection(db, "categories"), {
          name: categoryName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setMessage("New category added successfully!");
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error("Category saving error:", error);
      setMessage("Unable to save category. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Edit category
  function handleEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Delete category
  async function handleDelete(category: Category) {
    const productCount = getProductCount(category.name);

    if (productCount > 0) {
      const confirmed = window.confirm(
        `"${category.name}" contains ${productCount} product(s). Deleting this category will not delete those products, but they will no longer have a matching category. Do you want to continue?`
      );

      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `Are you sure you want to delete the "${category.name}" category?`
      );

      if (!confirmed) return;
    }

    setDeletingId(category.id);
    setMessage("");

    try {
      await deleteDoc(doc(db, "categories", category.id));

      if (editingId === category.id) {
        resetForm();
      }

      setMessage("Category deleted successfully!");
      await loadData();
    } catch (error) {
      console.error("Category deletion error:", error);
      setMessage("Unable to delete category. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // Search categories
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProducts = products.length;

  const uncategorizedCount = products.filter(
    (product) =>
      !categories.some(
        (category) =>
          category.name.toLowerCase() ===
          product.category.toLowerCase()
      )
  ).length;

  if (loading) {
    return (
      <div style={styles.center}>
        Loading Categories...
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              GADGET STORE / ADMIN
            </div>

            <h1 style={styles.title}>
              Categories
            </h1>

            <p style={styles.subtitle}>
              Organize and manage your store categories.
            </p>
          </div>

          <Link href="/admin/orders" style={styles.backButton}>
            ← Dashboard
          </Link>
        </header>

        {/* Statistics */}
        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>▦</div>

            <p style={styles.statLabel}>Total Categories</p>

            <h2 style={styles.statNumber}>
              {categories.length}
            </h2>

            <span style={styles.statHint}>
              Active store categories
            </span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>▣</div>

            <p style={styles.statLabel}>Total Products</p>

            <h2 style={styles.statNumber}>
              {totalProducts}
            </h2>

            <span style={styles.statHint}>
              Products in your store
            </span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>✦</div>

            <p style={styles.statLabel}>Uncategorized</p>

            <h2 style={styles.statNumber}>
              {uncategorizedCount}
            </h2>

            <span style={styles.statHint}>
              Products without a matching category
            </span>
          </div>
        </section>

        {/* Message */}
        {message && (
          <div style={styles.message} role="status">
            <span>{message}</span>

            <button
              type="button"
              onClick={() => setMessage("")}
              style={styles.closeButton}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {/* Add Category Form */}
        <section style={styles.formCard}>
          <div style={styles.formHeading}>
            <div>
              <span style={styles.formIcon}>＋</span>
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                {editingId ? "Edit Category" : "Add New Category"}
              </h2>

              <p style={styles.formSubtitle}>
                {editingId
                  ? "Update your category information."
                  : "Create a new category for your products."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={styles.label} htmlFor="category-name">
              Category Name
            </label>

            <div style={styles.formRow}>
              <input
                id="category-name"
                style={styles.input}
                type="text"
                placeholder="Example: Audio, Smart Watch, Accessories"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
                disabled={saving}
              />

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...styles.saveButton,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? "Please wait..."
                  : editingId
                    ? "Update Category"
                    : "+ Add Category"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Category List */}
        <section style={styles.listSection}>
          <div style={styles.listHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                All Categories
              </h2>

              <p style={styles.formSubtitle}>
                Manage all your product categories.
              </p>
            </div>

            <span style={styles.count}>
              {categories.length} Categories
            </span>
          </div>

          {/* Search */}
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              style={styles.searchInput}
              type="search"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Cards */}
          {filteredCategories.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>▦</div>

              <h3>
                {search
                  ? "No matching categories found"
                  : "No categories found"}
              </h3>

              <p>
                {search
                  ? "Try another category name."
                  : "Add your first category to get started."}
              </p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredCategories.map((category, index) => {
                const productCount = getProductCount(category.name);

                return (
                  <article
                    key={category.id}
                    style={styles.categoryCard}
                  >
                    <div style={styles.cardTop}>
                      <div style={styles.categoryIcon}>
                        {category.name.charAt(0).toUpperCase()}
                      </div>

                      <span style={styles.categoryNumber}>
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <h3 style={styles.categoryName}>
                      {category.name}
                    </h3>

                    <div style={styles.productCount}>
                      <span>▣</span>

                      <strong>{productCount}</strong>

                      <span>
                        {productCount === 1 ? "Product" : "Products"}
                      </span>
                    </div>

                    <div style={styles.cardDivider} />

                    <div style={styles.cardButtons}>
                      <button
                        type="button"
                        onClick={() => handleEdit(category)}
                        style={styles.editButton}
                      >
                        ✎ Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
                        disabled={deletingId === category.id}
                        style={{
                          ...styles.deleteButton,
                          opacity: deletingId === category.id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === category.id
                          ? "Deleting..."
                          : "✕ Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          Gadget Store Admin Panel
          <span> • </span>
          Category Management
        </footer>

      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f6fb",
    padding: "35px 20px",
    color: "#172033",
  },

  container: {
    maxWidth: "1150px",
    margin: "0 auto",
  },

  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "30px",
  },

  breadcrumb: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "2px",
    color: "#858ca3",
    marginBottom: "12px",
  },

  title: {
    fontSize: "32px",
    fontWeight: 850,
    margin: 0,
    color: "#171b35",
  },

  subtitle: {
    color: "#858ba0",
    marginTop: "8px",
    fontSize: "14px",
  },

  backButton: {
    background: "#24213f",
    color: "white",
    padding: "13px 20px",
    borderRadius: "11px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "13px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "18px",
    marginBottom: "25px",
  },

  statCard: {
    background: "white",
    borderRadius: "17px",
    padding: "22px",
    border: "1px solid #eceef5",
    boxShadow: "0 5px 20px rgba(25,30,70,0.035)",
  },

  statIcon: {
    width: "43px",
    height: "43px",
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    background: "#eeebff",
    color: "#6353eb",
    fontSize: "23px",
    fontWeight: 800,
  },

  statLabel: {
    color: "#858ba0",
    fontSize: "13px",
    fontWeight: 650,
    marginTop: "15px",
    marginBottom: "5px",
  },

  statNumber: {
    fontSize: "32px",
    fontWeight: 850,
    margin: "0",
    color: "#20223f",
  },

  statHint: {
    fontSize: "11px",
    color: "#a0a5b5",
  },

  message: {
    background: "#eaf2ff",
    color: "#155eef",
    padding: "15px 18px",
    borderRadius: "11px",
    marginBottom: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    fontWeight: 650,
  },

  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: "23px",
    cursor: "pointer",
    color: "#155eef",
  },

  formCard: {
    background: "white",
    padding: "25px",
    borderRadius: "17px",
    border: "1px solid #eceef5",
    boxShadow: "0 5px 20px rgba(25,30,70,0.035)",
    marginBottom: "30px",
  },

  formHeading: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "23px",
  },

  formIcon: {
    width: "45px",
    height: "45px",
    display: "grid",
    placeItems: "center",
    background: "#eeebff",
    color: "#6353eb",
    borderRadius: "12px",
    fontSize: "25px",
    fontWeight: 700,
  },

  sectionTitle: {
    fontSize: "20px",
    fontWeight: 800,
    margin: 0,
    color: "#20223f",
  },

  formSubtitle: {
    color: "#9399aa",
    fontSize: "12px",
    marginTop: "6px",
  },

  label: {
    display: "block",
    fontWeight: 700,
    fontSize: "13px",
    marginBottom: "9px",
    color: "#515770",
  },

  formRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  input: {
    flex: "1 1 260px",
    minWidth: "0",
    padding: "14px",
    border: "1px solid #e1e4ed",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    color: "#20223f",
  },

  saveButton: {
    background: "#6252eb",
    color: "white",
    border: "none",
    padding: "13px 22px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 750,
    fontSize: "13px",
  },

  cancelButton: {
    background: "#edf0f6",
    color: "#515770",
    border: "none",
    padding: "13px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
  },

  listSection: {
    background: "white",
    padding: "25px",
    borderRadius: "17px",
    border: "1px solid #eceef5",
    boxShadow: "0 5px 20px rgba(25,30,70,0.035)",
  },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },

  count: {
    background: "#eeebff",
    color: "#6252eb",
    padding: "9px 15px",
    borderRadius: "25px",
    fontWeight: 750,
    fontSize: "12px",
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f8f9fc",
    border: "1px solid #e8eaf1",
    borderRadius: "11px",
    padding: "0 14px",
    marginTop: "22px",
    marginBottom: "22px",
  },

  searchIcon: {
    fontSize: "25px",
    color: "#858ba0",
  },

  searchInput: {
    width: "100%",
    padding: "13px 0",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "14px",
    color: "#20223f",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "17px",
  },

  categoryCard: {
    background: "#fff",
    border: "1px solid #eceef5",
    borderRadius: "15px",
    padding: "19px",
    transition: "box-shadow 0.2s ease",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  categoryIcon: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
    background: "#eeebff",
    color: "#6252eb",
    borderRadius: "13px",
    fontSize: "21px",
    fontWeight: 850,
  },

  categoryNumber: {
    color: "#a2a6b6",
    fontSize: "12px",
    fontWeight: 750,
  },

  categoryName: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#242642",
    marginTop: "18px",
    marginBottom: "12px",
    overflowWrap: "anywhere",
  },

  productCount: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "12px",
    color: "#858ba0",
  },

  cardDivider: {
    height: "1px",
    background: "#edf0f5",
    margin: "17px 0",
  },

  cardButtons: {
    display: "flex",
    gap: "9px",
  },

  editButton: {
    flex: 1,
    background: "#eeebff",
    color: "#6252eb",
    border: "none",
    padding: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 750,
    fontSize: "12px",
  },

  deleteButton: {
    flex: 1,
    background: "#fff0f0",
    color: "#d92d45",
    border: "none",
    padding: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 750,
    fontSize: "12px",
  },

  empty: {
    padding: "55px 15px",
    textAlign: "center",
    color: "#858ba0",
    background: "#fafbfe",
    borderRadius: "13px",
  },

  emptyIcon: {
    fontSize: "40px",
    color: "#6252eb",
  },

  footer: {
    textAlign: "center",
    padding: "25px 10px",
    color: "#a0a5b5",
    fontSize: "12px",
  },
};