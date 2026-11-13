/** Builds a small self-contained rectangular glTF box with an unlit material. */
export const modelGlb = (color) => {
  const vertices = new Float32Array([
    -10, 0, -4, 10, 0, -4, 10, 4, -4, -10, 4, -4, -10, 0, 4, 10, 0, 4, 10, 4, 4,
    -10, 4, 4,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0,
    3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ]);
  const binary = Buffer.concat([
    Buffer.from(vertices.buffer),
    Buffer.from(indices.buffer),
  ]);
  const gltf = {
    asset: { version: "2.0", generator: "one-map model acceptance fixture" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [
      {
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: {
          baseColorFactor: [...color, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: vertices.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: vertices.byteLength,
        byteLength: indices.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-10, 0, -4],
        max: [10, 4, 4],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
        min: [0],
        max: [7],
      },
    ],
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.concat([
    json,
    Buffer.alloc((4 - (json.length % 4)) % 4, 32),
  ]);
  const result = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20);
  const offset = 20 + padded.length;
  result.writeUInt32LE(binary.length, offset);
  result.writeUInt32LE(0x004e4942, offset + 4);
  binary.copy(result, offset + 8);
  return result;
};

/** Measures model-colored pixels independently of fixture state or native props. */
export const modelPixels = (image, color, insetFraction = 0) => {
  let count = 0;
  let minX = image.width,
    minY = image.height,
    maxX = -1,
    maxY = -1;
  const insetX = Math.floor(image.width * insetFraction);
  const insetY = Math.floor(image.height * insetFraction);
  for (let y = insetY; y < image.height - insetY; y += 1) {
    for (let x = insetX; x < image.width - insetX; x += 1) {
      const index = (y * image.width + x) * 4;
      const [red, green, blue] = image.data.subarray(index, index + 3);
      const matches =
        color === "magenta"
          ? Math.min(red, blue) > 150 && Math.min(red, blue) - green > 100
          : Math.min(green, blue) > 150 && Math.min(green, blue) - red > 100;
      if (!matches) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    count,
    width: count ? maxX - minX + 1 : 0,
    height: count ? maxY - minY + 1 : 0,
  };
};
