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
  description?: string;
  imageUrl?: string;
  heroBannerImageUrl?: string;
  heroBannerImages?: string[];
  heroBannerInterval?: number;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: unknown;
};

type Product = {
  id: string;
  category: string;
};

type Subcategory = {
  id: string;
  name: string;
  parentCategoryId: string;
  sortOrder: number;
  isActive: boolean;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [subcategoryName, setSubcategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [subcategorySortOrder, setSubcategorySortOrder] = useState("0");
  const [subcategoryIsActive, setSubcategoryIsActive] = useState(true);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [heroBannerImageUrl, setHeroBannerImageUrl] = useState("");
  const [selectedHeroBannerImage, setSelectedHeroBannerImage] = useState<File | null>(null);
  const [heroBannerPreview, setHeroBannerPreview] = useState("");
  const [heroBannerImages, setHeroBannerImages] = useState<string[]>([]);
  const [selectedHeroBannerImages, setSelectedHeroBannerImages] = useState<File[]>([]);
  const [selectedHeroBannerPreviews, setSelectedHeroBannerPreviews] = useState<string[]>([]);
  const [heroBannerInterval, setHeroBannerInterval] = useState(5);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingCategoryStatusId, setUpdatingCategoryStatusId] = useState<string | null>(null);
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
      const [categorySnapshot, productSnapshot, subcategorySnapshot] = await Promise.all([
        getDocs(collection(db, "categories")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "subcategories")),
      ]);

      const categoryItems: Category[] = categorySnapshot.docs.map(
        (item) => {
          const data = item.data();

          return {
            id: item.id,
            name: String(data.name || ""),
            description: String(data.description || ""),
            imageUrl: String(data.imageUrl || ""),
            heroBannerImageUrl: String(data.heroBannerImageUrl || ""),
            heroBannerImages: Array.isArray(data.heroBannerImages)
              ? data.heroBannerImages.filter((url: unknown) => typeof url === "string")
              : data.heroBannerImageUrl
                ? [String(data.heroBannerImageUrl)]
                : [],
            heroBannerInterval: Math.min(10, Math.max(3, Number(data.heroBannerInterval) || 5)),
            icon: String(data.icon || ""),
            sortOrder: Number(data.sortOrder || 0),
            isActive: data.isActive !== false,
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

      const subcategoryItems: Subcategory[] = subcategorySnapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          name: String(data.name || ""),
          parentCategoryId: String(data.parentCategoryId || ""),
          sortOrder: Number(data.sortOrder || 0),
          isActive: data.isActive !== false,
        };
      });

      categoryItems.sort((a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name)
      );

      subcategoryItems.sort((a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      );

      setCategories(categoryItems);
      setProducts(productItems);
      setSubcategories(subcategoryItems);

      if (!parentCategoryId && categoryItems.length > 0) {
        setParentCategoryId(categoryItems[0].id);
      }
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
    setDescription("");
    setIcon("");
    setSortOrder("0");
    setIsActive(true);
    setImageUrl("");
    setSelectedImage(null);
    setImagePreview("");
    setHeroBannerImageUrl("");
    setSelectedHeroBannerImage(null);
    setHeroBannerPreview("");
    setHeroBannerImages([]);
    selectedHeroBannerPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setSelectedHeroBannerImages([]);
    setSelectedHeroBannerPreviews([]);
    setHeroBannerInterval(5);
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

    if (heroBannerImages.length + selectedHeroBannerImages.length > 10) {
      setMessage("You can upload a maximum of 10 hero banner images.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let categoryImageUrl = imageUrl;

      if (selectedImage) {
        const user = auth.currentUser;

        if (!user) {
          throw new Error("Please log in again.");
        }

        setUploadingImage(true);

        const token = await user.getIdToken();
        const formData = new FormData();

        formData.append("image", selectedImage);
        formData.append("folder", "categories");

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

        categoryImageUrl = result.imageUrl;
      }

      const categoryHeroBannerImages = [...heroBannerImages];

      if (selectedHeroBannerImages.length > 0) {
        const user = auth.currentUser;

        if (!user) {
          throw new Error("Please log in again.");
        }

        setUploadingImage(true);

        const token = await user.getIdToken();

        for (const imageFile of selectedHeroBannerImages) {
          const formData = new FormData();

          formData.append("image", imageFile);
          formData.append("folder", "categories");

          const response = await fetch("/api/admin/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Hero banner upload failed.");
          }

          categoryHeroBannerImages.push(result.imageUrl);
        }
      }

      if (categoryHeroBannerImages.length > 10) {
        throw new Error("You can upload a maximum of 10 hero banner images.");
      }

      const categoryHeroBannerImageUrl = categoryHeroBannerImages[0] || "";
      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), {
          name: categoryName,
          description: description.trim(),
          icon: icon.trim(),
          sortOrder: Math.max(0, Number(sortOrder) || 0),
          isActive,
          imageUrl: categoryImageUrl,
          heroBannerImageUrl: categoryHeroBannerImageUrl,
          heroBannerImages: categoryHeroBannerImages,
          heroBannerInterval,
          updatedAt: serverTimestamp(),
        });

        setMessage("Category updated successfully!");
      } else {
        await addDoc(collection(db, "categories"), {
          name: categoryName,
          description: description.trim(),
          icon: icon.trim(),
          sortOrder: Math.max(0, Number(sortOrder) || 0),
          isActive,
          imageUrl: categoryImageUrl,
          heroBannerImageUrl: categoryHeroBannerImageUrl,
          heroBannerImages: categoryHeroBannerImages,
          heroBannerInterval,
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
      setUploadingImage(false);
    }
  }


// Toggle category Active/Inactive status
async function handleCategoryStatusToggle(category: Category) {
  if (updatingCategoryStatusId === category.id) return;

  const nextStatus = category.isActive === false;

  setUpdatingCategoryStatusId(category.id);
  setMessage("");

  try {
    await updateDoc(doc(db, "categories", category.id), {
      isActive: nextStatus,
      updatedAt: serverTimestamp(),
    });

    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, isActive: nextStatus }
          : item
      )
    );

    setMessage(
      `${category.name} is now ${nextStatus ? "Active" : "Inactive"}.`
    );
  } catch (error) {
    console.error("Category status update error:", error);
    setMessage("Unable to update category status. Please try again.");
  } finally {
    setUpdatingCategoryStatusId(null);
  }
}
// Edit category
  function handleEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || "");
    setIcon(category.icon || "");
    setSortOrder(String(category.sortOrder ?? 0));
    setIsActive(category.isActive !== false);
    setImageUrl(category.imageUrl || "");
    setSelectedImage(null);
    setImagePreview(category.imageUrl || "");
    const bannerImages = Array.isArray(category.heroBannerImages)
      ? category.heroBannerImages.filter(
          (url): url is string => typeof url === "string"
        )
      : category.heroBannerImageUrl
        ? [category.heroBannerImageUrl]
        : [];

    setHeroBannerImages(bannerImages);
    selectedHeroBannerPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setSelectedHeroBannerImages([]);
    setSelectedHeroBannerPreviews([]);
    setHeroBannerInterval(
      Math.min(10, Math.max(3, Number(category.heroBannerInterval) || 5))
    );

    setHeroBannerImageUrl(bannerImages[0] || "");
    setSelectedHeroBannerImage(null);
    setHeroBannerPreview(bannerImages[0] || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Delete category
  async function handleDelete(category: Category) {
    const childCount = subcategories.filter(
      (item) => item.parentCategoryId === category.id
    ).length;

    if (childCount > 0) {
      setMessage(
        `Delete or move the ${childCount} subcategory(s) under "${category.name}" before deleting this category.`
      );
      return;
    }

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

  // Reset subcategory form
  function resetSubcategoryForm() {
    setSubcategoryName("");
    setSubcategorySortOrder("0");
    setSubcategoryIsActive(true);
    setEditingSubcategoryId(null);
  }

  // Add or update subcategory
  async function handleSubcategorySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = subcategoryName.trim();

    if (!parentCategoryId || !cleanName) {
      setMessage("Please select a category and enter a subcategory name.");
      return;
    }

    const duplicate = subcategories.some(
      (item) =>
        item.parentCategoryId === parentCategoryId &&
        item.name.toLowerCase() === cleanName.toLowerCase() &&
        item.id !== editingSubcategoryId
    );

    if (duplicate) {
      setMessage("This subcategory already exists under the selected category.");
      return;
    }

    if (heroBannerImages.length + selectedHeroBannerImages.length > 10) {
      setMessage("You can upload a maximum of 10 hero banner images.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const selectedCategory = categories.find(
        (item) => item.id === parentCategoryId
      );

      if (!selectedCategory) {
        throw new Error("Please select a valid category.");
      }

      const data = {
        name: cleanName,
        parentCategoryId,
        parentCategoryName: selectedCategory.name,
        sortOrder: Math.max(0, Number(subcategorySortOrder) || 0),
        isActive: subcategoryIsActive,
        updatedAt: serverTimestamp(),
      };

      if (editingSubcategoryId) {
        await updateDoc(
          doc(db, "subcategories", editingSubcategoryId),
          data
        );
        setMessage("Subcategory updated successfully!");
      } else {
        await addDoc(collection(db, "subcategories"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        setMessage("Subcategory added successfully!");
      }

      resetSubcategoryForm();
      await loadData();
    } catch (error) {
      console.error("Subcategory saving error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save subcategory."
      );
    } finally {
      setSaving(false);
    }
  }

  // Edit subcategory
  function handleSubcategoryEdit(item: Subcategory) {
    setEditingSubcategoryId(item.id);
    setSubcategoryName(item.name);
    setParentCategoryId(item.parentCategoryId);
    setSubcategorySortOrder(String(item.sortOrder));
    setSubcategoryIsActive(item.isActive);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Delete subcategory
  async function handleSubcategoryDelete(item: Subcategory) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.name}"? Existing products will not be deleted.`
    );

    if (!confirmed) return;

    setDeletingSubcategoryId(item.id);
    setMessage("");

    try {
      await deleteDoc(doc(db, "subcategories", item.id));

      if (editingSubcategoryId === item.id) {
        resetSubcategoryForm();
      }

      setMessage("Subcategory deleted successfully!");
      await loadData();
    } catch (error) {
      console.error("Subcategory deletion error:", error);
      setMessage("Unable to delete subcategory. Please try again.");
    } finally {
      setDeletingSubcategoryId(null);
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
    <main className="gs-category-admin" style={styles.page}>
      <style id="gs-category-admin-styles">{`
.gs-category-admin {
  background: #f5f6f8 !important;
  color: #182230 !important;
  min-height: 100vh;
  padding: 36px 32px !important;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}
.gs-category-admin > div {
  max-width: 1440px !important;
}
.gs-category-admin header {
  padding: 8px 0 26px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 28px !important;
}
.gs-category-admin header h1 {
  font-size: clamp(28px, 3vw, 36px) !important;
  font-weight: 760 !important;
  letter-spacing: -1.1px !important;
}
.gs-category-admin header p {
  font-size: 14px !important;
}
.gs-category-admin header a {
  border-radius: 10px !important;
  padding: 12px 18px !important;
  font-weight: 650 !important;
  transition: all .2s ease;
}
.gs-category-admin header a:hover {
  border-color: #245bdb !important;
  color: #245bdb !important;
  transform: translateY(-1px);
}
.gs-category-admin section {
  border-radius: 16px !important;
  border: 1px solid #e7eaf0 !important;
  box-shadow: 0 3px 14px rgba(16,24,40,.035) !important;
}
.gs-category-admin section:first-of-type {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}
.gs-category-admin section:first-of-type > div {
  border-radius: 15px !important;
  border: 1px solid #e7eaf0 !important;
  box-shadow: 0 3px 12px rgba(16,24,40,.03) !important;
  padding: 22px !important;
  min-height: 150px;
}
.gs-category-admin section:first-of-type > div > div:first-child {
  width: 42px !important;
  height: 42px !important;
  border-radius: 12px !important;
}
.gs-category-admin section:first-of-type h2 {
  font-size: 30px !important;
  letter-spacing: -1px !important;
}
.gs-category-admin section:not(:first-of-type) {
  padding: 30px !important;
  margin-bottom: 24px !important;
}
.gs-category-admin h2 {
  color: #172033 !important;
  letter-spacing: -.4px;
}
.gs-category-admin label {
  color: #344054 !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  margin-bottom: 9px !important;
}
.gs-category-admin input:not([type="file"]),
.gs-category-admin select,
.gs-category-admin textarea {
  border: 1px solid #d9dee7 !important;
  border-radius: 10px !important;
  background: #fff !important;
  min-height: 45px;
  padding: 12px 14px !important;
  font-size: 13px !important;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.gs-category-admin textarea {
  min-height: 100px !important;
}
.gs-category-admin input:focus,
.gs-category-admin select:focus,
.gs-category-admin textarea:focus {
  outline: none !important;
  border-color: #245bdb !important;
  box-shadow: 0 0 0 3px rgba(36,91,219,.10) !important;
}
.gs-category-admin input[type="file"] {
  border: 1px dashed #cbd3df !important;
  border-radius: 11px !important;
  background: #f9fafb !important;
  padding: 13px !important;
  font-size: 12px !important;
  width: 100%;
}
.gs-category-admin button {
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}
.gs-category-admin button:hover:not(:disabled) {
  transform: translateY(-1px);
}
.gs-category-admin button:disabled {
  cursor: not-allowed !important;
}
.gs-category-admin button[type="submit"] {
  min-height: 44px;
  padding: 12px 22px !important;
  border-radius: 10px !important;
  font-weight: 700 !important;
}
.gs-category-admin button[type="submit"]:hover:not(:disabled) {
  box-shadow: 0 5px 14px rgba(36,91,219,.2) !important;
}
.gs-category-admin details {
  border: 1px solid #e1e6ee !important;
  border-radius: 12px !important;
  background: #f8fafc !important;
}
.gs-category-admin details summary {
  padding: 17px 19px !important;
  font-size: 13px !important;
}
.gs-category-admin details[open] summary {
  border-bottom: 1px solid #e5e7eb;
}
.gs-category-admin details > div {
  padding: 22px !important;
}
.gs-category-admin section:nth-of-type(3) {
  background: #fff !important;
}
.gs-category-admin section:nth-of-type(3) > div:first-child {
  align-items: center;
}
.gs-category-admin section:nth-of-type(3) input[type="search"] {
  min-height: 46px;
}
.gs-category-admin section:nth-of-type(3) > div:last-child {
  align-items: stretch;
}
.gs-category-admin section:nth-of-type(3) article {
  min-width: 0;
  border-radius: 14px !important;
  padding: 20px !important;
  background: #fff !important;
  box-shadow: 0 2px 8px rgba(16,24,40,.025);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
.gs-category-admin section:nth-of-type(3) article:hover {
  border-color: #cbd8f5 !important;
  box-shadow: 0 8px 22px rgba(16,24,40,.07) !important;
  transform: translateY(-2px);
}
.gs-category-admin section:nth-of-type(3) article h3 {
  font-size: 16px !important;
  font-weight: 750 !important;
  letter-spacing: -.3px;
}
.gs-category-admin section:nth-of-type(3) article img {
  border-radius: 12px !important;
}
.gs-category-admin section:nth-of-type(3) article button,
.gs-category-admin section:last-of-type article button {
  min-height: 36px;
  border-radius: 9px !important;
  font-weight: 700 !important;
}
.gs-category-admin section:last-of-type {
  background: #fff !important;
}
.gs-category-admin section:last-of-type article {
  border: 1px solid #e7eaf0 !important;
  border-radius: 12px !important;
  padding: 18px !important;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.gs-category-admin section:last-of-type article:hover {
  border-color: #cbd8f5 !important;
  box-shadow: 0 5px 15px rgba(16,24,40,.05);
}
.gs-category-admin section:last-of-type article strong {
  color: #172033 !important;
  font-size: 14px;
}
.gs-category-admin footer {
  padding: 30px 10px !important;
  color: #98a2b3 !important;
  font-size: 12px !important;
}
@media (max-width: 768px) {
  .gs-category-admin {
    padding: 22px 15px !important;
  }
  .gs-category-admin section:not(:first-of-type) {
    padding: 20px !important;
  }
  .gs-category-admin header {
    align-items: flex-start !important;
  }
  .gs-category-admin section:first-of-type {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
  .gs-category-admin section:nth-of-type(3) > div:last-child {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
@media (max-width: 480px) {
  .gs-category-admin {
    padding: 18px 12px !important;
  }
  .gs-category-admin section:not(:first-of-type) {
    padding: 16px !important;
    border-radius: 13px !important;
  }
  .gs-category-admin section:first-of-type {
    grid-template-columns: 1fr !important;
  }
  .gs-category-admin section:nth-of-type(3) > div:last-child {
    grid-template-columns: 1fr !important;
  }
  .gs-category-admin header a {
    width: 100%;
    box-sizing: border-box;
    text-align: center;
  }
}

/* Category cards: vertical layout */
.gs-category-admin section:nth-of-type(3) > div[style*="grid"] {
  grid-template-columns: 1fr !important;
  gap: 14px !important;
}

.gs-category-admin section:nth-of-type(3) article {
  width: 100% !important;
  display: grid !important;
  grid-template-columns: 110px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 20px !important;
}

@media (max-width: 640px) {
  .gs-category-admin section:nth-of-type(3) article {
    grid-template-columns: 76px minmax(0, 1fr) !important;
    gap: 12px !important;
  }

  .gs-category-admin section:nth-of-type(3) article > div:last-child {
    grid-column: 1 / -1 !important;
  }
}

/* Category and Subcategory Two Column Layout */
.gs-category-admin > div[style] {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  column-gap: 22px !important;
  row-gap: 22px !important;
  align-items: start !important;
}

.gs-category-admin > div[style] > header {
  grid-column: 1 / -1 !important;
  grid-row: 1 !important;
}

.gs-category-admin > div[style] > section:nth-of-type(1) {
  grid-column: 1 / -1 !important;
  grid-row: 2 !important;
}

.gs-category-admin > div[style] > div[role="status"] {
  grid-column: 1 / -1 !important;
  grid-row: 3 !important;
}

.gs-category-admin > div[style] > section:nth-of-type(2) {
  grid-column: 1 !important;
  grid-row: 4 !important;
  min-width: 0 !important;
}

.gs-category-admin > div[style] > section:nth-of-type(4) {
  grid-column: 2 !important;
  grid-row: 4 !important;
  min-width: 0 !important;
}

.gs-category-admin > div[style] > section:nth-of-type(3) {
  grid-column: 1 / -1 !important;
  grid-row: 5 !important;
  min-width: 0 !important;
}

@media (max-width: 850px) {
  .gs-category-admin > div[style] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .gs-category-admin > div[style] > section:nth-of-type(2),
  .gs-category-admin > div[style] > section:nth-of-type(3),
  .gs-category-admin > div[style] > section:nth-of-type(4) {
    grid-column: 1 !important;
    grid-row: auto !important;
  }
}

/* Hide Category Image and Icon Fields */
.gs-category-admin #category-icon {
  display: none !important;
}

.gs-category-admin div:has(> label[for="category-icon"]),
.gs-category-admin div:has(> label[for="category-image"]) {
  display: none !important;
}

/* Compact Subcategory Statistics Card */
.gs-category-admin .gs-subcategory-stat {
  display: grid !important;
  grid-template-columns: 24px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 5px 8px !important;
  min-height: 38px !important;
  border: 1px solid #e5eaf2 !important;
  border-radius: 12px !important;
  background: #f8faff !important;
  box-shadow: none !important;
}

.gs-category-admin .gs-subcategory-stat-icon {
  width: 38px !important;
  height: 38px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 10px !important;
  background: #eaf0ff !important;
  color: #245bdb !important;
  font-size: 13px !important;
}

.gs-category-admin .gs-subcategory-stat-info {
  min-width: 0;
}

.gs-category-admin .gs-subcategory-stat-info p {
  margin: 0 0 4px !important;
  font-size: 13px !important;
  font-weight: 650 !important;
}

.gs-category-admin .gs-subcategory-stat-info span {
  font-size: 11px !important;
  margin: 0 !important;
}

.gs-category-admin .gs-subcategory-stat-number {
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 750 !important;
  color: #245bdb !important;
}

/* Compact Statistics Dashboard */
.gs-category-admin header {
  margin-bottom: 6px !important;
}

.gs-category-admin section:first-of-type {
  gap: 8px !important;
  margin-bottom: 8px !important;
}

.gs-category-admin section:first-of-type > div {
  padding: 6px 8px !important;
  min-height: 0 !important;
  border-radius: 8px !important;
}

.gs-category-admin section:first-of-type > div > div:first-child {
  width: 27px !important;
  height: 27px !important;
  min-width: 27px !important;
  border-radius: 7px !important;
  font-size: 14px !important;
}

.gs-category-admin section:first-of-type > div > p {
  font-size: 10px !important;
  margin: 3px 0 1px !important;
  line-height: 1.15 !important;
}

.gs-category-admin section:first-of-type > div > h2 {
  font-size: 20px !important;
  line-height: 1.1 !important;
  margin: 1px 0 !important;
}

.gs-category-admin section:first-of-type > div > span {
  display: block !important;
  font-size: 9px !important;
  line-height: 1.15 !important;
  margin-top: 2px !important;
}
`}
</style>
        <div style={styles.container}>

        {/* Header */}
        <header style={{ ...styles.header, marginBottom: "14px" }}>
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
        <section style={{
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "12px",
}}>
  <div style={styles.statCard}>
    <div style={styles.statIcon}>▦</div>
    <p style={styles.statLabel}>Categories</p>
    <h2 style={styles.statNumber}>{categories.length}</h2>
    <span style={styles.statHint}>Active store categories</span>
  </div>

  <div style={styles.statCard}>
    <div style={styles.statIcon}>▤</div>
    <p style={styles.statLabel}>Subcategories</p>
    <h2 style={styles.statNumber}>{subcategories.length}</h2>
    <span style={styles.statHint}>Across all categories</span>
  </div>

  <div style={styles.statCard}>
    <div style={styles.statIcon}>▣</div>
    <p style={styles.statLabel}>Products</p>
    <h2 style={styles.statNumber}>{totalProducts}</h2>
    <span style={styles.statHint}>Total products in store</span>
  </div>

  <div style={styles.statCard}>
    <div style={styles.statIcon}>✦</div>
    <p style={styles.statLabel}>Unassigned Products</p>
    <h2 style={styles.statNumber}>{uncategorizedCount}</h2>
    <span style={styles.statHint}>Without a category</span>
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
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "14px",
            }}>
              <div>
                <label style={styles.label} htmlFor="category-name">
                  Category Name *
                </label>
                <input
                  id="category-name"
                  style={styles.input}
                  type="text"
                  placeholder="Example: Home Appliances"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  required
                  disabled={saving}
                />
              </div>

              <div>
                <label style={styles.label} htmlFor="category-icon">
                  Icon or Emoji
                </label>
                <input
                  id="category-icon"
                  style={styles.input}
                  type="text"
                  placeholder="Example: ⚡"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={20}
                  disabled={saving}
                />
              </div>

              <div>
                <label style={styles.label} htmlFor="category-order">
                  Display Order
                </label>
                <input
                  id="category-order"
                  style={styles.input}
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label style={styles.label} htmlFor="category-status">
                  Category Status
                </label>
                <select
                  id="category-status"
                  style={styles.input}
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <label style={styles.label} htmlFor="category-description">
                Description
              </label>
              <textarea
                id="category-description"
                style={{
                  ...styles.input,
                  minHeight: "90px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="Write a short description for this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={250}
                disabled={saving}
              />
            </div>

            <div style={{ marginTop: "18px" }}>
              <label style={styles.label} htmlFor="category-image">
                Category Image
              </label>

              <input
                id="category-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={saving}
                style={{
                  ...styles.input,
                  padding: "11px",
                  cursor: "pointer",
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (!file) return;

                  const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/avif",
                  ];

                  if (!allowedTypes.includes(file.type)) {
                    setMessage("Please select a JPG, PNG, WEBP, or AVIF image.");
                    e.target.value = "";
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setMessage("Image size must be 5MB or less.");
                    e.target.value = "";
                    return;
                  }

                  setMessage("");
                  setSelectedImage(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
              />

              <p style={{
                fontSize: "12px",
                color: "#858ba0",
                marginTop: "7px",
              }}>
                JPG, PNG, WEBP or AVIF. Maximum size: 5MB.
              </p>

              {imagePreview && (
                <div style={{
                  marginTop: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  flexWrap: "wrap",
                }}>
                  <img
                    src={imagePreview}
                    alt="Category preview"
                    style={{
                      width: "115px",
                      height: "95px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      border: "1px solid #eceef5",
                    }}
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview("");
                      setImageUrl("");
                      const input = document.getElementById(
                        "category-image"
                      ) as HTMLInputElement | null;

                      if (input) input.value = "";
                    }}
                    style={{
                      ...styles.cancelButton,
                      padding: "10px 14px",
                    }}
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            <details style={{
              marginTop: "22px",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              background: "#f8fafc",
              overflow: "hidden",
            }}>
              <summary style={{
                padding: "17px 19px",
                cursor: "pointer",
                color: "#172033",
                fontSize: "14px",
                fontWeight: 750,
              }}>
                Advanced Settings — Hero Banner Slideshow
              </summary>
              <div style={{
                padding: "18px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}>
              <label style={styles.label} htmlFor="hero-banner-images">
                Hero Banner Slideshow
              </label>

              <p style={{
                fontSize: "12px",
                color: "#858ba0",
                marginTop: "5px",
                marginBottom: "12px",
              }}>
                Upload up to 10 images. Images will rotate automatically on the category page.
              </p>

              <input
                id="hero-banner-images"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={saving || heroBannerImages.length + selectedHeroBannerImages.length >= 10}
                style={{
                  ...styles.input,
                  padding: "11px",
                  cursor: "pointer",
                }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/avif",
                  ];

                  if (heroBannerImages.length + selectedHeroBannerImages.length + files.length > 10) {
                    setMessage("You can upload a maximum of 10 hero banner images.");
                    e.target.value = "";
                    return;
                  }

                  const invalidFile = files.find(
                    (file) => !allowedTypes.includes(file.type)
                  );

                  if (invalidFile) {
                    setMessage("Please select JPG, PNG, WEBP, or AVIF images only.");
                    e.target.value = "";
                    return;
                  }

                  const oversizedFile = files.find(
                    (file) => file.size > 5 * 1024 * 1024
                  );

                  if (oversizedFile) {
                    setMessage("Each image must be 5MB or less.");
                    e.target.value = "";
                    return;
                  }

                  setMessage("");
                  setSelectedHeroBannerImages((prev) => [...prev, ...files]);
                  setSelectedHeroBannerPreviews((prev) => [
                    ...prev,
                    ...files.map((file) => URL.createObjectURL(file)),
                  ]);
                  e.target.value = "";
                }}
              />

              <div style={{
                marginTop: "18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}>
                <label style={{
                  ...styles.label,
                  marginBottom: 0,
                }}>
                  Slideshow Interval
                </label>

                <select
                  value={heroBannerInterval}
                  disabled={saving}
                  onChange={(e) => setHeroBannerInterval(Number(e.target.value))}
                  style={{
                    ...styles.input,
                    width: "120px",
                    padding: "9px",
                  }}
                >
                  {Array.from({ length: 8 }, (_, index) => index + 3).map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} seconds
                    </option>
                  ))}
                </select>
              </div>

              <p style={{
                fontSize: "12px",
                color: "#858ba0",
                marginTop: "8px",
              }}>
                {heroBannerImages.length + selectedHeroBannerImages.length} / 10 images selected
              </p>

              {heroBannerImages.length > 0 && (
                <div style={{
                  marginTop: "18px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: "14px",
                }}>
                  {heroBannerImages.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "9px",
                      }}
                    >
                      <img
                        src={url}
                        alt={`Hero banner ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "105px",
                          objectFit: "cover",
                          borderRadius: "7px",
                        }}
                      />

                      <p style={{
                        fontSize: "12px",
                        margin: "8px 0",
                        color: "#555",
                      }}>
                        Saved Image {index + 1}
                      </p>

                      <div style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}>
                        <button
                          type="button"
                          disabled={saving || index === 0}
                          onClick={() => {
                            setHeroBannerImages((prev) => {
                              const next = [...prev];
                              [next[index - 1], next[index]] = [
                                next[index],
                                next[index - 1],
                              ];
                              return next;
                            });
                          }}
                          style={{
                            ...styles.cancelButton,
                            padding: "7px 10px",
                            opacity: index === 0 ? 0.45 : 1,
                          }}
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          disabled={saving || index === heroBannerImages.length - 1}
                          onClick={() => {
                            setHeroBannerImages((prev) => {
                              const next = [...prev];
                              [next[index], next[index + 1]] = [
                                next[index + 1],
                                next[index],
                              ];
                              return next;
                            });
                          }}
                          style={{
                            ...styles.cancelButton,
                            padding: "7px 10px",
                            opacity: index === heroBannerImages.length - 1 ? 0.45 : 1,
                          }}
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setHeroBannerImages((prev) =>
                              prev.filter((_, imageIndex) => imageIndex !== index)
                            );
                          }}
                          style={{
                            ...styles.cancelButton,
                            padding: "7px 10px",
                            color: "#dc2626",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedHeroBannerImages.length > 0 && (
                <div style={{
                  marginTop: "18px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: "14px",
                }}>
                  {selectedHeroBannerImages.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      style={{
                        border: "1px dashed #8b83c7",
                        borderRadius: "10px",
                        padding: "9px",
                      }}
                    >
                      <img
                        src={selectedHeroBannerPreviews[index]}
                        alt={`New hero banner ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "105px",
                          objectFit: "cover",
                          borderRadius: "7px",
                        }}
                      />

                      <p style={{
                        fontSize: "12px",
                        margin: "8px 0",
                        color: "#555",
                        overflowWrap: "anywhere",
                      }}>
                        New Image: {file.name}
                      </p>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          URL.revokeObjectURL(selectedHeroBannerPreviews[index]);
                          setSelectedHeroBannerImages((prev) =>
                            prev.filter((_, imageIndex) => imageIndex !== index)
                          );
                          setSelectedHeroBannerPreviews((prev) =>
                            prev.filter((_, imageIndex) => imageIndex !== index)
                          );
                        }}
                        style={{
                          ...styles.cancelButton,
                          padding: "7px 10px",
                          color: "#dc2626",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </details>
            <div style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "22px",
            }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...styles.saveButton,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? uploadingImage
                    ? "Uploading image..."
                    : "Please wait..."
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
                const categorySubcategories = subcategories.filter(
                  (item) => item.parentCategoryId === category.id
                );
                const isExpanded = expandedCategoryIds.includes(category.id);

                return (
                  <article
                    key={category.id}
                    style={styles.categoryCard}
                  >
                    <div style={styles.cardTop}>
                      {category.imageUrl ? (
                        <img
                          src={category.imageUrl}
                          alt={category.name}
                          style={{
                            width: "58px",
                            height: "58px",
                            objectFit: "cover",
                            borderRadius: "13px",
                            border: "1px solid #eceef5",
                          }}
                        />
                      ) : (
                        <div style={styles.categoryIcon}>
                          {category.icon || category.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <span style={styles.categoryNumber}>
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <h3 style={styles.categoryName}>
                      {category.name}
                    </h3>

                    {category.description && (
                      <p style={{
                        fontSize: "12px",
                        lineHeight: 1.6,
                        color: "#858ba0",
                        marginTop: "-5px",
                        marginBottom: "13px",
                      }}>
                        {category.description}
                      </p>
                    )}

                    <div style={{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
  marginBottom: "13px",
}}>
  <div style={{
  display: "flex",
  alignItems: "center",
  gap: "7px",
}}>
  <button
    type="button"
    onClick={() => handleEdit(category)}
    aria-label={`Edit ${category.name}`}
    title="Edit"
    style={{
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid #dce6ff",
      borderRadius: "8px",
      background: "#edf3ff",
      color: "#245bdb",
      cursor: "pointer",
    }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  </button>

  <button
    type="button"
    onClick={() => handleDelete(category)}
    disabled={deletingId === category.id}
    aria-label={`Delete ${category.name}`}
    title="Delete"
    style={{
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid #ffe0e3",
      borderRadius: "8px",
      background: "#fff0f1",
      color: "#d92d45",
      cursor: deletingId === category.id ? "not-allowed" : "pointer",
      opacity: deletingId === category.id ? 0.6 : 1,
    }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  </button>
</div>
  <button
  type="button"
  onClick={() => handleCategoryStatusToggle(category)}
  disabled={updatingCategoryStatusId === category.id}
  aria-label={`Change ${category.name} status`}
  title="Click to change status"
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    border: "none",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 750,
    background: category.isActive === false ? "#fff0f0" : "#e8f8ef",
    color: category.isActive === false ? "#d92d45" : "#16834a",
    cursor: updatingCategoryStatusId === category.id ? "wait" : "pointer",
    opacity: updatingCategoryStatusId === category.id ? 0.6 : 1,
    transition: "all 0.2s ease",
  }}
>
  {updatingCategoryStatusId === category.id
    ? "Updating..."
    : category.isActive === false
      ? "Inactive"
      : "Active"}
</button>
</div><div style={styles.productCount}>
                      <span>▣</span>

                      <strong>{productCount}</strong>

                      <span>
                        {productCount === 1 ? "Product" : "Products"}
                      </span>
                    </div>

                    {categorySubcategories.length > 0 && (
                      <div style={{ marginTop: "14px", marginBottom: "14px" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategoryIds((current) =>
                              current.includes(category.id)
                                ? current.filter((id) => id !== category.id)
                                : [...current, category.id]
                            )
                          }
                          aria-expanded={isExpanded}
                          style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "11px 12px",
                            border: "1px solid #e5eaf2",
                            borderRadius: "10px",
                            background: isExpanded ? "#f0f4ff" : "#f8faff",
                            color: "#245bdb",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <span>
                            View Subcategories ({categorySubcategories.length})
                          </span>
                          <span>{isExpanded ? "▲" : "▼"}</span>
                        </button>

                        {isExpanded && (
                          <div style={{
                            display: "grid",
                            gap: "8px",
                            marginTop: "10px",
                          }}>
                            {categorySubcategories.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "10px 12px",
                                  border: "1px solid #edf0f5",
                                  borderRadius: "9px",
                                  background: "#fff",
                                }}
                              >
                                <div style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                  minWidth: 0,
                                }}>
                                  <span style={{
                                    color: "#30384a",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}>
                                    {item.name}
                                  </span>
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: item.isActive ? "#16834a" : "#d92d45",
                                  }}>
                                    {item.isActive ? "Active" : "Inactive"}
                                  </span>
                                </div>

                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  flexShrink: 0,
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSubcategoryEdit(item)}
                                    aria-label={`Edit ${item.name}`}
                                    title="Edit"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border: "1px solid #dce6ff",
                                      borderRadius: "8px",
                                      background: "#f0f4ff",
                                      color: "#245bdb",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                                    </svg>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSubcategoryDelete(item)}
                                    disabled={deletingSubcategoryId === item.id}
                                    aria-label={`Delete ${item.name}`}
                                    title="Delete"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border: "1px solid #ffe0e3",
                                      borderRadius: "8px",
                                      background: "#fff5f5",
                                      color: "#d92d45",
                                      cursor: deletingSubcategoryId === item.id ? "not-allowed" : "pointer",
                                      opacity: deletingSubcategoryId === item.id ? 0.5 : 1,
                                    }}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="m19 6-1 14H6L5 6" />
                                      <path d="M10 11v5M14 11v5" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={styles.cardDivider} />


                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Subcategory Management */}
        <section style={styles.formCard}>
          <div style={styles.formHeading}>
            <div>
              <span style={styles.formIcon}>⌘</span>
            </div>
            <div>
              <h2 style={styles.sectionTitle}>Subcategory Management</h2>
              <p style={styles.formSubtitle}>
                Organize products into subcategories under each main category.
              </p>
            </div>
          </div>

          {categories.length === 0 ? (
            <p style={styles.formSubtitle}>
              Create a main category before adding subcategories.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubcategorySubmit}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "16px",
                }}>
                  <div>
                    <label style={styles.label} htmlFor="subcategory-parent">
                      Main Category *
                    </label>
                    <select
                      id="subcategory-parent"
                      style={styles.input}
                      value={parentCategoryId}
                      onChange={(e) => setParentCategoryId(e.target.value)}
                      disabled={saving}
                      required
                    >
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label} htmlFor="subcategory-name">
                      Subcategory Name *
                    </label>
                    <input
                      id="subcategory-name"
                      style={styles.input}
                      value={subcategoryName}
                      onChange={(e) => setSubcategoryName(e.target.value)}
                      placeholder="Example: Headphones"
                      maxLength={50}
                      required
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label style={styles.label} htmlFor="subcategory-order">
                      Display Order
                    </label>
                    <input
                      id="subcategory-order"
                      style={styles.input}
                      type="number"
                      min="0"
                      value={subcategorySortOrder}
                      onChange={(e) => setSubcategorySortOrder(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label style={styles.label} htmlFor="subcategory-status">
                      Subcategory Status
                    </label>
                    <select
                      id="subcategory-status"
                      style={styles.input}
                      value={subcategoryIsActive ? "active" : "inactive"}
                      onChange={(e) => setSubcategoryIsActive(e.target.value === "active")}
                      disabled={saving}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "20px",
                }}>
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
                      : editingSubcategoryId
                        ? "Update Subcategory"
                        : "+ Add Subcategory"}
                  </button>

                  {editingSubcategoryId && (
                    <button
                      type="button"
                      onClick={resetSubcategoryForm}
                      disabled={saving}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div style={{
                borderTop: "1px solid #eceef5",
                marginTop: "28px",
                paddingTop: "22px",
              }}>

                {subcategories.filter(
                  (item) => item.parentCategoryId === parentCategoryId
                ).length === 0 ? (
                  <div style={styles.empty}>
                    <h3>No subcategories found</h3>
                    <p>Add the first subcategory for this category.</p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}>
                    {subcategories
                      .filter((item) => item.parentCategoryId === parentCategoryId)
                      .map((item) => (
                        <article
                          key={item.id}
                          style={{
                            border: "1px solid #eceef5",
                            borderRadius: "13px",
                            padding: "16px",
                            background: "#fff",
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}>
                            <strong style={{ color: "#20223f" }}>
                              {item.name}
                            </strong>
                            <span style={{
                              fontSize: "10px",
                              fontWeight: 750,
                              color: item.isActive ? "#16834a" : "#d92d45",
                              background: item.isActive ? "#e8f8ef" : "#fff0f0",
                              padding: "5px 8px",
                              borderRadius: "20px",
                            }}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <p style={{
                            fontSize: "12px",
                            color: "#858ba0",
                            margin: "9px 0 13px",
                          }}>
                            Display order: {item.sortOrder}
                          </p>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleSubcategoryEdit(item)}
                              style={styles.editButton}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubcategoryDelete(item)}
                              disabled={deletingSubcategoryId === item.id}
                              style={{
                                ...styles.deleteButton,
                                opacity: deletingSubcategoryId === item.id ? 0.6 : 1,
                              }}
                            >
                              {deletingSubcategoryId === item.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </div>
            </>
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
    background: "#f6f8fb",
    padding: "36px 24px",
    color: "#172033",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    width: "100%",
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontSize: "16px",
    color: "#475467",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "32px",
  },
  breadcrumb: {
    fontSize: "11px",
    fontWeight: 750,
    letterSpacing: "1.5px",
    color: "#245bdb",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(26px, 3vw, 34px)",
    fontWeight: 800,
    letterSpacing: "-1px",
    margin: 0,
    color: "#172033",
  },
  subtitle: {
    color: "#667085",
    marginTop: "9px",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  backButton: {
    background: "#ffffff",
    color: "#344054",
    padding: "12px 19px",
    borderRadius: "10px",
    border: "1px solid #e4e7ec",
    textDecoration: "none",
    fontWeight: 650,
    fontSize: "13px",
    boxShadow: "0 2px 5px rgba(16,24,40,0.03)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "26px",
  },
  statCard: {
    background: "#ffffff",
    borderRadius: "10px",
    padding: "12px",
    height: "125px",
    boxSizing: "border-box",
    border: "1px solid #eaecf0",
    boxShadow: "0 2px 6px rgba(16,24,40,0.025)",
  },
  statIcon: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: "8px",
    background: "#edf3ff",
    color: "#245bdb",
    fontSize: "14px",
    fontWeight: 700,
  },
  statLabel: {
    color: "#667085",
    fontSize: "11px",
    fontWeight: 600,
    marginTop: "5px",
    marginBottom: "3px",
  },
  statNumber: {
    fontSize: "22px",
    fontWeight: 750,
    lineHeight: 1.1,
    margin: 0,
    color: "#172033",
    letterSpacing: "-0.5px",
  },
  statHint: {
    fontSize: "9px",
    color: "#98a2b3",
    marginTop: "3px",
  },
  message: {
    background: "#eff6ff",
    color: "#175cd3",
    border: "1px solid #dbeafe",
    padding: "14px 18px",
    borderRadius: "11px",
    marginBottom: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 600,
  },
  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: "18px",
    cursor: "pointer",
    color: "#175cd3",
  },
  formCard: {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #eaecf0",
    boxShadow: "0 2px 8px rgba(16,24,40,0.035)",
    marginBottom: "26px",
  },
  formHeading: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "25px",
  },
  formIcon: {
    width: "46px",
    height: "46px",
    display: "grid",
    placeItems: "center",
    background: "#edf3ff",
    color: "#245bdb",
    borderRadius: "10px",
    fontSize: "23px",
    fontWeight: 700,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "19px",
    fontWeight: 750,
    margin: 0,
    color: "#172033",
    letterSpacing: "-0.3px",
  },
  formSubtitle: {
    color: "#667085",
    fontSize: "12px",
    marginTop: "6px",
    lineHeight: 1.6,
  },
  label: {
    display: "block",
    fontWeight: 650,
    fontSize: "12px",
    marginBottom: "8px",
    color: "#344054",
  },
  formRow: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
  },
  input: {
    flex: "1 1 260px",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    border: "1px solid #d0d5dd",
    borderRadius: "9px",
    fontSize: "13px",
    outline: "none",
    background: "#ffffff",
    color: "#172033",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  saveButton: {
    background: "#245bdb",
    color: "#ffffff",
    border: "1px solid #245bdb",
    padding: "12px 21px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 650,
    fontSize: "13px",
    boxShadow: "0 2px 5px rgba(36,91,219,0.15)",
  },
  cancelButton: {
    background: "#ffffff",
    color: "#475467",
    border: "1px solid #d0d5dd",
    padding: "12px 18px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  },
  listSection: {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #eaecf0",
    boxShadow: "0 2px 8px rgba(16,24,40,0.035)",
    marginBottom: "26px",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },
  count: {
    background: "#edf3ff",
    color: "#245bdb",
    padding: "8px 13px",
    borderRadius: "30px",
    fontWeight: 700,
    fontSize: "12px",
    border: "1px solid #dbeafe",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f9fafb",
    border: "1px solid #e4e7ec",
    borderRadius: "10px",
    padding: "0 14px",
    marginTop: "22px",
    marginBottom: "22px",
  },
  searchIcon: {
    fontSize: "18px",
    color: "#667085",
  },
  searchInput: {
    width: "100%",
    padding: "13px 0",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "13px",
    color: "#172033",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))",
    gap: "16px",
  },
  categoryCard: {
    background: "#ffffff",
    border: "1px solid #eaecf0",
    borderRadius: "13px",
    padding: "19px",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  categoryIcon: {
    width: "46px",
    height: "46px",
    display: "grid",
    placeItems: "center",
    background: "#edf3ff",
    color: "#245bdb",
    borderRadius: "10px",
    fontSize: "21px",
    fontWeight: 800,
  },
  categoryNumber: {
    color: "#98a2b3",
    fontSize: "11px",
    fontWeight: 700,
  },
  categoryName: {
    fontSize: "17px",
    fontWeight: 750,
    color: "#172033",
    marginTop: "17px",
    marginBottom: "10px",
    overflowWrap: "anywhere",
  },
  productCount: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "12px",
    color: "#667085",
  },
  cardDivider: {
    height: "1px",
    background: "#eaecf0",
    margin: "16px 0",
  },
  cardButtons: {
    display: "flex",
    gap: "9px",
  },
  editButton: {
    flex: 1,
    background: "#edf3ff",
    color: "#245bdb",
    border: "1px solid #dbeafe",
    padding: "9px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 650,
    fontSize: "12px",
  },
  deleteButton: {
    flex: 1,
    background: "#fff1f0",
    color: "#d92d45",
    border: "1px solid #fee4e2",
    padding: "9px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 650,
    fontSize: "12px",
  },
  empty: {
    padding: "48px 18px",
    textAlign: "center",
    color: "#667085",
    background: "#f9fafb",
    border: "1px dashed #d0d5dd",
    borderRadius: "10px",
  },
  emptyIcon: {
    fontSize: "38px",
    color: "#245bdb",
  },
  footer: {
    textAlign: "center",
    padding: "25px 10px",
    color: "#98a2b3",
    fontSize: "12px",
  },
};
// Premium Categories Dashboard Design
Object.assign(styles, {
  page: {
    minHeight: "100vh",
    background: "#f5f6f8",
    padding: "32px 28px",
    color: "#182230",
    fontFamily: "Inter, Arial, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "1440px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "30px",
  },
  title: {
    fontSize: "25px",
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: "-0.8px",
    color: "#172033",
    margin: "8px 0",
  },
  subtitle: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#667085",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "11px 16px",
    background: "#ffffff",
    color: "#344054",
    border: "1px solid #e4e7ec",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "26px",
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf0",
    borderRadius: "13px",
    padding: "16px",
    boxShadow: "0 3px 12px rgba(16,24,40,0.025)",
  },
  statNumber: {
    fontSize: "22px",
    fontWeight: 750,
    lineHeight: 1.1,
    margin: 0,
    color: "#172033",
    letterSpacing: "-0.5px",
  },
  statHint: {
    fontSize: "12px",
    color: "#98a2b3",
    marginTop: "5px",
  },
  formCard: {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #e8ebf0",
    boxShadow: "0 3px 14px rgba(16,24,40,0.035)",
    marginBottom: "26px",
  },
  formHeading: {
    fontSize: "19px",
    fontWeight: 750,
    color: "#172033",
    letterSpacing: "-0.3px",
  },
  formSubtitle: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#667085",
    marginTop: "6px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    color: "#344054",
    marginBottom: "8px",
  },
  input: {
    flex: "1 1 260px",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "13px",
    outline: "none",
    background: "#ffffff",
    color: "#172033",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  saveButton: {
    background: "#245bdb",
    color: "#ffffff",
    border: "1px solid #245bdb",
    padding: "12px 22px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
    boxShadow: "0 3px 8px rgba(36,91,219,0.16)",
  },
  cancelButton: {
    background: "#ffffff",
    color: "#475467",
    border: "1px solid #d0d5dd",
    padding: "12px 19px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 650,
    fontSize: "13px",
  },
  listSection: {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #e8ebf0",
    boxShadow: "0 3px 14px rgba(16,24,40,0.025)",
    marginBottom: "26px",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },
  count: {
    background: "#edf3ff",
    color: "#245bdb",
    padding: "7px 12px",
    borderRadius: "30px",
    fontWeight: 750,
    fontSize: "12px",
    border: "1px solid #dbeafe",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#ffffff",
    border: "1px solid #e4e7ec",
    borderRadius: "11px",
    padding: "0 14px",
    marginTop: "22px",
    marginBottom: "22px",
    maxWidth: "460px",
  },
  searchInput: {
    width: "100%",
    padding: "13px 0",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "13px",
    color: "#172033",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))",
    gap: "17px",
  },
  categoryCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf0",
    borderRadius: "14px",
    padding: "20px",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
    boxShadow: "0 2px 8px rgba(16,24,40,0.025)",
  },
  categoryIcon: {
    width: "46px",
    height: "46px",
    display: "grid",
    placeItems: "center",
    background: "#edf3ff",
    color: "#245bdb",
    borderRadius: "13px",
    fontSize: "21px",
    fontWeight: 800,
  },
  categoryName: {
    fontSize: "16px",
    fontWeight: 750,
    color: "#172033",
    marginTop: "17px",
    marginBottom: "10px",
    overflowWrap: "anywhere",
  },
  editButton: {
    flex: 1,
    background: "#edf3ff",
    color: "#245bdb",
    border: "1px solid #dbeafe",
    padding: "10px 12px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "12px",
  },
  deleteButton: {
    flex: 1,
    background: "#fff1f0",
    color: "#d92d45",
    border: "1px solid #fee4e2",
    padding: "10px 12px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "12px",
  },
  empty: {
    padding: "52px 20px",
    textAlign: "center",
    color: "#667085",
    background: "#fafbfc",
    border: "1px dashed #d0d5dd",
    borderRadius: "13px",
  },
  footer: {
    textAlign: "center",
    padding: "28px 10px",
    color: "#98a2b3",
    fontSize: "12px",
  },
});
