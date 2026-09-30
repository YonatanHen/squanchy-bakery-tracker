import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "../styles/components/Dialog.module.css";

interface DialogProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Render a modal: a bottom sheet on phones, centered on desktop; Escape closes it. */
export function Dialog({ open, title, subtitle, onClose, children }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={subtitle ? `${id}-subtitle` : undefined}
        tabIndex={-1}
        className={styles.panel}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {subtitle && (
            <span id={`${id}-subtitle`} className={styles.subtitle}>
              {subtitle}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
