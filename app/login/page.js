"use client";

// Application page or layout — what users see in the browser.

/**
 * Login page: posts to `/api/auth/login`; successful login sets httpOnly `session` cookie and redirects to dashboard.
 * Layout: floating split card (58% hero / 42% form) on #f8fafc page background.
 */
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatApiErrorPayload,
  formatUserFacingError,
  readJsonResponse
} from "../../lib/fetchClientError";
import { apiUserMessage } from "../../lib/apiUserMessages";
import { sessionErrorMessageForLoginReason } from "../../lib/sessionMessages";
import styles from "./login.module.css";

const TARKA_LOGO_SRC = "/images/tarkalogo.png";
const LOGIN_HERO_SRC = "/images/chatgpt_login_image.png";

/** Reads ?reason= from URL for session logout messages (must render inside Suspense). */
function LoginReasonSync({ onReason }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason) onReason(sessionErrorMessageForLoginReason(reason));
  }, [searchParams, onReason]);
  return null;
}

/** Public login form; on success redirects to `/dashboard`. */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // POST credentials; server sets session cookie — we only navigate on success.
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        setError(formatApiErrorPayload(data, apiUserMessage("loginFailed")));
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(formatUserFacingError(err, { fallback: apiUserMessage("networkUnreachable") }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <LoginReasonSync onReason={setError} />
      </Suspense>
      <div className={styles.loginCard}>
        <aside className={styles.leftPanel}>
          <div className={styles.heroImageWrap}>
            <img
              className={styles.heroImage}
              src={LOGIN_HERO_SRC}
              alt="Recovery Operations"
              decoding="async"
            />
          </div>
        </aside>

        <div className={styles.rightPanel}>
          <div className={styles.rightPanelInner}>
            <div className={styles.tarkaBrand}>
              <img
                className={styles.tarkaLogo}
                src={TARKA_LOGO_SRC}
                alt="Tarka — Solutions that work"
                width={280}
                height={88}
                decoding="async"
              />
            </div>

            <form className={styles.formInner} onSubmit={handleLogin}>
              <div className={styles.signInHeader}>
                <h1 className={styles.signInTitle}>Workspace Login</h1>
              </div>

              <div className="form-field form-field-outline">
                <div className="form-field-outline-box">
                  <label className="form-field-outline-label" htmlFor="login-username">
                    Username
                  </label>
                  <div className="form-field-outline-control">
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter Username"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>
              </div>

              <div className="form-field form-field-outline">
                <div className="form-field-outline-box">
                  <label className="form-field-outline-label" htmlFor="login-password">
                    Password
                  </label>
                  <div className={`form-field-outline-control ${styles.passwordOutlineControl}`}>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordReveal}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading} className={styles.loginSubmit}>
                {loading ? "Signing in…" : "Sign in"}
              </button>

              {error ? (
                <p className={styles.loginError} role="alert">
                  {error}
                </p>
              ) : null}

              <div className={styles.trustIndicator}>
                <span className={styles.trustDivider} aria-hidden="true" />
                <div className={styles.trustContent}>
                  <ShieldCheckIcon />
                  <span className={styles.trustText}>Secure access for authorized users only</span>
                </div>
                <span className={styles.trustDivider} aria-hidden="true" />
              </div>
            </form>

          <footer className={styles.loginFooter}>
            <p className={styles.loginFooterText}>© 2026 NPA Enforcement &amp; Recovery Squad</p>
            <p className={styles.loginFooterText}>All rights reserved.</p>
          </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      className={styles.trustIcon}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

