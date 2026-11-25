import { FormHTMLAttributes } from "react";
import styles from "./Form.module.css";

export function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={`${styles.form} ${className ?? ""}`} {...props} />;
}
