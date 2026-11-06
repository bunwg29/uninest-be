export const doTimeRangesOverlap = (
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) => firstStart < secondEnd && firstEnd > secondStart;

export const isCancellationReasonRequired = (
  startTime: Date,
  now: Date,
  cancelFreeHours: number,
) => (startTime.getTime() - now.getTime()) / 3_600_000 < cancelFreeHours;
