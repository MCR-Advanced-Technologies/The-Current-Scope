import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getHourlyForecastCardState } from "../src/components/weather/hourlyCardState.mjs";

describe("getHourlyForecastCardState", () => {
  it("returns ready when hours are present", () => {
    const state = getHourlyForecastCardState({
      loading: false,
      error: "",
      hours: Array.from({ length: 12 }).map((_, i) => ({ timeISO: `t${i}` })),
    });
    assert.equal(state, "ready");
  });

  it("returns empty when no data and no error", () => {
    const state = getHourlyForecastCardState({
      loading: false,
      error: "",
      hours: [],
    });
    assert.equal(state, "empty");
  });
});
