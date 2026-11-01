"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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

type Product = {
id: string;
name: string;
category: string;
price: number;
oldPrice: number;
description: string;
imageUrl: string;
stock: number;
};

type Category = {
id: string;
name: string;
};

export default function ProductsPage() {
const [authorized, setAuthorized] = useState(false);
const [loading, setLoading] = useState(true);
const [products, setProducts] = useState<Product[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [saving, setSaving] = useState(false);

const [name, setName] = useState("");
const [category, setCategory] = useState("");
const [price, setPrice] = useState("");
const [oldPrice, setOldPrice] = useState("");
const [stock, setStock] = useState("10");
const [description, setDescription] = useState("");
const [image, setImage] = useState<File | null>(null);
const [editingId, setEditingId] = useState<string | null>(null);

// Admin authentication
useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, async (user) => {
if (!user || user.uid !== ADMIN_UID) {
window.location.replace("/admin/orders/login");
return;
}
  setAuthorized(true);

  try {
    await Promise.all([loadProducts(), loadCategories()]);
  } finally {
    setLoading(false);
  }
});

return () => unsubscribe();

}, []);

// Load products from Firebase
async function loadProducts() {
try {
const snapshot = await getDocs(collection(db, "products"));

  const items: Product[] = snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      name: String(data.name || ""),
      category: String(data.category || ""),
      price: Number(data.price || 0),
      oldPrice: Number(data.oldPrice || 0),
      description: String(data.description || ""),
      imageUrl: String(data.imageUrl || ""),
      stock: Math.max(0, Math.floor(Number(data.stock ?? 0))),
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name));
  setProducts(items);
} catch (error) {
  console.error("Products loading error:", error);
  alert("Unable to load products. Please try again.");
}

}

// Load categories from Firebase
async function loadCategories() {
try {
const snapshot = await getDocs(collection(db, "categories"));

  const items: Category[] = snapshot.docs
    .map((item) => {
      const data = item.data();

      return {
        id: item.id,
        name: String(data.name || ""),
      };
    })
    .filter((item) => item.name.trim() !== "");

  items.sort((a, b) => a.name.localeCompare(b.name));

  setCategories(items);

  if (items.length > 0) {
    setCategory((current) =>
      items.some((item) => item.name === current)
        ? current
        : items[0].name
    );
  } else {
    setCategory("");
  }
} catch (error) {
  console.error("Categories loading error:", error);
  alert("Unable to load categories. Please try again.");
}

}

// Reset form
function resetForm() {
setName("");
setCategory(categories[0]?.name || "");
setPrice("");
setOldPrice("");
setStock("10");
setDescription("");
setImage(null);
setEditingId(null);

const input = document.getElementById(
  "product-image"
) as HTMLInputElement | null;

if (input) input.value = "";

}

// Upload image to Cloudinary
async function uploadImage(file: File) {
const user = auth.currentUser;

if (!user) {
  throw new Error("Please log in again.");
}

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

if (!allowedTypes.includes(file.type)) {
  throw new Error(
    "Invalid image format. Please use JPG, PNG, WEBP, or AVIF."
  );
}

if (file.size > 5 * 1024 * 1024) {
  throw new Error("Image size must be less than 5 MB.");
}

const token = await user.getIdToken();

const formData = new FormData();
formData.append("image", file);

const response = await fetch("/api/admin/upload", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();

if (!response.ok) {
  throw new Error(result.error || "Image upload failed.");
}

if (!result.imageUrl) {
  throw new Error("Image upload did not return a valid image URL.");
}

return result.imageUrl as string;

}

// Add or update product
async function handleSubmit(e: FormEvent<HTMLFormElement>) {
e.preventDefault();

if (!name.trim() || !price.trim()) {
  alert("Please enter the product name and price.");
  return;
}

const numericPrice = Number(price);
const numericOldPrice = Number(oldPrice) || 0;

if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
  alert("Please enter a valid selling price greater than zero.");
  return;
}

if (
  oldPrice.trim() &&
  (!Number.isFinite(numericOldPrice) ||
    numericOldPrice < numericPrice)
) {
  alert("Old price must be greater than or equal to the selling price.");
  return;
}

const numericStock = Number(stock);

if (!Number.isInteger(numericStock) || numericStock < 0 || numericStock > 1000000) {
  alert("Please enter a valid stock quantity between 0 and 1000000.");
  return;
}

if (!category) {
  alert("Please create a category first.");
  return;
}

if (!editingId && !image) {
  alert("Please select a product image.");
  return;
}

setSaving(true);

try {
  let imageUrl = "";

  if (image) {
    imageUrl = await uploadImage(image);
  }

  const productData: Record<string, unknown> = {
    name: name.trim(),
    category,
    price: numericPrice,
    oldPrice: numericOldPrice,
    stock: numericStock,
    description: description.trim(),
    updatedAt: serverTimestamp(),
  };

  if (imageUrl) {
    productData.imageUrl = imageUrl;
  }

  if (editingId) {
    await updateDoc(doc(db, "products", editingId), productData);

    alert("Product updated successfully!");
  } else {
    await addDoc(collection(db, "products"), {
      ...productData,
      imageUrl,
      createdAt: serverTimestamp(),
    });

    alert("New product added successfully!");
  }

  resetForm();
  await loadProducts();
} catch (error) {
  console.error("Product saving error:", error);

  alert(
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again."
  );
} finally {
  setSaving(false);
}

}

// Edit product
function handleEdit(product: Product) {
setEditingId(product.id);
setName(product.name);
setCategory(product.category);
setPrice(String(product.price));
setOldPrice(String(product.oldPrice || ""));
setStock(String(product.stock ?? 0));
setDescription(product.description || "");
setImage(null);


const input = document.getElementById(
  "product-image"
) as HTMLInputElement | null;

if (input) input.value = "";

window.scrollTo({ top: 0, behavior: "smooth" });


}

// Delete product
async function handleDelete(id: string) {
const confirmed = window.confirm(
"Are you sure you want to delete this product?"
);


if (!confirmed) return;

try {
  await deleteDoc(doc(db, "products", id));
  await loadProducts();

  if (editingId === id) {
    resetForm();
  }

  alert("Product deleted successfully!");
} catch (error) {
  console.error("Product deletion error:", error);
  alert("Unable to delete product. Please try again.");
}


}

if (loading || !authorized) {
return ( <div style={styles.center}> <div style={styles.loadingCard}> <div style={styles.spinner} /> <h2>Product Management</h2> <p>Verifying access and loading products...</p> </div> </div>
);
}

return ( <main style={styles.page}> <div style={styles.container}> <header style={styles.header}> <div> <span style={styles.eyebrow}>STORE MANAGEMENT</span> <h1 style={styles.title}>Product Management</h1> <p style={styles.subtitle}>
Add, edit and manage your store products. </p> </div>


      <a href="/admin/orders" style={styles.backButton}>
        ← Admin Dashboard
      </a>
    </header>

    {/* Product Form */}
    <section style={styles.formCard}>
      <div style={styles.formHeading}>
        <div>
          <span style={styles.eyebrow}>
            {editingId ? "UPDATE INVENTORY" : "NEW INVENTORY"}
          </span>

          <h2 style={styles.sectionTitle}>
            {editingId ? "Edit Product" : "Add New Product"}
          </h2>
        </div>

        {editingId && (
          <span style={styles.editingBadge}>Editing Product</span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <label style={styles.label} htmlFor="product-name">
          Product Name
        </label>

        <input
          id="product-name"
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter product name"
          maxLength={120}
          required
          disabled={saving}
        />

        <label style={styles.label} htmlFor="product-category">
          Category
        </label>

        <select
          id="product-category"
          style={styles.input}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          disabled={categories.length === 0 || saving}
        >
          {categories.length === 0 ? (
            <option value="">
              Create a category from the Categories page first.
            </option>
          ) : (
            categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))
          )}
        </select>

        <div style={styles.row}>
          <div style={styles.column}>
            <label style={styles.label} htmlFor="product-price">
              Selling Price (৳)
            </label>

            <input
              id="product-price"
              style={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2490"
              required
              disabled={saving}
            />
          </div>

          <div style={styles.column}>
            <label style={styles.label} htmlFor="product-old-price">
              Old Price (৳)
            </label>

            <input
              id="product-old-price"
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)}
              placeholder="3290"
              disabled={saving}
            />
          </div>
        </div>

        <label style={styles.label} htmlFor="product-stock">
          Stock Quantity
        </label>

        <input
          id="product-stock"
          style={styles.input}
          type="number"
          min="0"
          max="1000000"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="10"
          required
          disabled={saving}
        />

        <label style={styles.label} htmlFor="product-description">
          Product Description
        </label>

        <textarea
          id="product-description"
          style={{ ...styles.input, minHeight: 110, resize: "vertical" }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Write product details, features and specifications..."
          maxLength={2000}
          disabled={saving}
        />

        <label style={styles.label} htmlFor="product-image">
          Product Image
        </label>

        <input
          id="product-image"
          style={styles.input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) =>
            setImage(e.target.files?.[0] || null)
          }
          disabled={saving}
        />

        <p style={styles.hint}>
          Supported formats: JPG, PNG, WEBP, or AVIF. Maximum size: 5 MB.
          {editingId && " Leave empty to keep the current image."}
        </p>

        <div style={styles.buttonRow}>
          <button
            type="submit"
            disabled={saving || categories.length === 0}
            style={{
              ...styles.saveButton,
              opacity:
                saving || categories.length === 0 ? 0.6 : 1,
            }}
          >
            {saving
              ? "Please wait..."
              : editingId
                ? "Update Product"
                : "Add Product"}
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

    {/* Product List */}
    <section style={styles.listSection}>
      <div style={styles.listHeader}>
        <div>
          <span style={styles.eyebrow}>YOUR INVENTORY</span>
          <h2 style={styles.sectionTitle}>All Products</h2>
        </div>

        <span style={styles.count}>
          {products.length} Products
        </span>
      </div>

      {products.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📦</div>
          <h3>No Products Yet</h3>
          <p>Add your first product to get started.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {products.map((product) => (
            <article key={product.id} style={styles.productCard}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={styles.productImage}
                />
              ) : (
                <div style={styles.noImage}>No Image Available</div>
              )}

              <div style={styles.productInfo}>
                <span style={styles.category}>
                  {product.category}
                </span>

                <h3 style={styles.productName}>
                  {product.name}
                </h3>

                <div style={styles.priceRow}>
                  <strong>৳{product.price.toLocaleString("en-BD")}</strong>

                  {product.oldPrice > 0 && (
                    <del>
                      ৳{product.oldPrice.toLocaleString("en-BD")}
                    </del>
                  )}
                </div>

                                <div style={{
                  marginTop: "12px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: product.stock === 0 ? "#feecec" : product.stock <= 5 ? "#fff4e5" : "#ecfdf3",
                  color: product.stock === 0 ? "#d92d20" : product.stock <= 5 ? "#b54708" : "#027a48",
                  fontSize: "13px",
                  fontWeight: 800,
                }}>
                  {product.stock === 0
                    ? "Out of Stock"
                    : product.stock <= 5
                      ? "Low Stock: " + product.stock + " available"
                      : "Available Stock: " + product.stock}
                </div>
<p style={styles.description}>
                  {product.description || "No description available."}
                </p>

                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    onClick={() => handleEdit(product)}
                    style={styles.editButton}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    style={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    <footer style={styles.footer}>
      © {new Date().getFullYear()} Gadget Store. All rights reserved.
    </footer>
  </div>
</main>


);
}

const styles: Record<string, React.CSSProperties> = {
page: {
minHeight: "100vh",
background: "#f4f6fa",
padding: "35px 16px",
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
background: "#f4f6fa",
padding: "20px",
textAlign: "center",
},

loadingCard: {
background: "#ffffff",
padding: "35px",
borderRadius: "16px",
boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
},

spinner: {
width: "35px",
height: "35px",
border: "4px solid #e2e8f0",
borderTopColor: "#155eef",
borderRadius: "50%",
margin: "0 auto 18px",
animation: "spin 1s linear infinite",
},

header: {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: "15px",
flexWrap: "wrap",
marginBottom: "30px",
},

eyebrow: {
display: "block",
color: "#155eef",
fontSize: "11px",
fontWeight: 800,
letterSpacing: "1.5px",
marginBottom: "8px",
},

title: {
fontSize: "30px",
fontWeight: 800,
margin: 0,
letterSpacing: "-0.8px",
},

subtitle: {
color: "#687386",
marginTop: "8px",
fontSize: "14px",
},

backButton: {
background: "#172033",
color: "white",
padding: "12px 18px",
borderRadius: "9px",
textDecoration: "none",
fontSize: "14px",
fontWeight: 700,
},

formCard: {
background: "white",
padding: "28px",
borderRadius: "16px",
border: "1px solid #e9edf4",
boxShadow: "0 5px 25px rgba(0,0,0,0.04)",
marginBottom: "40px",
},

formHeading: {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
flexWrap: "wrap",
gap: "10px",
marginBottom: "20px",
},

sectionTitle: {
fontSize: "22px",
fontWeight: 800,
margin: 0,
color: "#172033",
},

editingBadge: {
background: "#fff4e5",
color: "#b54708",
padding: "7px 12px",
borderRadius: "20px",
fontSize: "12px",
fontWeight: 700,
},

label: {
display: "block",
fontWeight: 700,
fontSize: "13px",
marginBottom: "8px",
marginTop: "17px",
},

input: {
width: "100%",
padding: "13px",
border: "1px solid #dce1e9",
borderRadius: "9px",
fontSize: "14px",
boxSizing: "border-box",
background: "white",
color: "#172033",
outlineColor: "#155eef",
},

row: {
display: "flex",
gap: "16px",
flexWrap: "wrap",
},

column: {
flex: "1 1 220px",
},

hint: {
color: "#778196",
fontSize: "12px",
lineHeight: 1.6,
marginTop: "8px",
},

buttonRow: {
display: "flex",
gap: "10px",
marginTop: "18px",
flexWrap: "wrap",
},

saveButton: {
background: "#155eef",
color: "white",
border: "none",
padding: "13px 24px",
borderRadius: "9px",
cursor: "pointer",
fontWeight: 750,
fontSize: "14px",
},

cancelButton: {
background: "#e8edf5",
color: "#172033",
border: "none",
padding: "13px 22px",
borderRadius: "9px",
cursor: "pointer",
fontWeight: 700,
},

listSection: {
marginTop: "35px",
},

listHeader: {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: "12px",
marginBottom: "22px",
},

count: {
background: "#e4edff",
color: "#155eef",
padding: "8px 14px",
borderRadius: "20px",
fontWeight: 800,
fontSize: "13px",
},

empty: {
background: "white",
padding: "55px 20px",
textAlign: "center",
borderRadius: "14px",
color: "#687386",
border: "1px solid #e9edf4",
},

emptyIcon: {
fontSize: "42px",
marginBottom: "12px",
},

grid: {
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
gap: "20px",
},

productCard: {
background: "white",
borderRadius: "14px",
overflow: "hidden",
border: "1px solid #e9edf4",
boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
minWidth: 0,
},

productImage: {
width: "100%",
height: "200px",
objectFit: "contain",
background: "#f7f8fa",
padding: "15px",
boxSizing: "border-box",
},

noImage: {
height: "200px",
display: "grid",
placeItems: "center",
background: "#f1f3f6",
color: "#8992a3",
fontSize: "13px",
},

productInfo: {
padding: "18px",
},

category: {
display: "inline-block",
fontSize: "11px",
color: "#155eef",
fontWeight: 800,
textTransform: "uppercase",
letterSpacing: "0.6px",
},

productName: {
fontSize: "17px",
fontWeight: 750,
margin: "9px 0",
lineHeight: 1.4,
minHeight: "45px",
},

priceRow: {
display: "flex",
gap: "12px",
alignItems: "center",
fontSize: "17px",
flexWrap: "wrap",
},

description: {
color: "#687386",
fontSize: "13px",
lineHeight: 1.6,
minHeight: "42px",
marginTop: "12px",
overflowWrap: "anywhere",
},

editButton: {
flex: 1,
background: "#e5efff",
color: "#155eef",
border: "none",
padding: "11px",
borderRadius: "8px",
cursor: "pointer",
fontWeight: 750,
},

deleteButton: {
flex: 1,
background: "#feecec",
color: "#d92d20",
border: "none",
padding: "11px",
borderRadius: "8px",
cursor: "pointer",
fontWeight: 750,
},

footer: {
textAlign: "center",
color: "#8992a3",
fontSize: "12px",
padding: "35px 0 10px",
},
};
