import { useCallback, useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastMessage {
  type: ToastVariant;
  message: string;
}

const DEFAULT_TIMEOUT = 3500;

/**
 * Lightweight toast helper so we can trigger ephemeral status messages
 * without pulling in an external dependency.
 */
export function useTransientToast(timeout: number = DEFAULT_TIMEOUT) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), timeout);
    return () => window.clearTimeout(timer);
  }, [toast, timeout]);

  const showToast = useCallback((message: string, type: ToastVariant = 'success') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
