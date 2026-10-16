/** Shares unchanged SDK calls while retaining each selected wrapper's signatures. */
export const createWebMethodForwarders = <Handle, Name extends keyof Handle>(
  getHandle: () => Handle,
  names: readonly Name[]
): Pick<Handle, Name> =>
  Object.fromEntries(
    names.map((name) => [
      name,
      (...args: unknown[]) => {
        const handle = getHandle();
        const method = handle[name] as (...values: unknown[]) => unknown;
        return method.apply(handle, args);
      },
    ])
  ) as Pick<Handle, Name>;
