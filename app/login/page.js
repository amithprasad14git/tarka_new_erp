"use client";

// Application page or layout — what users see in the browser.

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Login page: posts to `/api/auth/login`; successful login sets httpOnly `session` cookie and redirects to dashboard.
 * UI-only assets: company + developer logos under `public/images/`.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  formatApiErrorPayload,
  formatUserFacingError,
  readJsonResponse
} from "../../lib/fetchClientError";
import { apiUserMessage } from "../../lib/apiUserMessages";
import styles from "./login.module.css";

const COMPANY_LOGO_SRC = "/images/npa_full_transparent_bg.png";
const DEVELOPER_LOGO_SRC = "/images/tarkalogo.png";

const CAROUSEL_SLIDES = [
  {
    key: "team",
    image: "/images/slide1.jpg",
    text: "Alone we can do so little; together we can do so much."
  },
  {
    key: "summit",
    image: "/images/slide2.jpg",
    text: "The grind you avoid today becomes the regret of tomorrow."
  },
  {
    key: "insight",
    image: "/images/slide3.jpg",
    text: "Hard work beats talent when talent doesn’t work hard."
  }
];

const CAROUSEL_INTERVAL_MS = 6000;

/** Public login form; on success redirects to `/dashboard`. */
// Sign-in screen: carousel plus form that sets the httpOnly session cookie on success.
export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // Rotate hero slides on a timer until the user picks one manually.
  useEffect(() => {
    const t = setInterval(() => {
      setSlide((s) => (s + 1) % CAROUSEL_SLIDES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Dot buttons jump the carousel to a specific slide.
  const goToSlide = useCallback((index) => {
    setSlide(index);
  }, []);

  // POST credentials; server sets session cookie — we only navigate on success.
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Ask the auth API to validate username/password and issue a session.
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

      // Cookie is httpOnly — browser sends it on dashboard requests automatically.
      router.push("/dashboard");
    } catch (err) {
      setError(formatUserFacingError(err, { fallback: apiUserMessage("networkUnreachable") }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.carouselWrap} aria-roledescription="carousel" aria-label="Highlights">
        <div className={styles.carouselTop}>
          <img
            className={styles.brandLogoDev}
            src={DEVELOPER_LOGO_SRC}
            alt="Tarka — Solutions that work"
            width={280}
            height={88}
            decoding="async"
            sizes="(max-width: 680px) 72vw, 320px"
          />
        </div>

        <div className={styles.slides} aria-live="polite">
          {CAROUSEL_SLIDES.map((item, i) => (
            <div
              key={item.key}
              className={`${styles.slide} ${i === slide ? styles.slideActive : ""}`}
              aria-hidden={i !== slide}
            >
              <img
                className={styles.slidePhoto}
                src={item.image}
                alt=""
                decoding="async"
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className={styles.slideTint} aria-hidden />
              <div className={styles.slideInner}>
                <p className={styles.tagline}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.dots} role="tablist" aria-label="Carousel slides">
          {CAROUSEL_SLIDES.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={i === slide}
              aria-label={`Slide ${i + 1}`}
              className={`${styles.dot} ${i === slide ? styles.dotActive : ""}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>
      </div>

      <div className={styles.formOverlay}>
        <div className={styles.formCard}>
          <form className={`master-entry-form ${styles.formInner}`} onSubmit={handleLogin}>
            <div className={styles.loginHead}>
              <img
                className={styles.companyLogo}
                src={COMPANY_LOGO_SRC}
                alt="NPA Squad"
                decoding="async"
              />
              <h1 className={styles.title}>Workspace Sign-in</h1>
              <p className={styles.subtitle}>Use your organizational account to continue.</p>
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
                <div className={`form-field-outline-control ${styles.outlinePwControl}`}>
                  <div className={styles.outlinePwRow}>
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
                      className={styles.outlinePwReveal}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className={`master-btn master-btn-primary ${styles.loginSubmit}`}>
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {error ? (
              <p className={`form-field-hint form-field-hint-error ${styles.loginError}`} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

// SVG icon for “show password” toggle (no text label needed).
function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// SVG icon for “hide password” toggle.
function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

