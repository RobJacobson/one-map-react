/** Native Mapbox Maps SDK version used by the release consumers on both platforms. */
export const nativeMapboxSdkVersion = "11.23.1";

/**
 * Pins native SDK resolution through the wrapper's public Podfile/Gradle settings.
 * @param {string} podfile - Generated iOS Podfile.
 * @param {string} buildGradle - Generated root Android build.gradle.
 * @returns {{podfile: string, buildGradle: string}} Configurations with exact SDK pins.
 */
export const pinNativeMapboxVersion = (podfile, buildGradle) => {
  const iosSetting = `$RNMapboxMapsVersion = '= ${nativeMapboxSdkVersion}'`;
  const androidSetting = `RNMapboxMapsVersion = '${nativeMapboxSdkVersion}'`;
  const iosPattern = /^\s*\$RNMapboxMapsVersion\s*=.*$/m;
  const androidPattern = /^\s*RNMapboxMapsVersion\s*=.*$/m;
  const nextPodfile = iosPattern.test(podfile)
    ? podfile.replace(iosPattern, iosSetting)
    : `${iosSetting}\n${podfile}`;
  let nextBuildGradle;
  if (androidPattern.test(buildGradle)) {
    nextBuildGradle = buildGradle.replace(
      androidPattern,
      `        ${androidSetting}`
    );
  } else {
    const extBlock = /(buildscript\s*\{\s*ext\s*\{)/;
    if (!extBlock.test(buildGradle))
      throw new Error(
        "Generated Android build.gradle has no buildscript.ext block."
      );
    nextBuildGradle = buildGradle.replace(
      extBlock,
      `$1\n        ${androidSetting}`
    );
  }
  return { podfile: nextPodfile, buildGradle: nextBuildGradle };
};
