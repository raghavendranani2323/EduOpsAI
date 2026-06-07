"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const handler = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") handler();
    else window.addEventListener("load", handler);
    return () => window.removeEventListener("load", handler);
  }, []);
  return null;
}
