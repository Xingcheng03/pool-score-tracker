import React from "react";

export default function ConfirmButton({ className = "btn btnDanger", confirmText = "确定删除？", onConfirm, children }) {
  return (
    <button
      className={className}
      onClick={() => {
        const ok = window.confirm(confirmText);
        if (ok) onConfirm();
      }}
      type="button"
    >
      {children}
    </button>
  );
}
