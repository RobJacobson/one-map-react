import { createServer } from "node:http";

const extent = 4096;
const routes = [
  {
    id: 1,
    coordinates: [
      [-122.341, 47.61],
      [-122.335, 47.613],
    ],
  },
  {
    id: 2,
    coordinates: [
      [-122.341, 47.605],
      [-122.335, 47.608],
    ],
  },
];

/**
 * Serves deterministic, generation-tagged MVTs for the native TF06 scope.
 *
 * @param {number} port - Dedicated local fixture port.
 * @returns {Promise<{ close: () => Promise<void>, requests: object[] }>}
 * The owned server and compact requested-generation provenance.
 */
export const startLifetimesFixture = async (port = 8798) => {
  const requests = [];
  const server = createServer((request, response) => {
    const match = /^\/vt\/(\d+)\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(
      request.url?.split("?")[0] ?? ""
    );
    if (!match) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const [revision, z, x, y] = match.slice(1).map(Number);
    if (z !== 11 || x >= 2 ** z || y >= 2 ** z) {
      response.writeHead(400);
      response.end("invalid fixture tile");
      return;
    }
    if (
      !requests.some(
        (entry) => entry.revision === revision && entry.x === x && entry.y === y
      )
    ) {
      requests.push({ revision, z, x, y });
    }
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.mapbox-vector-tile",
    });
    response.end(encodeLifetimesTile(revision, z, x, y));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  return {
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

/**
 * Encodes real lines in two independent vector source layers using MVT 2.1.
 *
 * @param {number} revision - Replacement-source generation carried as a property.
 * @param {number} z - XYZ tile zoom.
 * @param {number} x - XYZ column.
 * @param {number} y - XYZ row.
 * @returns {Buffer} An MVT with explicit version and extent, including empty tiles.
 */
export const encodeLifetimesTile = (revision, z, x, y) =>
  Buffer.concat(
    ["routes", "alternates"].map((name) =>
      bytes(3, encodeLayer(name, revision, z, x, y))
    )
  );

// Field numbers follow the primary schema at
// https://github.com/mapbox/vector-tile-spec/blob/master/2.1/vector_tile.proto.
const encodeLayer = (name, revision, z, x, y) => {
  const features = routes
    .map((route) => ({
      id: route.id,
      points: route.coordinates.map((position) =>
        tilePosition(position, z, x, y)
      ),
    }))
    .filter((route) =>
      route.points.every(
        ([px, py]) => px >= 0 && px <= extent && py >= 0 && py <= extent
      )
    )
    .map((route) => bytes(2, encodeFeature(route)));
  return Buffer.concat([
    uint(15, 2),
    bytes(1, Buffer.from(name)),
    ...features,
    bytes(3, Buffer.from("__oneMapSourceRevision")),
    bytes(4, uint(5, revision)),
    uint(5, extent),
  ]);
};

const encodeFeature = ({ id, points }) => {
  const [[x1, y1], [x2, y2]] = points;
  // MoveTo(1), then LineTo(1); parameters use delta ZigZag encoding.
  const geometry = [
    9,
    zigzag(x1),
    zigzag(y1),
    10,
    zigzag(x2 - x1),
    zigzag(y2 - y1),
  ];
  return Buffer.concat([
    uint(1, id),
    bytes(2, Buffer.from([0, 0])),
    uint(3, 2),
    bytes(4, Buffer.concat(geometry.map(varint))),
  ]);
};

const tilePosition = ([longitude, latitude], z, x, y) => {
  const size = 2 ** z;
  const worldX = ((longitude + 180) / 360) * size;
  const worldY =
    ((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) *
    size;
  return [Math.round((worldX - x) * extent), Math.round((worldY - y) * extent)];
};

const zigzag = (value) => (value < 0 ? -value * 2 - 1 : value * 2);
const uint = (field, value) =>
  Buffer.concat([varint(field * 8), varint(value)]);
const bytes = (field, payload) =>
  Buffer.concat([varint(field * 8 + 2), varint(payload.length), payload]);
const varint = (value) => {
  const result = [];
  let remaining = value;
  while (remaining > 127) {
    result.push((remaining % 128) + 128);
    remaining = Math.floor(remaining / 128);
  }
  result.push(remaining);
  return Buffer.from(result);
};
