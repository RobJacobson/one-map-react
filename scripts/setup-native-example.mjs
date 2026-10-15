import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { foregroundLocationDeclarations } from "./native-location-permissions.mjs";

const root = resolve(import.meta.dirname, "..");

const examples = {
  "native-mapbox": {
    appName: "OneMapMapbox",
    directory: "examples/native-mapbox",
  },
  "native-maplibre": {
    appName: "OneMapMaplibre",
    directory: "examples/native-maplibre",
  },
};

const requested = process.argv[2];
const selected = requested ? { [requested]: examples[requested] } : examples;

if (requested && !examples[requested]) {
  throw new Error(
    `Unknown example ${requested}. Use native-mapbox or native-maplibre.`
  );
}

/**
 * Runs a process and throws when the exit status is nonzero.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
};

/**
 * Returns the generated project root written by `init`.
 *
 * @param {string} temp
 * @param {string} appName
 */
/**
 * The installed iOS SDK rejects an app that starts from a window. Write the
 * scene lifecycle into the generated React Native template.
 *
 * @param {string} exampleRoot
 * @param {string} appName
 */
/**
 * Xcode 27 rejects pod targets whose deployment target is below 15.0.
 *
 * @param {string} exampleRoot
 */
const raiseIosDeploymentTarget = (exampleRoot) => {
  const podfilePath = join(exampleRoot, "ios", "Podfile");
  const podfile = readFileSync(podfilePath, "utf8");
  const marker = "IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'";

  if (podfile.includes(marker)) return;

  const insertion = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target.nil? || deployment_target.to_f < 15.0
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
        end
      end
    end
    react_native_post_install(`;
  const patched = podfile.replace("    react_native_post_install(", insertion);

  if (patched === podfile) {
    throw new Error(
      `Could not raise the iOS deployment target in ${podfilePath}`
    );
  }

  writeFileSync(podfilePath, patched);
};

/**
 * RNMapbox resolves the Maps SDK from Mapbox's Maven repository.
 *
 * @param {string} exampleRoot
 */
const addMapboxMavenRepo = (exampleRoot) => {
  const buildGradlePath = join(exampleRoot, "android", "build.gradle");
  const buildGradle = readFileSync(buildGradlePath, "utf8");
  const repo = "https://api.mapbox.com/downloads/v2/releases/maven";

  if (buildGradle.includes(repo)) return;

  const patched = `${buildGradle}
allprojects {
    repositories {
        maven {
            url = "${repo}"
        }
    }
}
`;

  writeFileSync(buildGradlePath, patched);
};

const adoptSceneLifecycle = (exampleRoot, appName) => {
  const appDirectory = join(exampleRoot, "ios", appName);
  const delegate = `import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  let moduleName = "${appName}"

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = OneMapDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    return true
  }
}

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)

    factory.startReactNative(
      withModuleName: appDelegate.moduleName,
      in: window,
      launchOptions: appDelegate.launchOptions
    )

    self.window = window
    window.makeKeyAndVisible()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

class OneMapDependencyProvider: RCTAppDependencyProvider {
  override func unstableModulesRequiringMainQueueSetup() -> [String] {
    // RN 0.87.1 codegen lists its sample module, which this example does not link.
    // Preserve every other main-queue requirement and module lookup failure.
    super.unstableModulesRequiringMainQueueSetup().filter {
      $0 != "SampleTurboModule"
    }
  }
}
`;

  writeFileSync(join(appDirectory, "AppDelegate.swift"), delegate);

  const plistPath = join(appDirectory, "Info.plist");
  const originalPlist = readFileSync(plistPath, "utf8");
  // Generated iPhone shells default to portrait; TF07 also exercises rotation.
  const plist = originalPlist.replace(
    /(<key>UISupportedInterfaceOrientations<\/key>\s*<array>)([\s\S]*?)(<\/array>)/,
    (match, opening, body, closing) => {
      const missing = ["LandscapeLeft", "LandscapeRight"].filter(
        (orientation) => !body.includes(`UIInterfaceOrientation${orientation}`)
      );
      if (!missing.length) return match;
      return `${opening}${body.trimEnd()}${missing
        .map(
          (orientation) =>
            `\n\t\t<string>UIInterfaceOrientation${orientation}</string>`
        )
        .join("")}\n\t${closing}`;
    }
  );
  if (plist !== originalPlist) writeFileSync(plistPath, plist);

  if (plist.includes("UIApplicationSceneManifest")) {
    return;
  }

  const manifest = `	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
		<key>UISceneConfigurations</key>
		<dict>
			<key>UIWindowSceneSessionRoleApplication</key>
			<array>
				<dict>
					<key>UISceneConfigurationName</key>
					<string>Default Configuration</string>
					<key>UISceneDelegateClassName</key>
					<string>SceneDelegate</string>
				</dict>
			</array>
		</dict>
	</dict>
`;
  const patched = plist.replace(
    "\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>\n</dict>",
    `\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>\n${manifest}</dict>`
  );

  if (patched === plist) {
    throw new Error(`Could not add a scene manifest to ${plistPath}`);
  }

  writeFileSync(plistPath, patched);
};

const generatedRoot = (temp, appName) => {
  if (existsSync(join(temp, "ios")) && existsSync(join(temp, "android"))) {
    return temp;
  }

  const nested = join(temp, appName);

  if (existsSync(join(nested, "ios")) && existsSync(join(nested, "android"))) {
    return nested;
  }

  throw new Error(`Generator did not write ios/ and android/ under ${temp}`);
};

for (const [key, { appName, directory }] of Object.entries(selected)) {
  const exampleRoot = join(root, directory);
  const temp = mkdtempSync(join(tmpdir(), `${key}-`));

  try {
    run(
      "bunx",
      [
        "@react-native-community/cli@20.2.0",
        "init",
        appName,
        "--version",
        "0.87.1",
        "--directory",
        temp,
        "--pm",
        "bun",
        "--skip-git-init",
        "--skip-install",
        "--install-pods",
        "false",
      ],
      root
    );

    const generated = generatedRoot(temp, appName);

    for (const tree of ["ios", "android"]) {
      const from = join(generated, tree);
      const to = join(exampleRoot, tree);

      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
    }

    const gemfile = join(generated, "Gemfile");

    if (!existsSync(gemfile)) {
      throw new Error(`Generator did not write Gemfile for ${key}`);
    }

    cpSync(gemfile, join(exampleRoot, "Gemfile"));

    raiseIosDeploymentTarget(exampleRoot);

    if (key === "native-mapbox") {
      addMapboxMavenRepo(exampleRoot);
    }

    if (key === "native-maplibre") {
      const podfilePath = join(exampleRoot, "ios", "Podfile");
      const podfile = readFileSync(podfilePath, "utf8");

      if (!podfile.includes("$MLRN.post_install")) {
        const patched = podfile.replace(
          "    react_native_post_install(",
          `    $MLRN.post_install(installer)
    # MapLibre 11.5 uses quoted React headers; RN 0.87 ships them in a prebuilt framework.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'MapLibreReactNative'
      target.build_configurations.each do |config|
        headers = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
        config.build_settings['HEADER_SEARCH_PATHS'] = [headers, '$(PODS_XCFRAMEWORKS_BUILD_DIR)/React-Core-prebuilt/React.framework/Headers'].flatten
      end
    end
    react_native_post_install(`
        );

        if (patched === podfile) {
          throw new Error("Could not add MapLibre post_install to the Podfile");
        }

        writeFileSync(podfilePath, patched);
      }
    }

    adoptSceneLifecycle(exampleRoot, appName);
    const plistPath = join(exampleRoot, "ios", appName, "Info.plist");
    const manifestPath = join(
      exampleRoot,
      "android",
      "app",
      "src",
      "main",
      "AndroidManifest.xml"
    );
    const declarations = foregroundLocationDeclarations(
      readFileSync(plistPath, "utf8"),
      readFileSync(manifestPath, "utf8")
    );
    writeFileSync(plistPath, declarations.plist);
    writeFileSync(manifestPath, declarations.manifest);
    console.log(`Wrote ios/, android/, and Gemfile for ${key}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
