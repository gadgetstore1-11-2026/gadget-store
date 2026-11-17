"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type Division =
  | "Dhaka"
  | "Chattogram"
  | "Rajshahi"
  | "Khulna"
  | "Barishal"
  | "Sylhet"
  | "Rangpur"
  | "Mymensingh";

type Coupon = { code: string; type: "percentage" | "fixed"; value: number; minSubtotal: number; maxDiscount: number; active: boolean };

type StoreSettings = {
  storeName: string;
  logoUrl: string;
  phone: string;
  whatsapp: string;
  address: string;
  deliveryCharge: number;
  divisionDeliveryCharges: Record<Division, number>;
  freeDeliveryMinimum: number;
  coupons: Coupon[];
  bkashNumber: string;
  nagadNumber: string;
};

const defaultSettings: StoreSettings = {
  storeName: "Gadget Store",
  logoUrl: "",
  phone: "",
  whatsapp: "",
  address: "",
  deliveryCharge: 80,
  divisionDeliveryCharges: {
    Dhaka: 0,
    Chattogram: 0,
    Rajshahi: 0,
    Khulna: 0,
    Barishal: 0,
    Sylhet: 0,
    Rangpur: 0,
    Mymensingh: 0,
  },
  freeDeliveryMinimum: 3000,
  coupons: [],
  bkashNumber: "",
  nagadNumber: "",
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
    setError("You do not have permission to access this page.");
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
    setError("Unable to load settings.");
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
  const normalizedCodes = (settings.coupons || []).map((coupon) => coupon.code.trim().toUpperCase());
  if (normalizedCodes.some((code) => !code) || new Set(normalizedCodes).size !== normalizedCodes.length) throw new Error("Coupon codes must be unique and cannot be empty.");
  if ((settings.coupons || []).some((coupon) => !Number.isFinite(coupon.value) || coupon.value <= 0 || !Number.isFinite(coupon.minSubtotal) || coupon.minSubtotal < 0 || !Number.isFinite(coupon.maxDiscount) || coupon.maxDiscount < 0 || (coupon.type === "percentage" && coupon.value > 100))) throw new Error("Please check the coupon discount values.");
  await setDoc(doc(db, "settings", "store"), {
    ...settings,
    deliveryCharge: Number(settings.deliveryCharge),
    freeDeliveryMinimum: Number(settings.freeDeliveryMinimum),
    coupons: (settings.coupons || []).map((coupon) => ({ ...coupon, code: coupon.code.trim().toUpperCase(), value: Number(coupon.value), minSubtotal: Number(coupon.minSubtotal), maxDiscount: Number(coupon.maxDiscount) })),
    updatedAt: new Date().toISOString(),
  });

  setMessage("Settings saved successfully!");
} catch (err) {
  console.error(err);
  setError(err instanceof Error ? err.message : "Unable to save settings. Please try again.");
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
Loading settings... </div>
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
          Manage your online store information and preferences.
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
              onChange={(e) => handleChange("storeName", e.target.value)}
              placeholder="Enter your store name"
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

      {/* Coupon Settings */}
      <section style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 15, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ fontSize: 19, margin: 0 }}>🎟️ Coupon Codes</h2><p style={{ color: "#64748b", fontSize: 13, marginBottom: 0 }}>Create fixed or percentage discounts for customers.</p></div>
          <button type="button" onClick={() => setSettings((previous) => ({ ...previous, coupons: [...(previous.coupons || []), { code: "", type: "percentage", value: 10, minSubtotal: 0, maxDiscount: 0, active: true }] }))} style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: "#ede9fe", color: "#5b21b6", fontWeight: 700, cursor: "pointer" }}>+ Add Coupon</button>
        </div>
        {(settings.coupons || []).length === 0 ? <p style={{ color: "#64748b", fontSize: 13, marginTop: 18 }}>No coupon codes created yet.</p> : (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {settings.coupons.map((coupon, index) => (
              <div key={`${coupon.code}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                  <label style={labelStyle}>Coupon Code<input style={inputStyle} value={coupon.code} maxLength={40} placeholder="WELCOME10" onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") } : item) }))} /></label>
                  <label style={labelStyle}>Discount Type<select style={inputStyle} value={coupon.type} onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, type: event.target.value as Coupon["type"] } : item) }))}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount (৳)</option></select></label>
                  <label style={labelStyle}>Discount Value<input style={inputStyle} type="number" min="1" max={coupon.type === "percentage" ? 100 : undefined} value={coupon.value} onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, value: Number(event.target.value) } : item) }))} /></label>
                  <label style={labelStyle}>Minimum Subtotal (৳)<input style={inputStyle} type="number" min="0" value={coupon.minSubtotal} onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, minSubtotal: Number(event.target.value) } : item) }))} /></label>
                  <label style={labelStyle}>Maximum Discount (৳)<input style={inputStyle} type="number" min="0" value={coupon.maxDiscount} disabled={coupon.type === "fixed"} onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, maxDiscount: Number(event.target.value) } : item) }))} /></label>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={coupon.active} onChange={(event) => setSettings((previous) => ({ ...previous, coupons: previous.coupons.map((item, i) => i === index ? { ...item, active: event.target.checked } : item) }))} /> Active</label><button type="button" onClick={() => setSettings((previous) => ({ ...previous, coupons: previous.coupons.filter((_, i) => i !== index) }))} style={{ border: 0, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>Remove</button></div>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>A maximum discount of 0 means no percentage cap. Coupon discounts are calculated from the product subtotal. Reward points can be combined, but total discounts cannot exceed the subtotal.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "#94a3b8" : "#5b21b6",
              color: "#fff",
              border: "none",
              padding: "11px 18px",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Coupons"}
          </button>
        </div>
      </section>

      {/* Manual Payment Settings */}
      <section style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 15, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, marginTop: 0 }}>৳ Manual Payment Settings</h2>
        <p style={{ color: "#64748b", fontSize: 13 }}>Enter the public Send Money numbers customers should use. Never enter a PIN, OTP, or wallet password here.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
          <div><label style={labelStyle}>bKash Number</label><input style={inputStyle} value={settings.bkashNumber || ""} onChange={(event) => handleChange("bkashNumber", event.target.value.replace(/[^0-9+]/g, ""))} placeholder="01XXXXXXXXX" /></div>
          <div><label style={labelStyle}>Nagad Number</label><input style={inputStyle} value={settings.nagadNumber || ""} onChange={(event) => handleChange("nagadNumber", event.target.value.replace(/[^0-9+]/g, ""))} placeholder="01XXXXXXXXX" /></div>
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

        <h3 style={{ fontSize: 16, marginTop: 22 }}>
          Division-wise Delivery Charges
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            marginBottom: 18,
          }}
        >
          {(
            [
              "Dhaka",
              "Chattogram",
              "Rajshahi",
              "Khulna",
              "Barishal",
              "Sylhet",
              "Rangpur",
              "Mymensingh",
            ] as Division[]
          ).map((division) => (
            <div key={division}>
              <label style={labelStyle}>
                {division} Delivery Charge (৳)
              </label>
              <input
                type="number"
                min="0"
                style={inputStyle}
                value={settings.divisionDeliveryCharges[division] ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  setSettings((previous) => ({
                    ...previous,
                    divisionDeliveryCharges: {
                      ...previous.divisionDeliveryCharges,
                      [division]: value,
                    },
                  }));

                  setMessage("");
                  setError("");
                }}
                required
              />
            </div>
          ))}
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
          Example: ৳{settings.freeDeliveryMinimum} or more
           orders qualify for free delivery. Orders below this amount have a delivery charge of ৳
          {settings.deliveryCharge}  delivery charge.
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
