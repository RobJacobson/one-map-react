/**
 * A MapLibre style-spec document used as `mapStyle`.
 */
export interface StyleDocument {
  /** Style specification version. */
  readonly version: 8;
  /** Style sources keyed by id. */
  readonly sources: object;
  /** Style layers in draw order. */
  readonly layers: readonly object[];
  /** Optional style name preserved from the document. */
  readonly name?: string;
}

/**
 * Style URL or an inline style document.
 */
export type MapStyle = string | StyleDocument;
