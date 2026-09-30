import { SignOutButton } from "../../components/SignOutButton/SignOutButton";
import { PlaceholderPage } from "../PlaceholderPage/PlaceholderPage";
import styles from "./ThresholdsPage.module.css";

/** Thresholds placeholder with the phone Sign out button at the bottom. */
export function ThresholdsPage() {
  return (
    <PlaceholderPage title="Thresholds">
      <div className={styles.page}>
        <SignOutButton className={styles.signOut} />
      </div>
    </PlaceholderPage>
  );
}
