import { useEffect } from "react";

export function useAutoDismiss(
  value: string | null,
  onDismiss: () => void,
  timeoutMs = 3500,
) {
  useEffect(() => {
    if (!value) return;

    const timeout = window.setTimeout(() => {
      onDismiss();
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [onDismiss, timeoutMs, value]);
}
