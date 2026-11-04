import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 end-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-lift border text-xs sm:text-sm font-bold animate-slideUp transition-all ${
            toast.type === 'success'
              ? 'bg-ink text-white border-primary/50 shadow-yellow-glow'
              : toast.type === 'error'
              ? 'bg-danger text-white border-danger-dark'
              : 'bg-steel text-white border-steel-light'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-primary flex-shrink-0" />}
            <span className="leading-snug">{toast.text}</span>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
