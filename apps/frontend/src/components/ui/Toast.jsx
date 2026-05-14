import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const DEFAULT_TIMEOUT = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      const timeout = options.timeout ?? DEFAULT_TIMEOUT;
      const toast = {
        id,
        message,
        kind: options.kind ?? "success",
        title: options.title ?? null
      };
      setToasts((current) => [...current, toast]);
      if (timeout > 0) {
        setTimeout(() => dismiss(id), timeout);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message, options) => push(message, { ...options, kind: "success" }),
      error: (message, options) => push(message, { ...options, kind: "error" }),
      info: (message, options) => push(message, { ...options, kind: "info" }),
      dismiss
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const kindClass =
    toast.kind === "error"
      ? "toast toast--error"
      : toast.kind === "info"
        ? "toast toast--info"
        : "toast toast--success";

  return (
    <div className={`${kindClass} ${visible ? "toast--visible" : ""}`}>
      <div className="toast-body">
        {toast.title ? <p className="toast-title">{toast.title}</p> : null}
        <p className="toast-message">{toast.message}</p>
      </div>
      <button type="button" className="toast-close" aria-label="Cerrar" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return ctx;
}
