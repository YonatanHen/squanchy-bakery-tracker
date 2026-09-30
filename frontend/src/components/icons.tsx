// Inline SVG icons copied from the mockups; they draw with currentColor.

/** Thermometer logo shown on the login page. */
export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <circle cx="12" cy="17" r="3" />
      <path d="M9 6h6M9 9h6" />
    </svg>
  );
}
