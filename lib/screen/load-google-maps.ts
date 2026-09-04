let loadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: typeof google;
  }
}

/**
 * Loads the Google Maps JS API (places library only) exactly once,
 * regardless of how many components ask for it. Resolves immediately if
 * already loaded. Rejects if no API key is configured — callers should
 * treat that as "gracefully fall back to a plain input," not a hard error.
 */
export function loadGoogleMaps(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key not configured"));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
