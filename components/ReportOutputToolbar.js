"use client";

// Report UI — font size toolbar and full-screen toggle.

/**
 * @param {{
 *   fontPreset: string,
 *   onFontPresetChange: (preset: string) => void,
 *   fullscreen?: boolean,
 *   onFullscreenChange?: (next: boolean) => void,
 *   showFontControls?: boolean
 * }} props
 */
export default function ReportOutputToolbar({
  fontPreset,
  onFontPresetChange,
  fullscreen = false,
  onFullscreenChange = null,
  showFontControls = true
}) {
  if (!showFontControls && !onFullscreenChange) return null;

  return (
    <div className="report-output-toolbar" role="group" aria-label="Report display options">
      {showFontControls ? (
        <>
          <button
            type="button"
            className={`report-output-font-btn${fontPreset === "small" ? " is-active" : ""}`}
            disabled={fontPreset === "small"}
            aria-label="Smaller font"
            title="Smaller font"
            onClick={() => onFontPresetChange("small")}
          >
            A−
          </button>
          <button
            type="button"
            className={`report-output-font-btn${fontPreset === "normal" ? " is-active" : ""}`}
            aria-label="Normal font"
            title="Normal font"
            onClick={() => onFontPresetChange("normal")}
          >
            A
          </button>
          <button
            type="button"
            className={`report-output-font-btn${fontPreset === "large" ? " is-active" : ""}`}
            disabled={fontPreset === "large"}
            aria-label="Larger font"
            title="Larger font"
            onClick={() => onFontPresetChange("large")}
          >
            A+
          </button>
        </>
      ) : null}
      {onFullscreenChange ? (
        <button
          type="button"
          className={`report-output-font-btn report-output-fullscreen-btn${fullscreen ? " is-active" : ""}`}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? "✕" : "⛶"}
        </button>
      ) : null}
    </div>
  );
}
