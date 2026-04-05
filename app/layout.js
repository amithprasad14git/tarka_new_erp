/**
 * Next.js root layout: global CSS, document lang, and `suppressHydrationWarning` on body for theme/extension quirks.
 */
import "./globals.css";

export const metadata = {
  title: "Tarka 2.0",
  description: "NPA ERP"
};

/** Root HTML shell for all routes (global CSS, hydration warning for extensions). */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
