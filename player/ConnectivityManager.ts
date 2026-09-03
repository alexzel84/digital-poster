export class ConnectivityManager {
  constructor(
    private onOnline: () => void,
    private onOffline: () => void
  ) {}

  private handleOnline = () => this.onOnline();
  private handleOffline = () => this.onOffline();

  isOnline(): boolean {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }

  start(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  stop(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }
}
