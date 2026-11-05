"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserLocalPersistence, createUserWithEmailAndPassword, setPersistence, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getCustomerAuthEmail,
  isValidBangladeshPhone,
} from "@/lib/customer-auth";

export default function CustomerRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!isValidBangladeshPhone(phone)) {
      setError("Please enter a valid Bangladesh mobile number.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = phone.replace(/\D/g, "");
      const email = getCustomerAuthEmail(normalizedPhone);

      await setPersistence(auth, browserLocalPersistence);

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(credential.user, {
        displayName: name.trim(),
      });

      const token = await credential.user.getIdToken();

      const response = await fetch("/api/customer/account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizedPhone,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to save your account information."
        );
      }

      router.replace("/account");
    } catch (err) {
      console.error("Customer registration failed:", err);

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      if (firebaseError.code === "auth/email-already-in-use") {
        setError("An account already exists with this phone number.");
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else if (firebaseError.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError(
          firebaseError.message || "Registration failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="customer-auth-page">
      <div className="customer-auth-card">
        <Link href="/" className="customer-auth-brand">
          Gadget Store
        </Link>

        <div className="customer-auth-heading">
          <span>CREATE YOUR ACCOUNT</span>
          <h1>Join Gadget Store</h1>
          <p>Create an account to manage your orders and profile.</p>
        </div>

        <form onSubmit={handleRegister} className="customer-auth-form">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />

          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            maxLength={11}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Enter your password again"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <div className="customer-auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="customer-auth-footer">
          Already have an account?{" "}
          <Link href="/account/login">Login</Link>
        </p>

        <Link href="/" className="customer-auth-home">
          Back to Store
        </Link>
      </div>

      <style jsx>{`
        .customer-auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 35px 16px;
          background: #f4f6fb;
          font-family: Arial, sans-serif;
        }

        .customer-auth-card {
          width: 100%;
          max-width: 440px;
          padding: 38px;
          background: white;
          border-radius: 18px;
          box-shadow: 0 12px 45px rgba(0, 0, 0, 0.07);
        }

        .customer-auth-brand {
          display: block;
          text-align: center;
          color: #2563eb;
          font-size: 25px;
          font-weight: 800;
          text-decoration: none;
          margin-bottom: 35px;
        }

        .customer-auth-heading {
          text-align: center;
          margin-bottom: 28px;
        }

        .customer-auth-heading span {
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .customer-auth-heading h1 {
          margin: 10px 0;
          font-size: 27px;
          color: #111827;
        }

        .customer-auth-heading p {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }

        .customer-auth-form {
          display: flex;
          flex-direction: column;
        }

        .customer-auth-form label {
          margin: 14px 0 7px;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .customer-auth-form input {
          width: 100%;
          padding: 13px;
          border: 1px solid #dbe0e8;
          border-radius: 9px;
          outline: none;
          font-size: 14px;
          box-sizing: border-box;
        }

        .customer-auth-form input:focus {
          border-color: #2563eb;
        }

        .customer-auth-form button {
          margin-top: 24px;
          padding: 14px;
          border: none;
          border-radius: 9px;
          background: #2563eb;
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .customer-auth-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .customer-auth-error {
          margin-top: 15px;
          padding: 12px;
          border-radius: 8px;
          background: #fef2f2;
          color: #dc2626;
          font-size: 13px;
        }

        .customer-auth-footer {
          margin-top: 25px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
        }

        .customer-auth-footer a {
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
        }

        .customer-auth-home {
          display: block;
          margin-top: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .customer-auth-card {
            padding: 25px 20px;
          }
        }
      `}</style>
    </main>
  );
}