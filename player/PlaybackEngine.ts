export interface PlaybackItem {
  id: string;
  type: "image" | "video";
  url: string;
  hash: string;
  duration: number | null; // seconds, images only
  expiresAt: string | null; // ISO string
  sortOrder: number;
}

export type PlaybackState = "empty" | "playing";

/**
 * Owns "what plays next" — nothing more. It doesn't touch the DOM, doesn't
 * own timers, and doesn't fetch anything. A component drives it: starts a
 * timer/attaches a video `ended` handler for the current item, and calls
 * `advance()` when that item is done (or `reportError()` if it failed to
 * load/play, which also advances). This separation is what makes the loop
 * logic itself unit-testable without a browser.
 */
export class PlaybackEngine {
  private items: PlaybackItem[] = [];
  private index = 0;

  constructor(items: PlaybackItem[] = []) {
    this.setItems(items);
  }

  get state(): PlaybackState {
    return this.items.length === 0 ? "empty" : "playing";
  }

  get currentItem(): PlaybackItem | null {
    return this.items[this.index] ?? null;
  }

  get currentIndex(): number {
    return this.index;
  }

  get itemCount(): number {
    return this.items.length;
  }

  /** Read-only snapshot of all items currently in the loop (e.g. for local expiration checks). */
  getItems(): PlaybackItem[] {
    return [...this.items];
  }

  /** Replaces the full item list (e.g. on manifest update), trying to stay on the same item by id. */
  setItems(items: PlaybackItem[]): void {
    const currentId = this.currentItem?.id;
    this.items = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const preservedIndex = currentId
      ? this.items.findIndex((i) => i.id === currentId)
      : -1;
    this.index = preservedIndex >= 0 ? preservedIndex : 0;
  }

  /** Advances to the next item, looping back to the first after the last. Used for both normal completion and error-skip. */
  advance(): void {
    if (this.items.length === 0) {
      this.index = 0;
      return;
    }
    this.index = (this.index + 1) % this.items.length;
  }

  /** A failed item must never stop playback — this just advances, same as normal completion. */
  reportError(_itemId: string): void {
    this.advance();
  }

  /** Removes an item (e.g. it just expired locally) without waiting for the next manifest sync. */
  removeItem(id: string): void {
    const wasCurrentId = this.currentItem?.id === id;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length === 0) {
      this.index = 0;
      return;
    }
    if (wasCurrentId) {
      this.index = this.index % this.items.length;
    } else {
      const currentId = this.currentItem?.id;
      const newIndex = currentId
        ? this.items.findIndex((i) => i.id === currentId)
        : 0;
      this.index = newIndex >= 0 ? newIndex : 0;
    }
  }
}
