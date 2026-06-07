"use client";

import { useEffect } from "react";

export function PwaBoot() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
    }
  }, []);

  return null;
}
