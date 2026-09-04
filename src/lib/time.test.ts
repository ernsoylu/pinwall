import { describe, expect, it } from "vitest";
import { dateStamp, relativeTime } from "./time";

const now = new Date("2026-09-04T12:00:00Z").getTime();
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe("relativeTime", () => {
  it.each([
    [ago(5), "5 seconds ago"],
    [ago(90), "2 minutes ago"],
    [ago(3 * 3600), "3 hours ago"],
    [ago(2 * 86400), "2 days ago"],
    [ago(60 * 86400), "2 months ago"],
    [ago(400 * 86400), "last year"],
    [ago(800 * 86400), "2 years ago"],
  ])("formats %s as %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });

  it("handles a pin created this instant", () => {
    expect(relativeTime(ago(0), now)).toBe("now");
  });

  it("returns the raw value for an unparseable timestamp", () => {
    expect(relativeTime("not-a-date", now)).toBe("not-a-date");
  });
});

describe("dateStamp", () => {
  it("pads the day and uppercases the month", () => {
    expect(dateStamp("2026-09-04T12:00:00Z")).toBe("04 SEP 2026");
  });

  it("keeps a fixed width for a two-digit day", () => {
    expect(dateStamp("2026-12-25T00:00:00Z")).toHaveLength("04 SEP 2026".length);
  });

  it("falls back for an unparseable timestamp", () => {
    expect(dateStamp("not-a-date")).toBe("——");
  });
});
