const STORAGE_KEY = "digital-poster:screen-auth";

export interface ScreenAuth {
  screenId: string;
  screenName: string;
  screenToken: string;
}

export function getScreenAuth(): ScreenAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScreenAuth;
  } catch {
    return null;
  }
}

export function setScreenAuth(auth: ScreenAuth): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearScreenAuth(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
