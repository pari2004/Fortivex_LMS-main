import styles from "./Badge.module.css";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  ENROLLED: "success",
  UPCOMING: "warning",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  INACTIVE: "warning",
};

export function Badge({ status, children }: { status?: string; children: React.ReactNode }) {
  const tone = (status && STATUS_TONE[status]) || "neutral";
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
