import { Button } from "../Button/Button";
import styles from "./Pager.module.css";

interface PagerProps {
  offset: number;
  limit: number;
  count: number;
  total: number;
  onPage: (offset: number) => void;
}

/** Show "1–50 of 61" and Previous / Next buttons for offset paging. */
export function Pager({ offset, limit, count, total, onPage }: PagerProps) {
  return (
    <div className={styles.pager}>
      <span>{`${offset + 1}–${offset + count} of ${total}`}</span>
      {total > limit && (
        <span className={styles.buttons}>
          <Button variant="link" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
            ← Previous
          </Button>
          <Button variant="link" disabled={offset + count >= total} onClick={() => onPage(offset + limit)}>
            Next →
          </Button>
        </span>
      )}
    </div>
  );
}
