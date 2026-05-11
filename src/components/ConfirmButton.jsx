import React from "react";
import { useT } from "../lib/i18n.jsx";

export default function ConfirmButton({ className = "btn btnDanger", confirmText, onConfirm, children }) {
  const t = useT();
  const text = confirmText ?? t("确定删除？", "Are you sure to delete?");
  return (
    <button
      className={className}
      onClick={() => {
        const ok = window.confirm(text);
        if (ok) onConfirm();
      }}
      type="button"
    >
      {children}
    </button>
  );
}
