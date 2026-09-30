import { Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { BottomNav } from "../BottomNav/BottomNav";
import { Sidebar } from "../Sidebar/Sidebar";

/** Layout for logged-in pages: sidebar on desktop, bottom nav on phones. */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
