import { describe, it, expect } from "vitest";
import { PlaybackEngine, type PlaybackItem } from "@/player/PlaybackEngine";

function item(overrides: Partial<PlaybackItem> = {}): PlaybackItem {
  return {
    id: "item_1",
    type: "image",
    url: "https://example.com/a.jpg",
    hash: "abc",
    duration: 8,
    expiresAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("PlaybackEngine", () => {
  it("starts empty with no items", () => {
    const engine = new PlaybackEngine([]);
    expect(engine.state).toBe("empty");
    expect(engine.currentItem).toBeNull();
  });

  it("advances from an image after its configured duration (i.e. when advance() is called)", () => {
    const items = [
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ];
    const engine = new PlaybackEngine(items);
    expect(engine.currentItem?.id).toBe("a");
    engine.advance(); // simulates the image's timer firing
    expect(engine.currentItem?.id).toBe("b");
  });

  it("advances on video end (advance() called from onEnded)", () => {
    const items = [
      item({ id: "a", type: "video", duration: null, sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ];
    const engine = new PlaybackEngine(items);
    engine.advance(); // simulates the video element's onEnded firing
    expect(engine.currentItem?.id).toBe("b");
  });

  it("skips a failed item and continues rather than stopping playback", () => {
    const items = [
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
      item({ id: "c", sortOrder: 2 }),
    ];
    const engine = new PlaybackEngine(items);
    engine.reportError("a");
    expect(engine.currentItem?.id).toBe("b");
    expect(engine.state).toBe("playing"); // never stops
  });

  it("loops back to the first item after the last", () => {
    const items = [
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ];
    const engine = new PlaybackEngine(items);
    engine.advance(); // -> b
    engine.advance(); // -> should loop back to a
    expect(engine.currentItem?.id).toBe("a");
  });

  it("sorts items by sortOrder regardless of input order", () => {
    const items = [
      item({ id: "b", sortOrder: 1 }),
      item({ id: "a", sortOrder: 0 }),
    ];
    const engine = new PlaybackEngine(items);
    expect(engine.currentItem?.id).toBe("a");
  });

  it("preserves the current item across setItems when it's still present", () => {
    const engine = new PlaybackEngine([
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ]);
    engine.advance(); // now on b
    engine.setItems([
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
      item({ id: "c", sortOrder: 2 }),
    ]);
    expect(engine.currentItem?.id).toBe("b");
  });

  it("resets to the first item when the current item was removed by a manifest update", () => {
    const engine = new PlaybackEngine([
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ]);
    engine.advance(); // now on b
    engine.setItems([item({ id: "a", sortOrder: 0 })]); // b was deleted
    expect(engine.currentItem?.id).toBe("a");
  });

  it("removeItem drops an expired item and moves on without stopping", () => {
    const engine = new PlaybackEngine([
      item({ id: "a", sortOrder: 0 }),
      item({ id: "b", sortOrder: 1 }),
    ]);
    engine.removeItem("a");
    expect(engine.currentItem?.id).toBe("b");
    expect(engine.itemCount).toBe(1);
  });

  it("removeItem leaves the engine empty when the last item expires", () => {
    const engine = new PlaybackEngine([item({ id: "a", sortOrder: 0 })]);
    engine.removeItem("a");
    expect(engine.state).toBe("empty");
    expect(engine.currentItem).toBeNull();
  });

  it("becomes non-empty again once new items arrive via setItems", () => {
    const engine = new PlaybackEngine([]);
    expect(engine.state).toBe("empty");
    engine.setItems([item({ id: "a", sortOrder: 0 })]);
    expect(engine.state).toBe("playing");
    expect(engine.currentItem?.id).toBe("a");
  });
});
