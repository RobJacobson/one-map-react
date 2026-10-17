/**
 * Adds foreground declarations to generated example shells without overwriting app text.
 *
 * @param {string} plist - Generated iOS Info.plist XML.
 * @param {string} manifest - Generated Android manifest XML.
 * @returns {{plist: string, manifest: string}} Updated platform declarations.
 */
export const foregroundLocationDeclarations = (plist, manifest) => {
  let nextPlist = plist;
  if (!plist.includes("<key>NSLocationWhenInUseUsageDescription</key>")) {
    if (!plist.includes("<dict>"))
      throw new Error("Generated Info.plist has no root dictionary.");
    nextPlist = plist.replace(
      "<dict>",
      "<dict>\n\t<key>NSLocationWhenInUseUsageDescription</key>\n\t<string>Show your location and follow it on the map when you choose Locate.</string>"
    );
  }
  let nextManifest = manifest;
  for (const permission of ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]) {
    if (manifest.includes(`android.permission.${permission}`)) continue;
    if (!/<application\b/.test(nextManifest))
      throw new Error("Generated Android manifest has no application.");
    nextManifest = nextManifest.replace(
      /<application\b/,
      `<uses-permission android:name="android.permission.${permission}" />\n    <application`
    );
  }
  return { plist: nextPlist, manifest: nextManifest };
};
