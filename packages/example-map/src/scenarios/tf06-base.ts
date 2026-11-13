declare const process: {
  env: { TF06_BASE?: string };
};

/** Local vector fixture base, inlined by Babel for the native lifetime smoke. */
export const tf06Base = process.env.TF06_BASE ?? "http://127.0.0.1:8798";
