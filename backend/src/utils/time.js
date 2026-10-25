export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reject if `promise` takes longer than `ms`. The work behind it is abandoned, never awaited forever. */
export function withDeadline(promise, ms, label = 'Operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
      e.code = 'TIMEOUT';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
