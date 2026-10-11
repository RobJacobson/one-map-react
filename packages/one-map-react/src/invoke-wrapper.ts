/**
 * Adopts a wrapper method's return value.
 *
 * `await` fulfills immediately for a void or ordinary value, including a web
 * map instance, and propagates rejection from a returned promise. Fulfillment
 * does not mean a camera animation finished.
 *
 * @param result - Value returned by the wrapper method.
 * @returns A promise that settles with the wrapper result.
 */
export const invokeWrapper = async (result: unknown): Promise<void> => {
  await result;
};
