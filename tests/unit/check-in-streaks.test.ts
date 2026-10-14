import { describe, expect, it } from "vitest";

import { computeStreaks } from "@/worker/features/dashboard/service";

describe("computeStreaks", () => {
  it("returns zeros when there is no activity", () => {
    expect(computeStreaks([], "2026-10-14")).toEqual({
      current: 0,
      longest: 0,
      todayActive: false,
    });
  });

  it("counts a single active day", () => {
    expect(computeStreaks(["2026-10-14"], "2026-10-14")).toEqual({
      current: 1,
      longest: 1,
      todayActive: true,
    });
  });

  it("keeps the current streak alive when the run ends yesterday", () => {
    expect(
      computeStreaks(["2026-10-12", "2026-10-13"], "2026-10-14"),
    ).toEqual({
      current: 2,
      longest: 2,
      todayActive: false,
    });
  });

  it("stops the current streak after a full inactive day", () => {
    expect(computeStreaks(["2026-10-12"], "2026-10-14")).toEqual({
      current: 0,
      longest: 1,
      todayActive: false,
    });
  });

  it("finds the longest run across month boundaries", () => {
    expect(
      computeStreaks(
        ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-10"],
        "2026-10-14",
      ),
    ).toEqual({
      current: 0,
      longest: 4,
      todayActive: false,
    });
  });
});
