import { describe, it, expect } from "vitest";
import { thcMgForLine, holidayInfo, type ThcLineInput } from "./pos-calculations";

function line(overrides: Partial<ThcLineInput>): ThcLineInput {
  return {
    unit: "lb",
    quantity: 1,
    thcPercent: null,
    thcMgPerUnit: null,
    ...overrides,
  };
}

describe("thcMgForLine", () => {
  it("converts weight-based flower via mass", () => {
    // 1 lb at 20% THC -> 453.592g * 0.20 * 1000mg/g = 90718.4mg
    const mg = thcMgForLine(line({ thcPercent: 20, unit: "lb", quantity: 1 }));
    expect(mg).toBeCloseTo(90718.4, 1);
  });

  it("scales with quantity", () => {
    const mg = thcMgForLine(line({ thcPercent: 20, unit: "lb", quantity: 2 }));
    expect(mg).toBeCloseTo(90718.4 * 2, 1);
  });

  it("uses thcMgPerUnit directly for unit-counted products", () => {
    const mg = thcMgForLine(line({ thcMgPerUnit: 10, quantity: 3, unit: "each" }));
    expect(mg).toBe(30);
  });

  it("returns null for liquid concentrate (no mass-based conversion)", () => {
    const mg = thcMgForLine(line({ thcPercent: 80, unit: "liter" }));
    expect(mg).toBeNull();
  });

  it("returns null when neither thcPercent nor thcMgPerUnit is set", () => {
    const mg = thcMgForLine(line({}));
    expect(mg).toBeNull();
  });
});

describe("holidayInfo", () => {
  // Regression cases for the real bug found and fixed earlier in this
  // project (CLAUDE.md §24 addendum): the first version picked whichever
  // holiday matched first in array order, letting New Year's Eve win over
  // an exact match on New Year's Day since Eve was checked first and its
  // grace window overlapped. Fixed to pick the closest holiday by distance.
  it("picks New Year's Day on an exact match, not New Year's Eve", () => {
    const result = holidayInfo(new Date(2026, 0, 1));
    expect(result.greeting).toBe("Happy New Year!");
  });

  it("picks New Year's Eve on an exact match", () => {
    const result = holidayInfo(new Date(2025, 11, 31));
    expect(result.greeting).toBe("Happy New Year's Eve!");
  });

  it("computes Easter's date rather than using a fixed one (2026 = April 5)", () => {
    const result = holidayInfo(new Date(2026, 3, 5));
    expect(result.greeting).toBe("Happy Easter!");
  });

  it("computes Thanksgiving as the 4th Thursday of November (2026 = Nov 26)", () => {
    const result = holidayInfo(new Date(2026, 10, 26));
    expect(result.greeting).toBe("Happy Thanksgiving!");
  });

  it("falls back to a seasonal greeting far from any holiday", () => {
    const result = holidayInfo(new Date(2026, 7, 15)); // mid-August
    expect(result.greeting).toBe("Enjoy the summer!");
  });

  it("falls back across a year boundary correctly (early January, past New Year's grace)", () => {
    const result = holidayInfo(new Date(2026, 0, 10));
    expect(result.greeting).not.toBe("Happy New Year!");
  });
});
