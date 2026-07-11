// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Next.js root layout: global CSS, document lang, and `suppressHydrationWarning` on body for theme/extension quirks.
 */
import "./globals.css";

export const metadata = {
  title: "NPA Squad",
  description: "Tarka 2.0",
  icons: {
    icon: "/images/favicon.png"
  }
};

/** Root HTML shell for all routes (global CSS, hydration warning for extensions). */
export default function RootLayout({ children }) {
  // Wrap every page with shared HTML shell and global styles.
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}


