/** Small injectable RAF clock. stop() invalidates even an already queued callback. */
export interface ClockPlatform {
  request: (cb: (now: number) => void) => number;
  cancel: (id: number) => void;
  now: () => number;
}
export function createDateClock(platform: ClockPlatform, onDays: (days: number) => void) {
  let running = false,
    handle = 0,
    generation = 0,
    last = 0,
    remainder = 0;
  function stop() {
    running = false;
    generation++;
    platform.cancel(handle);
  }
  function start(speed: number) {
    stop();
    running = true;
    const token = generation;
    last = platform.now();
    remainder = 0;
    const tick = (now: number) => {
      if (!running || token !== generation) return;
      remainder += (Math.min(Math.max(now - last, 0), 250) * speed * 4) / 1000;
      last = now;
      const days = Math.floor(remainder);
      if (days) {
        remainder -= days;
        onDays(days);
      }
      if (running && token === generation) handle = platform.request(tick);
    };
    handle = platform.request(tick);
  }
  return { start, stop };
}
