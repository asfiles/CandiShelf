import { useEffect, useRef, useState } from "react";
import type { ModelDownloadProgress } from "../lib/types";
import { isTauri } from "../lib/api";

/**
 * Subscribes to backend `model-download-progress` events and returns the latest
 * progress for the model currently downloading (or null). In the browser demo
 * (no Tauri runtime) there is no event stream, so it stays null and callers
 * fall back to an indeterminate spinner.
 */
export function useDownloadProgress(): ModelDownloadProgress | null {
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null);
  const unlisten = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<ModelDownloadProgress>(
        "model-download-progress",
        (e) => {
          if (!active) return;
          setProgress(e.payload);
          if (e.payload.done) {
            // Clear shortly after completion so the bar resets for next time.
            setTimeout(() => active && setProgress(null), 400);
          }
        },
      );
      unlisten.current = un;
    })();
    return () => {
      active = false;
      unlisten.current?.();
    };
  }, []);

  return progress;
}
