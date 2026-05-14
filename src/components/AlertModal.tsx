'use client';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

type AlertType = 'info' | 'success' | 'error' | 'confirm';

interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const showAlert = (opt: AlertOptions) => {
    setOptions(opt);
  };

  const close = () => {
    if (options?.onCancel) options.onCancel();
    setOptions(null);
  };

  const confirm = () => {
    if (options?.onConfirm) options.onConfirm();
    setOptions(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient background accent */}
            <div className={`absolute -top-12 -left-12 w-24 h-24 rounded-full blur-3xl opacity-20 ${
              options.type === 'error' ? 'bg-red-500' : 
              options.type === 'success' ? 'bg-green-500' : 
              options.type === 'confirm' ? 'bg-brand' : 'bg-blue-500'
            }`} />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={`mb-4 p-3 rounded-xl bg-white/5 border ${
                options.type === 'error' ? 'border-red-500/20 text-red-400' : 
                options.type === 'success' ? 'border-green-500/20 text-green-400' : 
                options.type === 'confirm' ? 'border-brand/20 text-brand' : 'border-blue-500/20 text-blue-400'
              }`}>
                {options.type === 'error' && <AlertCircle size={28} />}
                {options.type === 'success' && <CheckCircle2 size={28} />}
                {options.type === 'confirm' && <HelpCircle size={28} />}
                {(!options.type || options.type === 'info') && <AlertCircle size={28} />}
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                {options.title || (options.type === 'confirm' ? 'Are you sure?' : 'Notification')}
              </h3>
              <p className="text-sm text-text-dim leading-relaxed mb-8">
                {options.message}
              </p>

              <div className="flex gap-3 w-full">
                {options.type === 'confirm' ? (
                  <>
                    <button
                      onClick={close}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-text-dim hover:bg-white/5 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirm}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      Confirm
                    </button>
                  </>
                ) : (
                  <button
                    onClick={confirm}
                    className="w-full px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Okay
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
