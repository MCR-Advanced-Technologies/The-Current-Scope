import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getHourlyDetailPoint } from "../src/components/weather/hourlyDetail.mjs";

describe("getHourlyDetailPoint", () => {
  const hours = [
    { ts: 1, tempF: 40 },
    { ts: 2, tempF: 41 },
  ];

  it("returns null for invalid inputs", () => {
    assert.equal(getHourlyDetailPoint(null, 0), null);
    assert.equal(getHourlyDetailPoint(hours, -1), null);
    assert.equal(getHourlyDetailPoint(hours, 5), null);
    assert.equal(getHourlyDetailPoint(hours, "x"), null);
  });

  it("returns the selected point", () => {
    assert.deepEqual(getHourlyDetailPoint(hours, 1), hours[1]);
  });
});