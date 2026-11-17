"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type HomepageSettings = {
  announcement: { enabled: boolean; text: string; link: string };
  hero: { eyebrow: string; title: string; description: string; buttonText: string; buttonLink: string; desktopImage: string; mobileImage: string; slides: string[]; intervalSeconds: number };
  freshShelf: { enabled: boolean; eyebrow: string; title: string; description: string; buttonText: string; buttonLink: string; imageUrl: string };
  sections: { categories: boolean; featuredProducts: boolean; freshShelf: boolean; allProducts: boolean; reviews: boolean; newsletter: boolean };
  productDisplay: { featuredCount: number; allProductsCount: number };
};

const defaults: HomepageSettings = {
  announcement: { enabled: true, text: "Free delivery on orders over ৳3,000", link: "/products" },
  hero: { eyebrow: "GADGET STORE · NEW ARRIVALS", title: "Upgrade Your Everyday", description: "Discover smart technology and everyday essentials, carefully selected for you.", buttonText: "Shop Now", buttonLink: "/products", desktopImage: "", mobileImage: "", slides: [], intervalSeconds: 5 },
  freshShelf: { enabled: true, eyebrow: "JUST LANDED", title: "Fresh Shelf", description: "Explore the latest additions to our collection.", buttonText: "Explore New Arrivals", buttonLink: "/products", imageUrl: "" },
  sections: { categories: true, featuredProducts: true, freshShelf: true, allProducts: true, reviews: true, newsletter: true },
  productDisplay: { featuredCount: 8, allProductsCount: 8 },
};

const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #dfe3eb", borderRadius: 9, background: "#fff", color: "#202033", fontSize: 14 } as const;
const labelStyle = { display: "block", marginBottom: 7, color: "#42445a", fontSize: 13, fontWeight: 700 } as const;
const cardStyle = { background: "#fff", border: "1px solid #e8e8f0", borderRadius: 15, padding: 22, marginBottom: 18 } as const;

export default function HomepageManagerPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<HomepageSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  async function uploadImage(
    file: File,
    folder: "homepage" | "fresh-shelf",
    group: "hero" | "freshShelf",
    key: "desktopImage" | "mobileImage" | "imageUrl"
  ) {
    const user = auth.currentUser;

    if (!user) {
      setError("Please log in again.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Only JPG, PNG, WEBP and AVIF images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be under 5 MB.");
      return;
    }

    setUploadingImage(`${group}.${key}`);
    setError("");
    setMessage("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", folder);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.imageUrl) {
        throw new Error(result.error || "Image upload failed.");
      }

      setSettings(current => ({
        ...current,
        [group]: {
          ...current[group],
          [key]: result.imageUrl,
        },
      }));

      setMessage("Image uploaded successfully. Save homepage settings to apply changes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setUploadingImage(null);
    }
  }

  async function uploadHeroSlides(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    const currentCount = settings.hero.slides?.length ?? 0;

    if (currentCount + files.length > 10) {
      setError("You can add a maximum of 10 hero images.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPG, PNG, WEBP and AVIF images are allowed.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Each image must be under 5 MB.");
        return;
      }
    }

    const user = auth.currentUser;

    if (!user) {
      setError("Please log in again.");
      return;
    }

    setUploadingImage("hero.slides");
    setError("");
    setMessage("");

    const uploadedUrls: string[] = [];

    try {
      const token = await user.getIdToken();

      for (const file of files) {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("folder", "homepage");

        const response = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.imageUrl) {
          throw new Error(result.error || "Image upload failed.");
        }

        uploadedUrls.push(result.imageUrl);
      }

      setSettings(current => ({
        ...current,
        hero: {
          ...current.hero,
          slides: [...(current.hero.slides ?? []), ...uploadedUrls].slice(0, 10),
        },
      }));

      setMessage(`${uploadedUrls.length} slideshow image(s) uploaded successfully. Save homepage settings to apply changes.`);
    } catch (e) {
      if (uploadedUrls.length > 0) {
        setSettings(current => ({
          ...current,
          hero: {
            ...current.hero,
            slides: [...(current.hero.slides ?? []), ...uploadedUrls].slice(0, 10),
          },
        }));
      }

      setError(e instanceof Error ? e.message : "Slideshow upload failed.");
    } finally {
      setUploadingImage(null);
    }
  }

  function moveHeroSlide(index: number, direction: number) {
    setSettings(current => {
      const slides = [...(current.hero.slides ?? [])];
      const target = index + direction;

      if (target < 0 || target >= slides.length) return current;

      [slides[index], slides[target]] = [slides[target], slides[index]];

      return {
        ...current,
        hero: { ...current.hero, slides },
      };
    });
  }

  function removeHeroSlide(index: number) {
    setSettings(current => ({
      ...current,
      hero: {
        ...current.hero,
        slides: (current.hero.slides ?? []).filter((_, slideIndex) => slideIndex !== index),
      },
    }));
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== ADMIN_UID) {
        router.replace("/admin/orders/login");
        return;
      }
      setAuthorized(true);
      try {
        const snapshot = await getDoc(doc(db, "settings", "homepage"));
        if (snapshot.exists()) setSettings({ ...defaults, ...(snapshot.data() as Partial<HomepageSettings>), announcement: { ...defaults.announcement, ...(snapshot.data().announcement ?? {}) }, hero: { ...defaults.hero, ...(snapshot.data().hero ?? {}) }, freshShelf: { ...defaults.freshShelf, ...(snapshot.data().freshShelf ?? {}) }, sections: { ...defaults.sections, ...(snapshot.data().sections ?? {}) }, productDisplay: { ...defaults.productDisplay, ...(snapshot.data().productDisplay ?? {}) } });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load homepage settings.");
      } finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  function update<K extends keyof HomepageSettings>(group: K, key: keyof HomepageSettings[K], value: string | number | boolean) {
    setSettings((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      await setDoc(doc(db, "settings", "homepage"), { ...settings, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? "" });
      setMessage("Homepage settings saved successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save homepage settings."); }
    finally { setSaving(false); }
  }

  if (loading || !authorized) return <div style={{ padding: 32 }}>Loading homepage manager...</div>;

  return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", color: "#202033" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div><p style={{ color: "#7654d6", fontWeight: 800, fontSize: 11, letterSpacing: 2 }}>STORE CONTENT</p><h1 style={{ margin: "6px 0", fontSize: 28 }}>Homepage Manager</h1><p style={{ margin: 0, color: "#77798b", fontSize: 13 }}>Manage homepage content and visibility without editing code.</p></div>
      <a href="/" target="_blank" rel="noreferrer" style={{ color: "#6848c5", fontWeight: 700, fontSize: 13 }}>View Store ↗</a>
    </div>
    {message && <p role="status" style={{ padding: 12, background: "#e9f9ef", color: "#167342", borderRadius: 9 }}>{message}</p>}
    {error && <p role="alert" style={{ padding: 12, background: "#fff0f0", color: "#b42318", borderRadius: 9 }}>{error}</p>}
    <form onSubmit={save}>
      <section style={cardStyle}><h2 style={{ marginTop: 0 }}>Announcement Bar</h2><label style={labelStyle}><input type="checkbox" checked={settings.announcement.enabled} onChange={e => update("announcement", "enabled", e.target.checked)} /> Show announcement bar</label><label style={labelStyle}>Announcement text</label><input style={inputStyle} value={settings.announcement.text} onChange={e => update("announcement", "text", e.target.value)} /><label style={{ ...labelStyle, marginTop: 14 }}>Link</label><input style={inputStyle} value={settings.announcement.link} onChange={e => update("announcement", "link", e.target.value)} /></section>
            <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Hero Banner</h2>
        <div style={{ marginTop: 20, padding: 18, border: "1px solid #ececf2", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Automatic Hero Slideshow</h3>
          <p style={{ color: "#77798b", fontSize: 13 }}>Upload multiple images. They will rotate automatically on your homepage.</p>

          <label style={labelStyle}>Slide Change Interval (seconds)</label>
          <input
            type="number"
            min={3}
            max={10}
            style={{ ...inputStyle, maxWidth: 180 }}
            value={settings.hero.intervalSeconds}
            onChange={(e) => update("hero", "intervalSeconds", Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Upload Multiple Images (Maximum 10)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            disabled={uploadingImage !== null || (settings.hero.slides?.length ?? 0) >= 10}
            onChange={(e) => {
              uploadHeroSlides(e.target.files);
              e.currentTarget.value = "";
            }}
          />

          {uploadingImage === "hero.slides" && <p style={{ color: "#6848c5", fontSize: 13 }}>Uploading slideshow images...</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginTop: 18 }}>
            {(settings.hero.slides ?? []).map((url, index) => (
              <div key={`${url}-${index}`} style={{ border: "1px solid #e8e8f0", borderRadius: 10, padding: 9 }}>
                <img src={url} alt={`Hero slide ${index + 1}`} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 7 }} />
                <p style={{ fontSize: 12, fontWeight: 700 }}>Slide {index + 1}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" disabled={index === 0} onClick={() => moveHeroSlide(index, -1)} style={{ flex: 1, padding: 7 }}>Move Left</button>
                  <button type="button" disabled={index === (settings.hero.slides?.length ?? 0) - 1} onClick={() => moveHeroSlide(index, 1)} style={{ flex: 1, padding: 7 }}>Move Right</button>
                  <button type="button" onClick={() => removeHeroSlide(index)} style={{ padding: 7, color: "#b42318" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: "#77798b", fontSize: 12 }}>{(settings.hero.slides ?? []).length} of 10 images added.</p>
        </div>
      </section>
            <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Fresh Shelf</h2>
        <label style={labelStyle}>
          <input type="checkbox" checked={settings.freshShelf.enabled} onChange={e => update("freshShelf","enabled",e.target.checked)} /> Enable Fresh Shelf
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          {([["eyebrow","Eyebrow"],["title","Title"],["description","Description"],["buttonText","Button text"],["buttonLink","Button link"]] as const).map(([key,title]) => (
            <label key={key} style={labelStyle}>
              {title}
              <input style={{ ...inputStyle, marginTop: 7 }} value={settings.freshShelf[key]} onChange={e => update("freshShelf",key,e.target.value)} />
            </label>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: 16, border: "1px solid #ececf2", borderRadius: 12 }}>
          <label style={labelStyle}>Fresh Shelf Image URL</label>
          <input
            style={inputStyle}
            value={settings.freshShelf.imageUrl}
            onChange={e => update("freshShelf","imageUrl",e.target.value)}
            placeholder="https://example.com/fresh-shelf.jpg"
          />
          <label style={{ ...labelStyle, marginTop: 14 }}>Upload image</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={uploadingImage !== null}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, "fresh-shelf", "freshShelf", "imageUrl");
              e.currentTarget.value = "";
            }}
          />
          {uploadingImage === "freshShelf.imageUrl" && <p style={{ color: "#6848c5", fontSize: 13 }}>Uploading image...</p>}
          {settings.freshShelf.imageUrl && (
            <img src={settings.freshShelf.imageUrl} alt="Fresh Shelf preview" style={{ display: "block", width: "100%", maxWidth: 420, maxHeight: 180, objectFit: "contain", marginTop: 14, borderRadius: 9, background: "#f5f5f8" }} />
          )}
        </div>
      </section>
      <section style={cardStyle}><h2 style={{ marginTop: 0 }}>Homepage Sections</h2><p style={{ color: "#77798b", fontSize: 13 }}>Choose which sections are visible on your live storefront. Changes appear automatically after saving.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>{(Object.keys(settings.sections) as Array<keyof HomepageSettings["sections"]>).map(key => <label key={key} style={{ padding: 12, border: "1px solid #ececf2", borderRadius: 9, fontSize: 13, fontWeight: 650 }}><input type="checkbox" checked={settings.sections[key]} onChange={e => update("sections",key,e.target.checked)} /> {({categories:"Categories",featuredProducts:"Featured Products",freshShelf:"Fresh Shelf",allProducts:"All Products",reviews:"Customer Reviews",newsletter:"Newsletter"})[key]}</label>)}</div></section>
      <section style={cardStyle}><h2 style={{ marginTop: 0 }}>Product Display</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>{([["featuredCount","Featured Products count"],["allProductsCount","All Products count"]] as const).map(([key,title]) => <label key={key} style={labelStyle}>{title}<input type="number" min={1} max={24} style={{ ...inputStyle, marginTop: 7 }} value={settings.productDisplay[key]} onChange={e => update("productDisplay",key,Math.max(1,Math.min(24,Number(e.target.value)||1)))} /></label>)}</div></section>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingBottom: 30 }}><button type="button" onClick={() => setSettings(defaults)} style={{ padding: "12px 18px", border: "1px solid #ddd", borderRadius: 9, background: "#fff", cursor: "pointer" }}>Restore Defaults</button><button disabled={saving} type="submit" style={{ padding: "12px 22px", border: 0, borderRadius: 9, background: "#6848c5", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving..." : "Save Homepage Settings"}</button></div>
    </form>
  </div>;
}
