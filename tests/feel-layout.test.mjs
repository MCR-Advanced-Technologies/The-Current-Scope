import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("feel card stability css", () => {
  it("keeps tooltip styles and card min-heights", () => {
    assert.match(css, /\[data-tooltip\]:hover::after/);
    assert.match(css, /\.wf-hourly-card\s*\{[^}]*min-height:/s);
    assert.match(css, /\.wf-daily-card\s*\{[^}]*min-height:/s);
    assert.match(css, /\.weather-insight-card\.radar-card\s*\{[^}]*min-height:/s);
  });
});