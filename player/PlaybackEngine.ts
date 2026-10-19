import { selectPlayable, type ScheduleRule } from "@/lib/schedule/schedule";

export interface PlaybackItem {
  id: string;
  type: "image" | "video";
  url: string;
  hash: string;
  duration: number | null; // seconds, images only
  expiresAt: string | null; // ISO string
  sortOrder: number;
  schedule?: ScheduleRule[] | null; // absent / empty = default content (no schedule)
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
  // `allItems` is everything the manifest says exists (minus locally
  // expired items). `items` is the subset that may play RIGHT NOW given
  // each item's schedule — it is what the loop actually cycles through.
  private allItems: PlaybackItem[] = [];
  private items: PlaybackItem[] = [];
  private index = 0;
  private timeZone = "UTC";

  constructor(items: PlaybackItem[] = [], timeZone = "UTC") {
    this.setItems(items, timeZone);
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

  /** Number of items playable right now. */
  get itemCount(): number {
    return this.items.length;
  }

  /** Number of items the screen has at all (playable now or not). */
  get totalCount(): number {
    return this.allItems.length;
  }

  /** Read-only snapshot of ALL items, scheduled or not (e.g. for local expiration checks). */
  getItems(): PlaybackItem[] {
    return [...this.allItems];
  }

  /** Replaces the full item list (e.g. on manifest update), trying to stay on the same item by id. */
  setItems(items: PlaybackItem[], timeZone?: string, now: Date = new Date()): void {
    if (timeZone) this.timeZone = timeZone;
    this.allItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    this.applySchedule(now);
  }

  /**
   * Re-evaluates schedules against `now`. Call periodically (and the
   * player does) so slots start/end on time even with no manifest change
   * and no network. Returns true if the playable set changed. If the item
   * currently on screen is still playable it keeps playing; otherwise the
   * loop restarts from the first playable item.
   */
  refresh(now: Date = new Date()): boolean {
    const before = this.items.map((i) => i.id).join("|");
    this.applySchedule(now);
    return before !== this.items.map((i) => i.id).join("|");
  }

  private applySchedule(now: Date): void {
    const currentId = this.currentItem?.id;
    this.items = selectPlayable(this.allItems, now, this.timeZone);
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
  removeItem(id: string, now: Date = new Date()): void {
    const wasCurrent = this.currentItem?.id === id;
    const previousIndex = this.index;
    this.allItems = this.allItems.filter((i) => i.id !== id);
    this.applySchedule(now);
    // Dropping the item on screen moves on to whatever followed it,
    // rather than restarting the loop from the top.
    if (wasCurrent && this.items.length > 0) {
      this.index = previousIndex % this.items.length;
    }
  }
}
