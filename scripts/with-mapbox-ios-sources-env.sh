#!/bin/sh
set -eu
# Copy beside retained runtime-bin; the short alias avoids long Xcode paths.
task_root=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export RUBYLIB="$task_root/ios-ruby/bundler-load-path"
export BUNDLE_PATH="$task_root/ios-ruby/gems"
export BUNDLE_GEMFILE="$task_root/ios-ruby/Gemfile"
export PATH="$task_root/runtime-bin:/opt/homebrew/opt/ruby/bin:/opt/homebrew/bin:$PATH"
export TF05_IOS_BUILD_FOLDER=/private/tmp/one-map-f05-ios/native-harness/examples/native-mapbox/ios/build
export TF05_IOS_UDID=8B7D7CE4-228E-409F-A156-A597D4E448A5
unset TF05_ANDROID_BINARY_SHA256
exec "$@"
