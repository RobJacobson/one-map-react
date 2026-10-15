import assert from "node:assert/strict";

/** Counts distinct fixture pixels without requiring identical color profiles. */
export const observeCoveragePixels = ({ data }) => {
  const result = { green: 0, blue: 0, yellow: 0, bright: 0 };
  for (let offset = 0; offset < data.length; offset += 4) {
    const [r, g, b, a] = data.subarray(offset, offset + 4);
    if (a < 200) continue;
    if (g > 200 && g > r * 2.5 && g > b * 2.5) result.green += 1;
    if (r < 100 && g > 65 && g < 200 && b > 190) result.blue += 1;
    if (r > 200 && g > 200 && b < 90) result.yellow += 1;
    if (r > 180 && g > 180 && b > 180) result.bright += 1;
  }
  return result;
};

/** Inclusion is observed only after independently proving the content is visible. */
export const captureInclusion = (baseline, live, exported, color) => {
  const liveDelta = live[color] - baseline.live[color];
  const exportDelta = exported[color] - baseline.exported[color];
  assert(
    liveDelta > 60,
    `The ${color} test content was not established on screen: ${liveDelta}.`
  );
  return { liveDelta, exportDelta, included: exportDelta > 60 };
};
