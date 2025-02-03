import {formatInTimeZone} from "date-fns-tz";

export function addSeconds(numOfSeconds, date = new Date()) {
  date.setSeconds(date.getSeconds() + numOfSeconds);
  return date;
}

export function getTimeZone(time: string): string | undefined {
  const tzMatch = /([+-]\d{2}:\d{2})/.exec(time);
  return tzMatch?.[1];
}

export function getReadableTimeByTimeZone(time: string) {
  try {
    const timeZone = getTimeZone(time);
    return formatInTimeZone(new Date(time), timeZone, "do MMM, h:mm aa");
  } catch (e) {
    console.error(`Error formatting date ${time}`, e);
    return String(time);
  }
}
