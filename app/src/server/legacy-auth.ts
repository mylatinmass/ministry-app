type LegacyAuth = {
  getMinistryIdentityContext: (
    client: any,
    payload: any,
  ) => Promise<any>
  getMinistryTokenPayload: (event: any, secret: string) => any
}

let legacyAuthPromise: Promise<LegacyAuth> | null = null

export const getLegacyAuth = () => {
  if (!legacyAuthPromise) {
    legacyAuthPromise = import.meta.env.DEV
      ? import("node:module").then(({ createRequire }) =>
          createRequire(import.meta.url)(
            "./legacy/helper/ministry-auth.js",
          ),
        )
      : import("./legacy/helper/ministry-auth.js").then(
          (module) => (module.default || module) as LegacyAuth,
        )
  }
  return legacyAuthPromise
}
