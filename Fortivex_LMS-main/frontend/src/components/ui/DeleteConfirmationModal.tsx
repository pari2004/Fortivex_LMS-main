"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface DeleteConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  itemName: string;
  itemType: "User" | "Cohort" | "Program" | string;
  itemDetails?: string;
  warningText?: string;
}

export function DeleteConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  itemDetails,
  warningText,
}: DeleteConfirmationModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmed(false);
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmed || isDeleting) return;
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      setConfirmed(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to delete ${itemType.toLowerCase()}.`);
      setIsDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title || `Delete ${itemType}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Warning Icon & Details */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.85rem",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "12px",
            padding: "1rem",
            color: "var(--foreground)",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "#ef4444", fontSize: "1.6rem", flexShrink: 0, marginTop: "2px" }}
          >
            warning
          </span>
          <div style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
            <p style={{ fontWeight: 600, color: "#ef4444", marginBottom: "0.25rem" }}>
              Permanent Deletion (Step 2 of 2)
            </p>
            <p style={{ opacity: 0.9 }}>
              Are you sure you want to delete <strong>{itemName}</strong>
              {itemDetails ? ` (${itemDetails})` : ""}?
            </p>
            <p style={{ opacity: 0.8, fontSize: "0.85rem", marginTop: "0.35rem" }}>
              {warningText ||
                `This action cannot be undone and will permanently remove this ${itemType.toLowerCase()} and its associated data.`}
            </p>
          </div>
        </div>

        {/* Step 2: Confirmation Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            cursor: "pointer",
            userSelect: "none",
            padding: "0.75rem",
            borderRadius: "8px",
            background: confirmed ? "rgba(239, 68, 68, 0.06)" : "var(--color-surface)",
            border: `1px solid ${confirmed ? "#ef4444" : "var(--color-border)"}`,
            transition: "all 0.2s",
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={isDeleting}
            style={{
              width: "18px",
              height: "18px",
              accentColor: "#ef4444",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
            I confirm that I want to permanently delete this {itemType.toLowerCase()}.
          </span>
        </label>

        {error && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "0.85rem",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "0.6rem 0.85rem",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <Button variant="secondary" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || isDeleting}
            style={{
              background: confirmed ? "#dc2626" : "rgba(220, 38, 38, 0.4)",
              color: "#ffffff",
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: confirmed && !isDeleting ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
              {isDeleting ? "hourglass_empty" : "delete_forever"}
            </span>
            {isDeleting ? "Deleting..." : `Delete ${itemType}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

