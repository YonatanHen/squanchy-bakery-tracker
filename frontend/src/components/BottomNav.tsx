import { NavLink } from "react-router-dom";
import styles from "./BottomNav.module.css";
import { NAV_ITEMS } from "./navItems";

/** Fixed bottom navigation for phone widths (below 900px). */
export function BottomNav() {
  return (
    <nav aria-label="Main" className={styles.nav}>
      {NAV_ITEMS.map(({ path, label, Icon }) => (
        <NavLink key={path} to={path} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
