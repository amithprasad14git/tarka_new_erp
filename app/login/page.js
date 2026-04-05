"use client";

/**
 * Login page: posts to `/api/auth/login`; successful login sets httpOnly `session` cookie and redirects to dashboard.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Public login form; on success redirects to `/dashboard`. */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** Submits credentials to `/api/auth/login` and navigates to dashboard. */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server returns `{ error: string }` for authentication failures.
        setError(data.error || "Login failed");
        return;
      }

      // On success, server sets `session` httpOnly cookie.
      router.push("/dashboard");
    } catch (err) {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #f4f7ff 0%, #eefaf5 100%)",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "14px",
          padding: "28px",
          boxShadow: "0 10px 30px rgba(16, 24, 40, 0.08)",
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: "24px" }}>Tarka 2.0</h1>
        <p style={{ margin: "0 0 18px", color: "#667085" }}>
          Sign in to Continue
        </p>
        <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            marginBottom: "14px",
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: "8px",
            background: loading ? "#98a2b3" : "#1570ef",
            color: "#fff",
            padding: "11px 14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {error ? (
          <p style={{ color: "#b42318", marginTop: "12px", marginBottom: 0 }}>{error}</p>
        ) : null}
      </form>
    </div>
  );
}