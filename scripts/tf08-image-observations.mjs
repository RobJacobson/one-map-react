/** Counts the known fixture colors in decoded eight-bit RGBA samples. */
export const observeFixturePixels = ({ width, height, data }) => {
  const result = {
    width,
    height,
    red: 0,
    blue: 0,
    green: 0,
    navy: 0,
    magenta: 0,
  };
  for (let offset = 0; offset < data.length; offset += 4) {
    const [r, g, b] = data.subarray(offset, offset + 3);
    // iOS capture may encode Display P3 samples (red is approximately 234/51/35).
    // Compare channel dominance so the known fixture colors survive its profile.
    if (r > 200 && r > g * 2.5 && r > b * 2.5) result.red += 1;
    if (r < 90 && g > 80 && g < 180 && b > 190) result.blue += 1;
    if (g > 200 && g > r * 2.5 && g > b * 2.5) result.green += 1;
    if (Math.abs(r - 15) < 5 && Math.abs(g - 25) < 5 && Math.abs(b - 40) < 5)
      result.navy += 1;
    if (r > 200 && b > 200 && g < 100) result.magenta += 1;
  }
  return result;
};
