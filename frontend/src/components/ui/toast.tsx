import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  type: ToastType;
  message: string;
  action?: React.ReactNode;
  onClose: () => void;
  autoClose?: number;
}

const typeStyles = {
  success: {
    bg: "bg-success-50 border border-success-200",
    icon: "text-success-600",
    text: "text-success-900",
  },
  error: {
    bg: "bg-error-50 border border-error-200",
    icon: "text-error-600",
    text: "text-error-900",
  },
  warning: {
    bg: "bg-warning-50 border border-warning-200",
    icon: "text-warning-600",
    text: "text-warning-900",
  },
  info: {
    bg: "bg-blue-50 border border-blue-200",
    icon: "text-blue-600",
    text: "text-blue-900",
  },
};

const icons = {
  success: Check,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toast({
  type,
  message,
  action,
  onClose,
  autoClose = 5000,
}: ToastProps) {
  const style = typeStyles[type];
  const Icon = icons[type];

  React.useEffect(() => {
    const timer = setTimeout(onClose, autoClose);
    return () => clearTimeout(timer);
  }, [autoClose, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={cn(
        "flex items-center gap-3 rounded-lg p-4 max-w-sm shadow-lg",
        style.bg
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", style.icon)} />
      <div className="flex-1">
        <p className={cn("text-sm font-medium", style.text)}>{message}</p>
      </div>
      {action && <div>{action}</div>}
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Array<ToastProps & { id: string }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              {...toast}
              onClose={() => onRemove(toast.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
