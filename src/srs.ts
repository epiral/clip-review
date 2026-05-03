export interface SRSState {
  interval: number;
  ease: number;
  repetitions: number;
  due_at: number;
}

export function nextSRS(current: SRSState, rating: number, now: number): SRSState {
  let { interval, ease, repetitions } = current;

  if (rating === 1) {
    repetitions = 0;
    interval = 1 / 1440; // ~1 minute in days, re-show soon
  } else if (rating === 2) {
    repetitions += 1;
    if (repetitions <= 1) {
      interval = 1 / 1440;
    } else if (repetitions === 2) {
      interval = 1;
    } else {
      interval = interval * 1.2;
    }
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === 3) {
    repetitions += 1;
    if (repetitions <= 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = interval * ease;
    }
  } else {
    // rating === 4
    repetitions += 1;
    if (repetitions <= 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = interval * ease * 1.3;
    }
    ease += 0.15;
  }

  const due_at = now + Math.round(interval * 86400);

  return { interval, ease, repetitions, due_at };
}
