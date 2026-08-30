/**
 * DI-9.4.3B — optional query-count instrumentation for scale tests.
 * Disabled by default. Never logs SQL values or secrets.
 */
let enabled = false;
let counts = new Map<string, number>();

export function enableQueryCountInstrumentation(): void {
  enabled = true;
  counts = new Map();
}

export function disableQueryCountInstrumentation(): void {
  enabled = false;
  counts = new Map();
}

export function resetQueryCounts(): void {
  counts = new Map();
}

export function recordQuery(label: string): void {
  if (!enabled) return;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

export function getQueryCounts(): Record<string, number> {
  return Object.fromEntries(counts.entries());
}

export function getTotalQueryCount(): number {
  let total = 0;
  for (const n of counts.values()) total += n;
  return total;
}

/** Wrap a DatabaseClient so every delegate call increments a counter. Uses Proxy so getter-based fakes still work. */
export function instrumentDatabaseClient<T extends object>(db: T): T {
  if (!enabled) return db;
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === "$transaction") {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        return async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
          recordQuery("$transaction");
          return (value as (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => Promise<unknown>).call(
            target,
            (tx) => fn(instrumentDatabaseClient(tx as object)),
            options
          );
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (value && typeof value === "object") {
        return new Proxy(value as object, {
          get(delegate, method, delegateReceiver) {
            const fn = Reflect.get(delegate, method, delegateReceiver);
            if (typeof fn !== "function") return fn;
            return (...args: unknown[]) => {
              recordQuery(`${String(prop)}.${String(method)}`);
              return (fn as (...a: unknown[]) => unknown).apply(delegate, args);
            };
          },
        });
      }
      return value;
    },
  }) as T;
}
