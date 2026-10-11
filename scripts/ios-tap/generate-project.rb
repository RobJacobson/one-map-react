require "fileutils"
require "xcodeproj"

root = File.expand_path(__dir__)
project_path = File.join(root, "TapDriver.xcodeproj")
FileUtils.rm_rf(project_path)
project = Xcodeproj::Project.new(project_path)
app = project.new_target(:application, "TapDriver", :ios, "17.0", nil, :swift)
tests = project.new_target(:ui_test_bundle, "TapDriverUITests", :ios, "17.0", nil, :swift)
tests.add_dependency(app)

app_group = project.main_group.new_group("TapDriver", "TapDriver")
test_group = project.main_group.new_group("TapDriverUITests", "TapDriverUITests")
app_file = app_group.new_file("TapDriverApp.swift")
test_file = test_group.new_file("TapDriver.swift")
app.add_file_references([app_file])
tests.add_file_references([test_file])

settings = {
  "GENERATE_INFOPLIST_FILE" => "YES",
  "SWIFT_VERSION" => "5.0",
  "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
  "TARGETED_DEVICE_FAMILY" => "1",
  "CODE_SIGN_STYLE" => "Automatic",
  "CODE_SIGNING_ALLOWED" => "YES",
  "DEVELOPMENT_TEAM" => "",
}

app.build_configurations.each do |config|
  config.build_settings.merge!(settings)
  config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.onemap.tapdriver"
  config.build_settings["INFOPLIST_KEY_UILaunchScreen_Generation"] = "YES"
  config.build_settings["INFOPLIST_KEY_UIApplicationSceneManifest_Generation"] = "YES"
end

tests.build_configurations.each do |config|
  config.build_settings.merge!(settings)
  config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.onemap.tapdriver.uitests"
  config.build_settings["TEST_TARGET_NAME"] = "TapDriver"
end

project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(tests)
scheme.save_as(project_path, "TapDriver", true)
