"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while `active` is true. The browser drops the lock whenever the page is
 * hidden, so it is asked for again when the user comes back. Where it is not supported (or the
 * phone is saving battery) nothing happens: the screen just dims as usual.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      try {
        const sentinel = (await navigator.wakeLock?.request("screen")) ?? null;
        if (stopped) await sentinel?.release();
        else lock = sentinel;
      } catch {
        // Refused or unsupported.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
