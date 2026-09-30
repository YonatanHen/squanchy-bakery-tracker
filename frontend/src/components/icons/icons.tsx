// Inline SVG icons copied from the mockups; they draw with currentColor.
import type { ReactNode } from "react";

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

/** Pencil icon for the Edit reading button. */
export function EditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  );
}

/** Wrap nav icon paths in the shared 22px outline SVG. */
function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** List icon for Readings. */
export function ReadingsIcon() {
  return <NavIcon><path d="M4 6h16M4 12h16M4 18h10" /></NavIcon>;
}

/** Bell icon for Alerts. */
export function AlertsIcon() {
  return (
    <NavIcon>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </NavIcon>
  );
}

/** Upload arrow icon for Upload. */
export function UploadIcon() {
  return (
    <NavIcon>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v4h16v-4" />
    </NavIcon>
  );
}

/** Shop front icon for Branches. */
export function BranchesIcon() {
  return <NavIcon><path d="M4 10h16v10H4zM3 10l2-6h14l2 6" /></NavIcon>;
}

/** Sliders icon for Thresholds. */
export function ThresholdsIcon() {
  return (
    <NavIcon>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </NavIcon>
  );
}
