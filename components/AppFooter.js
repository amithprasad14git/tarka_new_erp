// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Site footer: copyright and tagline (dashboard shell).
 */
export default function AppFooter() {
  // Current year for the copyright line (updates automatically each January).
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="app-footer-inner">
        <p className="app-footer-line">
          Copyrights © {year} All Rights Reserved - NPA Enforcement and Recovery Squad Private Limited
        </p>
      </div>
    </footer>
  );
}


