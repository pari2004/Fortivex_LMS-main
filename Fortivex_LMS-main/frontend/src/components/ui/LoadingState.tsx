import styles from "./LoadingState.module.css";

export function LoadingState({ message = "Loading…", variant = "table" }: { message?: string, variant?: "table" | "spinner" }) {
  if (variant === "spinner") {
    return (
      <div className={styles.spinnerWrapper} role="status" aria-live="polite">
        <div className={styles.spinner} />
        <div className={styles.message}>{message}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <div className={styles.headerBox}>
        <div className={styles.skeletonPulse} style={{ width: "250px", height: "28px", borderRadius: "8px", marginBottom: "8px" }} />
        <div className={styles.skeletonPulse} style={{ width: "150px", height: "16px", borderRadius: "6px" }} />
      </div>

      <div className={styles.tableBox}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={styles.rowBox}>
            <div className={styles.rowFlex}>
              <div className={styles.skeletonPulse} style={{ width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className={styles.skeletonPulse} style={{ width: "40%", height: "18px", borderRadius: "6px", marginBottom: "8px" }} />
                <div className={styles.skeletonPulse} style={{ width: "25%", height: "14px", borderRadius: "4px" }} />
              </div>
              <div className={styles.skeletonPulse} style={{ width: "100px", height: "36px", borderRadius: "20px" }} />
            </div>
          </div>
        ))}
      </div>
      
      <div className={styles.message}>{message}</div>
    </div>
  );
}
