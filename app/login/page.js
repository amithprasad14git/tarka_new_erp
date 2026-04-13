"use client";

/**
 * Login page: posts to `/api/auth/login`; successful login sets httpOnly `session` cookie and redirects to dashboard.
 * Brand logo: `public/images/` — set `LOGO_SRC` to your asset path.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const LOGO_SRC = "/images/tarkalogo.png";

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
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setSlide((s) => (s + 1) % CAROUSEL_SLIDES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  const goToSlide = useCallback((index) => {
    setSlide(index);
  }, []);

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
        setError(data.error || "Login failed");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.carouselWrap} aria-roledescription="carousel" aria-label="Highlights">
        <div className={styles.carouselTop}>
          <img className={styles.brandLogo} src={LOGO_SRC} alt="Tarka — Solutions that work" width={220} height={48} />
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

      <div className={styles.formCol}>
        <div className={styles.formCard}>
          <form className={styles.formInner} onSubmit={handleLogin}>
            <h1 className={styles.title}>Welcome back...</h1>
            <p className={styles.subtitle}>Log in to continue</p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className={styles.input}
              />
            </div>

            <div className={`${styles.field} ${styles.fieldPassword}`}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <div className={styles.passwordRow}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "Logging in…" : "Login"}
            </button>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
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
