import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(
    null
  );

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}
