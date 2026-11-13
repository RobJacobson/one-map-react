import assert from "node:assert/strict";

import { modelGlb, modelPixels } from "./tf10-model-fixture.mjs";
import {
  runLightColorAcceptance,
  runModelAcceptance,
  runGlobalStateAcceptance,
} from "./tf10-selected-acceptance.mjs";

const glb = modelGlb([1, 0, 1]);
assert.equal(glb.readUInt32LE(0), 0x46546c67);
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.length);
const jsonLength = glb.readUInt32LE(12);
assert.equal(jsonLength % 4, 0);
const gltf = JSON.parse(glb.toString("utf8", 20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;
assert.equal(glb.length - binaryOffset, gltf.buffers[0].byteLength);
for (const view of gltf.bufferViews) {
  assert(view.byteOffset + view.byteLength <= gltf.buffers[0].byteLength);
}
assert.deepEqual(
  gltf.materials[0].pbrMetallicRoughness.baseColorFactor,
  [1, 0, 1, 1]
);
assert.notDeepEqual(glb, modelGlb([0, 1, 1]));
const positions = gltf.bufferViews[0];
for (let index = 0; index < positions.byteLength / 4; index += 1) {
  const value = glb.readFloatLE(binaryOffset + index * 4);
  const axis = index % 3;
  assert(
    value >= gltf.accessors[0].min[axis] && value <= gltf.accessors[0].max[axis]
  );
}
for (let index = 0; index < gltf.accessors[1].count; index += 1) {
  assert(
    glb.readUInt16LE(
      binaryOffset + gltf.bufferViews[1].byteOffset + index * 2
    ) < 8
  );
}

const rectangle = (width, height, color) => {
  const data = Buffer.alloc(100 * 100 * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centerX = Math.floor((100 - width) / 2);
      const centerY = Math.floor((100 - height) / 2);
      const offset = ((y + centerY) * 100 + x + centerX) * 4;
      data[offset] = color === "magenta" ? 255 : 0;
      data[offset + 1] = color === "cyan" ? 255 : 0;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }
  return { data, width: 100, height: 100 };
};
assert.deepEqual(modelPixels(rectangle(20, 10, "magenta"), "magenta"), {
  count: 200,
  width: 20,
  height: 10,
});
assert.equal(modelPixels(rectangle(20, 10, "cyan"), "magenta").count, 0);
const verify = async (fault) => {
  let preset = "hidden";
  const dimensions = {
    hidden: [0, 0],
    visible: [20, 10],
    scaled: fault === "scale" ? [20, 10] : [40, 20],
    rotated: fault === "rotation" ? [40, 20] : [20, 40],
    transparent: fault === "opacity" ? [20, 40] : [0, 0],
    replaced: [20, 40],
  };
  return runModelAcceptance({
    action: async (name, value) => {
      if (name === "model") preset = value.preset;
      return { loads: 1, center: [0, 0], zoom: 18, preset };
    },
    capture: async () =>
      rectangle(
        ...dimensions[preset],
        preset === "replaced" ? "cyan" : "magenta"
      ),
    until: async (observe) => {
      assert(await observe(), "Independent image predicate rejected.");
    },
  });
};
await verify();
for (const fault of ["scale", "rotation", "opacity"]) {
  await assert.rejects(() => verify(fault), /Model .*pixel observation/);
}
console.log(
  "PASS selected model fixture: valid self-contained GLB, color bounds, and rejection of missing scale/rotation/opacity effects."
);

const verifyGlobalState = async (fault) => {
  let color = "#ff00ff";
  let revision = 0;
  return runGlobalStateAcceptance({
    action: async (name, value = {}) => {
      if (name === "replace-style") revision += 1;
      if (name === "set")
        color =
          value.color === null
            ? fault === "reset"
              ? null
              : "#00ffff"
            : value.color;
      return {
        loads: 1,
        styleLoads: revision + 1,
        style: { name: `global-state-${revision}` },
        globalState: {
          color,
          initial: fault === "initial-style" ? undefined : 6014,
        },
      };
    },
    capture: async () =>
      rectangle(100, 100, color === "#ff00ff" ? "magenta" : "cyan"),
    until: async (observe) => {
      assert(await observe(), "Independent global-state predicate rejected.");
    },
  });
};
const globalStateResult = await verifyGlobalState();
assert.equal(globalStateResult.initialStyle.globalState.initial, 6014);
assert.equal(globalStateResult.initialStyle.globalState.color, "#ff00ff");
assert.equal(globalStateResult.reset.globalState.color, "#00ffff");
for (const fault of ["initial-style", "reset"]) {
  await assert.rejects(
    () => verifyGlobalState(fault),
    /Independent global-state predicate rejected/
  );
}
console.log(
  "PASS selected global-state observer rejects absent initial style state and broken null reset."
);

const profiled = rectangle(20, 40, "cyan");
for (let offset = 0; offset < profiled.data.length; offset += 4) {
  if (profiled.data[offset + 3] === 255) {
    profiled.data[offset] = 117;
    profiled.data[offset + 1] = 251;
    profiled.data[offset + 2] = 253;
  }
}
// Actual iOS UIGraphics capture values retain the model hue with a lifted red channel.
assert.equal(modelPixels(profiled, "cyan", 0.2).count, 800);
const ornamentOffset = (95 * 100 + 95) * 4;
profiled.data.set([0, 255, 255, 255], ornamentOffset);
assert.equal(modelPixels(profiled, "cyan").count, 801);
assert.equal(modelPixels(profiled, "cyan", 0.2).count, 800);
console.log(
  "PASS iOS capture calibration: lifted color channel and out-of-model ornament do not hide or imitate the centered model."
);

/** Exercises the real light observer with independent synthetic captures. */
const checkLight = async (fault) => {
  let color = "blue";
  let styleLoads = 1;
  return runLightColorAcceptance({
    action: async (name, value) => {
      if (name === "light-color") {
        color = value.color;
        return true;
      }
      if (name === "replace-style") {
        if (fault !== "style") styleLoads += 1;
        return true;
      }
      assert.equal(name, "light-read");
      return {
        enabled: true,
        color: { blue: "#0000ff", green: "#00ff00", white: "#ffffff" }[color],
        styleLoads,
        features: fault === "feature" ? [] : [{ id: 9010 }],
      };
    },
    capture: async () => {
      const image = { width: 100, height: 100, data: Buffer.alloc(40000) };
      const channels =
        fault === "red"
          ? [255, 0, 0]
          : fault === "stale"
            ? [0, 0, 255]
            : { blue: [0, 0, 255], green: [0, 255, 0], white: [255, 255, 255] }[
                color
              ];
      for (let y = 0; y < 100; y += 1)
        for (let x = 0; x < 100; x += 1) {
          // Blue SDK ornament pixels at the edge must never certify a light color.
          const rgb =
            x < 10
              ? [0, 0, 255]
              : x >= 30 && x < 70 && y >= 30 && y < 70
                ? channels
                : [23, 50, 77];
          image.data.set([...rgb, 255], (y * 100 + x) * 4);
        }
      return image;
    },
    until: async (observe) => {
      let failure;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          if (await observe()) return;
        } catch (error) {
          failure = error;
        }
      }
      throw failure ?? new Error("Light observation did not settle");
    },
  });
};
const lights = await checkLight();
assert(
  lights.blue.pixels.blue > 100 &&
    lights.green.pixels.green > 100 &&
    lights.white.pixels.white > 100
);
assert(lights.replaced.styleLoads > lights.green.styleLoads);
for (const fault of ["red", "stale", "style", "feature"])
  await assert.rejects(checkLight(fault));
console.log(
  "PASS light-color observer: actual colored pixels and feature required; rejects red fallback, stale colors, missing style replacement and absent feature; edge ornaments excluded."
);
