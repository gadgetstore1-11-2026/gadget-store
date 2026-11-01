"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type StoreSettings = {
storeName: string;
logoUrl: string;
phone: string;
whatsapp: string;
address: string;
deliveryCharge: number;
freeDeliveryMinimum: number;
};

const defaultSettings: StoreSettings = {
storeName: "Gadget Store",
logoUrl: "",
phone: "",
whatsapp: "",
address: "",
deliveryCharge: 80,
freeDeliveryMinimum: 3000,
};

export default function AdminSettingsPage() {
const router = useRouter();

const [settings, setSettings] =
useState<StoreSettings>(defaultSettings);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState("");
const [error, setError] = useState("");

useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, async (user) => {
if (!user) {
router.replace("/admin/orders/login");
return;
}

  if (user.uid !== ADMIN_UID) {
    setError("আপনার এই পেজ দেখার অনুমতি নেই।");
    setLoading(false);
    return;
  }

  try {
    const settingsRef = doc(db, "settings", "store");
    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {
      setSettings({
        ...defaultSettings,
        ...snapshot.data(),
      } as StoreSettings);
    }
  } catch (err) {
    console.error(err);
    setError("Settings লোড করা যায়নি।");
  } finally {
    setLoading(false);
  }
});

return () => unsubscribe();

}, [router]);

const handleChange = (
field: keyof StoreSettings,
value: string | number
) => {
setSettings((previous) => ({
...previous,
[field]: value,
}));

setMessage("");
setError("");

};

const handleSave = async (event: FormEvent<HTMLFormElement>) => {
event.preventDefault();


setSaving(true);
setMessage("");
setError("");

try {
  await setDoc(doc(db, "settings", "store"), {
    ...settings,
    deliveryCharge: Number(settings.deliveryCharge),
    freeDeliveryMinimum: Number(settings.freeDeliveryMinimum),
    updatedAt: new Date().toISOString(),
  });

  setMessage("Settings সফলভাবে সংরক্ষণ হয়েছে!");
} catch (err) {
  console.error(err);
  setError("Settings সংরক্ষণ করা যায়নি। আবার চেষ্টা করো।");
} finally {
  setSaving(false);
}


};

const inputStyle = {
width: "100%",
padding: "12px 14px",
border: "1px solid #dbe2ea",
borderRadius: "9px",
fontSize: "14px",
outline: "none",
boxSizing: "border-box" as const,
background: "#fff",
};

const labelStyle = {
display: "block",
fontSize: "13px",
fontWeight: 700,
marginBottom: "8px",
color: "#334155",
};

if (loading) {
return (
<div style={{ padding: 40, textAlign: "center" }}>
Settings লোড হচ্ছে... </div>
);
}

return (
<main
style={{
minHeight: "100vh",
background: "#f5f7fb",
padding: "30px",
color: "#172033",
fontFamily: "Arial, sans-serif",
}}
>
<div style={{ maxWidth: 1000, margin: "0 auto" }}>
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
flexWrap: "wrap",
gap: 15,
marginBottom: 25,
}}
> <div>
<p style={{ color: "#64748b", fontSize: 13 }}>
Admin Panel / Settings </p>

        <h1 style={{ fontSize: 28, margin: 0 }}>
          Store Settings
        </h1>

        <p style={{ color: "#64748b", fontSize: 14 }}>
          তোমার অনলাইন স্টোরের প্রয়োজনীয় তথ্য পরিবর্তন করো।
        </p>
      </div>

      <button
        type="button"
        onClick={() => router.push("/admin/orders")}
        style={{
          padding: "11px 16px",
          background: "#fff",
          border: "1px solid #dbe2ea",
          borderRadius: 9,
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        ← Dashboard
      </button>
    </div>

    {error && (
      <div
        style={{
          padding: 14,
          background: "#fee2e2",
          color: "#b91c1c",
          borderRadius: 10,
          marginBottom: 18,
        }}
      >
        {error}
      </div>
    )}

    {message && (
      <div
        style={{
          padding: 14,
          background: "#dcfce7",
          color: "#15803d",
          borderRadius: 10,
          marginBottom: 18,
        }}
      >
        ✓ {message}
      </div>
    )}

    <form onSubmit={handleSave}>
      {/* Store Information */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e8edf3",
          borderRadius: 15,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 19, marginTop: 0 }}>
          🏪 Store Information
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle}>Store Name</label>
            <input
              style={inputStyle}
              value={settings.storeName}
              onChange={(e) =>
                handleChange("storeName", e.target.value)
              }
              placeholder="Gadget Store"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Store Logo URL</label>
            <input
              style={inputStyle}
              value={settings.logoUrl}
              onChange={(e) =>
                handleChange("logoUrl", e.target.value)
              }
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {settings.logoUrl && (
          <div style={{ marginTop: 18 }}>
            <p style={labelStyle}>Logo Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.logoUrl}
              alt="Store logo preview"
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 8,
              }}
            />
          </div>
        )}
      </section>

      {/* Contact Information */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e8edf3",
          borderRadius: 15,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 19, marginTop: 0 }}>
          📞 Contact Information
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle}>Contact Phone</label>
            <input
              style={inputStyle}
              value={settings.phone}
              onChange={(e) =>
                handleChange("phone", e.target.value)
              }
              placeholder="01XXXXXXXXX"
            />
          </div>

          <div>
            <label style={labelStyle}>WhatsApp Number</label>
            <input
              style={inputStyle}
              value={settings.whatsapp}
              onChange={(e) =>
                handleChange("whatsapp", e.target.value)
              }
              placeholder="8801XXXXXXXXX"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Store Address</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 90,
                resize: "vertical",
              }}
              value={settings.address}
              onChange={(e) =>
                handleChange("address", e.target.value)
              }
              placeholder="Enter your store address"
            />
          </div>
        </div>
      </section>

      {/* Delivery Settings */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e8edf3",
          borderRadius: 15,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 19, marginTop: 0 }}>
          🚚 Delivery Settings
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle}>
              Delivery Charge (৳)
            </label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={settings.deliveryCharge}
              onChange={(e) =>
                handleChange(
                  "deliveryCharge",
                  Number(e.target.value)
                )
              }
              required
            />
          </div>

          <div>
            <label style={labelStyle}>
              Free Delivery Minimum Order (৳)
            </label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={settings.freeDeliveryMinimum}
              onChange={(e) =>
                handleChange(
                  "freeDeliveryMinimum",
                  Number(e.target.value)
                )
              }
              required
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: 14,
            borderRadius: 9,
            fontSize: 13,
          }}
        >
          উদাহরণ: ৳{settings.freeDeliveryMinimum} বা তার বেশি
          অর্ডারে Free Delivery এবং এর নিচে ৳
          {settings.deliveryCharge} Delivery Charge।
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        style={{
          background: saving ? "#94a3b8" : "#2563eb",
          color: "#fff",
          border: "none",
          padding: "14px 25px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  </div>
</main>


);
}
