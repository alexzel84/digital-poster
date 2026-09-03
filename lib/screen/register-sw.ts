export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return; // graceful degrade — some TV browsers lack SW support

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[ServiceWorker] registration failed", err);
    });
  });
}
