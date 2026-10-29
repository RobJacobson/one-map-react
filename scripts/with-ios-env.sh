#!/bin/sh
set -eu
# Copy beside the retained task runtime and Ruby directories before execution.
task_root=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
export RUBYLIB="$task_root/ruby-bundler-load-path"
export BUNDLE_PATH="$task_root/ruby-gems"
export PATH="$task_root/runtime-bin:/opt/homebrew/bin:$PATH"
export TF06_IOS_BUILD_FOLDER="$task_root/native-harness/examples/native-mapbox/ios/build"
export TF06_IOS_UDID=8B7D7CE4-228E-409F-A156-A597D4E448A5
unset TF06_IOS_BINARY_SHA256
: "${MAPBOX_ACCESS_TOKEN:?Inherit the existing Mapbox token}"
exec "$@"
