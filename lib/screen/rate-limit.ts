/**
 * In-memory sliding-window rate limiter, keyed by IP.
 *
 * MVP LIMITATION: this only limits attempts within a single server process.
 * On Vercel's serverless/edge runtime, each instance has its own memory, so
 * this does not enforce a global limit across instances. It's sufficient to
 * blunt naive brute-forcing during MVP, but should move to a shared store
 * (e.g. Upstash Redis) before this matters for real security guarantees.
 */
const attempts = new Map<string, number[]>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

export function isRateLimited(key: string, now: number = Date.now()): boolean {
  const timestamps = (attempts.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  timestamps.push(now);
  attempts.set(key, timestamps);
  return timestamps.length > MAX_ATTEMPTS_PER_WINDOW;
}
