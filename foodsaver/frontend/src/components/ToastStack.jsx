import React from "react";

export default function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.body}
        </div>
      ))}
    </div>
  );
}
