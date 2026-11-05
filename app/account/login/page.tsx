"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { browserLocalPersistence, setPersistence, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCustomerAuthEmail, isValidBangladeshPhone } from "@/lib/customer-auth";

function CustomerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const success = searchParams.get("registered") === "1"
    ? "Your account has been created. Please log in."
    : "";
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isValidBangladeshPhone(phone)) {
      setError("Please enter a valid Bangladesh mobile number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = phone.replace(/\D/g, "");
      const email = getCustomerAuthEmail(normalizedPhone);

      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);

      router.push("/account");
    } catch (err) {
      console.error("Customer login failed:", err);

      const firebaseError = err as { code?: string };

      if (
        firebaseError.code === "auth/invalid-credential" ||
        firebaseError.code === "auth/user-not-found" ||
        firebaseError.code === "auth/wrong-password"
      ) {
        setError("Incorrect phone number or password.");
      } else if (firebaseError.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (firebaseError.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="customer-login-page">
      <div className="customer-login-card">
        <Link href="/" className="customer-login-brand">
          Gadget Store
        </Link>

        <div className="customer-login-heading">
          <span>WELCOME BACK</span>
          <h1>Customer Login</h1>
          <p>Sign in to manage your orders and account.</p>
        </div>

        <form onSubmit={handleLogin} className="customer-login-form">
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
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {success && <div className="login-success">{success}</div>}
          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing In..." : "Login"}
          </button>
        </form>

        <p className="customer-login-footer">
          Don&apos;t have an account?{" "}
          <Link href="/account/register">Create Account</Link>
        </p>

        <Link href="/" className="customer-login-home">
          Back to Store
        </Link>
      </div>

      <style jsx>{`
        .customer-login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 16px;
          background: #f4f6fb;
          font-family: Arial, sans-serif;
        }

        .customer-login-card {
          width: 100%;
          max-width: 440px;
          padding: 38px;
          background: white;
          border-radius: 18px;
          box-shadow: 0 12px 45px rgba(0, 0, 0, 0.07);
        }

        .customer-login-brand {
          display: block;
          text-align: center;
          color: #2563eb;
          font-size: 25px;
          font-weight: 800;
          text-decoration: none;
          margin-bottom: 35px;
        }

        .customer-login-heading {
          text-align: center;
          margin-bottom: 28px;
        }

        .customer-login-heading span {
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .customer-login-heading h1 {
          margin: 10px 0;
          font-size: 27px;
          color: #111827;
        }

        .customer-login-heading p {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }

        .customer-login-form {
          display: flex;
          flex-direction: column;
        }

        .customer-login-form label {
          margin: 14px 0 7px;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .customer-login-form input {
          width: 100%;
          padding: 13px;
          border: 1px solid #dbe0e8;
          border-radius: 9px;
          outline: none;
          font-size: 14px;
          box-sizing: border-box;
        }

        .customer-login-form input:focus {
          border-color: #2563eb;
        }

        .customer-login-form button {
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

        .customer-login-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-error,
        .login-success {
          margin-top: 15px;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
        }

        .login-error {
          background: #fef2f2;
          color: #dc2626;
        }

        .login-success {
          background: #ecfdf5;
          color: #047857;
        }

        .customer-login-footer {
          margin-top: 25px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
        }

        .customer-login-footer a {
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
        }

        .customer-login-home {
          display: block;
          margin-top: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .customer-login-card {
            padding: 25px 20px;
          }
        }
      `}</style>
    </main>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading...
        </main>
      }
    >
      <CustomerLoginForm />
    </Suspense>
  );
}
