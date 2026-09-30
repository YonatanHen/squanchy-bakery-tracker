import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";
import styles from "./Sidebar.module.css";

/** Left sidebar with the app name and page links for desktop widths (900px and up). */
export function Sidebar() {
  return (
    <nav aria-label="Main" className={styles.sidebar}>
      <strong className={styles.appName}>Squanchy Fridge Tracker</strong>
      {NAV_ITEMS.map(({ path, label }) => (
        <NavLink key={path} to={path} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
