"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_UID = "MiCPapmVpcggbMozz8eV45jI7pX2";

type Review = {
  id: string;
  productId: string;
  productName: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string | null;
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e8edf3",
  borderRadius: "16px",
  padding: "22px",
  boxShadow: "0 3px 12px rgba(15,23,42,0.035)",
} as const;

const buttonStyle = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "9px",
  padding: "9px 13px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
} as const;

const dateFormat = (date: string | null) => {
  if (!date) return "N/A";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "N/A";

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusStyle = (status: string) => {
  switch (status) {
    case "Approved":
      return { background: "#dcfce7", color: "#15803d" };

    case "Rejected":
      return { background: "#fee2e2", color: "#dc2626" };

    default:
      return { background: "#fef3c7", color: "#b45309" };
  }
};

export default function ReviewsPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [actionLoading, setActionLoading] = useState("");
  const [notice, setNotice] = useState("");

  const loadReviews = useCallback(async () => {
    const user = auth.currentUser;

    if (!user || user.uid !== ADMIN_UID) {
      throw new Error("Admin authentication required.");
    }

    const token = await user.getIdToken();

    const response = await fetch("/api/admin/reviews", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load reviews.");
    }

    setReviews(data.reviews || []);
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

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
        setLoading(true);
        setError("");

        const token = await user.getIdToken();

        const response = await fetch("/api/admin/reviews", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load reviews.");
        }

        if (active) {
          setReviews(data.reviews || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load reviews."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const updateReview = async (
    reviewId: string,
    status: string
  ) => {
    try {
      setActionLoading(reviewId);
      setError("");
      setNotice("");

      const user = auth.currentUser;

      if (!user || user.uid !== ADMIN_UID) {
        throw new Error("Admin authentication required.");
      }

      const token = await user.getIdToken();

      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reviewId,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update review.");
      }

      await loadReviews();

      setNotice(data.message || "Review updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Update failed."
      );
    } finally {
      setActionLoading("");
    }
  };

  const deleteReview = async (reviewId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?"
    );

    if (!confirmed) return;

    try {
      setActionLoading(reviewId);
      setError("");
      setNotice("");

      const user = auth.currentUser;

      if (!user || user.uid !== ADMIN_UID) {
        throw new Error("Admin authentication required.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `/api/admin/reviews?reviewId=${encodeURIComponent(reviewId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete review.");
      }

      await loadReviews();

      setNotice("Review deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed."
      );
    } finally {
      setActionLoading("");
    }
  };

  const filteredReviews = useMemo(() => {
    const value = search.toLowerCase().trim();

    return reviews.filter((review) => {
      const matchesSearch =
        review.customerName.toLowerCase().includes(value) ||
        review.customerPhone.includes(value) ||
        review.productName.toLowerCase().includes(value) ||
        review.orderNumber.toLowerCase().includes(value) ||
        review.comment.toLowerCase().includes(value);

      const matchesFilter =
        filter === "All" || review.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [reviews, search, filter]);

  const pendingCount = reviews.filter(
    (review) => review.status === "Pending"
  ).length;

  const approvedCount = reviews.filter(
    (review) => review.status === "Approved"
  ).length;

  const rejectedCount = reviews.filter(
    (review) => review.status === "Rejected"
  ).length;

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce(
            (sum, review) => sum + review.rating,
            0
          ) / reviews.length
        ).toFixed(1)
      : "0.0";

  const statistics = [
    {
      label: "Total Reviews",
      value: reviews.length,
      color: "#2563eb",
      background: "#eff6ff",
      icon: "★",
    },
    {
      label: "Pending Reviews",
      value: pendingCount,
      color: "#d97706",
      background: "#fffbeb",
      icon: "◷",
    },
    {
      label: "Approved Reviews",
      value: approvedCount,
      color: "#16a34a",
      background: "#f0fdf4",
      icon: "✓",
    },
    {
      label: "Rejected Reviews",
      value: rejectedCount,
      color: "#dc2626",
      background: "#fef2f2",
      icon: "✕",
    },
    {
      label: "Average Rating",
      value: `${averageRating} / 5`,
      color: "#9333ea",
      background: "#faf5ff",
      icon: "★",
    },
  ];

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          display: "grid",
          placeItems: "center",
          fontFamily: "Arial, sans-serif",
          color: "#172033",
        }}
      >
        <div>Loading reviews...</div>
      </main>
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
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Admin Panel / Reviews
            </div>

            <h1
              style={{
                fontSize: "28px",
                margin: 0,
                fontWeight: 800,
              }}
            >
              Reviews Management
            </h1>

            <p
              style={{
                color: "#64748b",
                margin: "9px 0 0",
                fontSize: "14px",
              }}
            >
              Manage customer feedback and product ratings.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/orders")}
            style={{
              ...buttonStyle,
              padding: "12px 18px",
            }}
          >
            ← Dashboard
          </button>
        </div>

        {error && (
          <div
            style={{
              ...cardStyle,
              marginBottom: "18px",
              color: "#dc2626",
              background: "#fef2f2",
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            style={{
              ...cardStyle,
              marginBottom: "18px",
              color: "#15803d",
              background: "#f0fdf4",
            }}
          >
            {notice}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          {statistics.map((item) => (
            <div
              key={item.label}
              style={{
                ...cardStyle,
                display: "flex",
                alignItems: "center",
                gap: "15px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "13px",
                  display: "grid",
                  placeItems: "center",
                  background: item.background,
                  color: item.color,
                  fontSize: "25px",
                  fontWeight: 800,
                }}
              >
                {item.icon}
              </div>

              <div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    marginBottom: "5px",
                  }}
                >
                  {item.label}
                </div>

                <strong style={{ fontSize: "23px" }}>
                  {item.value}
                </strong>
              </div>
            </div>
          ))}
        </section>

        <section style={{ ...cardStyle, marginBottom: "22px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "15px",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                Customer Reviews
              </h2>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  marginBottom: 0,
                }}
              >
                Showing {filteredReviews.length} of {reviews.length} reviews
              </p>
            </div>

            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  setError("");
                  await loadReviews();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Refresh failed."
                  );
                } finally {
                  setLoading(false);
                }
              }}
              style={buttonStyle}
            >
              ↻ Refresh
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "20px",
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, product, phone or order..."
              style={{
                flex: "1 1 280px",
                minWidth: 0,
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "9px",
                outline: "none",
                fontSize: "14px",
              }}
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              style={{
                padding: "12px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: "9px",
                background: "#fff",
                minWidth: "170px",
                cursor: "pointer",
              }}
            >
              <option value="All">All Reviews</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </section>

        {filteredReviews.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              padding: "60px 20px",
            }}
          >
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>
              ★
            </div>

            <h3>No Reviews Found</h3>

            <p style={{ color: "#64748b", fontSize: "14px" }}>
              No reviews match your current search or filter.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredReviews.map((review) => (
              <article key={review.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "15px",
                  }}
                >
                  <div style={{ flex: "1 1 400px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "18px" }}>
                        {review.customerName}
                      </h3>

                      <span
                        style={{
                          ...statusStyle(review.status),
                          padding: "5px 10px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {review.status}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "13px",
                        lineHeight: 1.9,
                      }}
                    >
                      <div>Phone: {review.customerPhone || "N/A"}</div>
                      <div>Product: {review.productName}</div>
                      <div>Order: {review.orderNumber || "N/A"}</div>
                      <div>Date: {dateFormat(review.createdAt)}</div>
                    </div>

                    <div
                      style={{
                        marginTop: "14px",
                        color: "#f59e0b",
                        fontSize: "22px",
                        letterSpacing: "3px",
                      }}
                    >
                      {"★".repeat(
                        Math.max(0, Math.min(5, review.rating))
                      )}
                      <span style={{ color: "#e2e8f0" }}>
                        {"★".repeat(
                          5 - Math.max(0, Math.min(5, review.rating))
                        )}
                      </span>

                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "13px",
                          letterSpacing: 0,
                          marginLeft: "9px",
                        }}
                      >
                        {review.rating}/5
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: "15px",
                        padding: "15px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        color: "#334155",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {review.comment}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      alignContent: "flex-start",
                    }}
                  >
                    {review.status !== "Approved" && (
                      <button
                        disabled={actionLoading === review.id}
                        onClick={() =>
                          updateReview(review.id, "Approved")
                        }
                        style={{
                          ...buttonStyle,
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          opacity: actionLoading === review.id ? 0.6 : 1,
                        }}
                      >
                        Approve
                      </button>
                    )}

                    {review.status !== "Rejected" && (
                      <button
                        disabled={actionLoading === review.id}
                        onClick={() =>
                          updateReview(review.id, "Rejected")
                        }
                        style={{
                          ...buttonStyle,
                          background: "#f59e0b",
                          color: "#fff",
                          border: "none",
                          opacity: actionLoading === review.id ? 0.6 : 1,
                        }}
                      >
                        Reject
                      </button>
                    )}

                    <button
                      disabled={actionLoading === review.id}
                      onClick={() => deleteReview(review.id)}
                      style={{
                        ...buttonStyle,
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        opacity: actionLoading === review.id ? 0.6 : 1,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {actionLoading === review.id && (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      marginTop: "12px",
                    }}
                  >
                    Processing...
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}