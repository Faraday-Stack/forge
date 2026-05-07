/**
 * Local-development overrides for the SaaS connection.
 *
 * The public SDK only exposes `publishableKey` / `userToken` props. To point a
 * locally-running app at a non-prod backend without leaking those knobs into
 * the public type surface, the provider reads these values from the build's
 * environment instead:
 *
 *   - `VITE_FARADAY_ENDPOINT` / `VITE_FARADAY_API_URL` (Vite-bundled apps)
 *   - `FARADAY_ENDPOINT`      / `FARADAY_API_URL`      (Node-bundled apps)
 *
 * Set them in your local `.env.local`. Public consumers leave them unset and
 * the SDK uses the production SaaS URL.
 */

function readImportMetaEnv(key: string): string | undefined {
  try {
    // `import.meta` is invalid syntax in CJS targets; the try/catch suppresses
    // the runtime error so the CJS build returns undefined here cleanly.
    const env = (import.meta as { env?: Record<string, string | undefined> })
      ?.env;
    const value = env?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function readProcessEnv(key: string): string | undefined {
  try {
    if (typeof process === "undefined" || !process.env) return undefined;
    const value = process.env[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Local-dev override for the streaming endpoint (bypasses the SaaS URL). */
export function getDevEndpoint(): string | undefined {
  return (
    readImportMetaEnv("VITE_FARADAY_ENDPOINT") ??
    readProcessEnv("FARADAY_ENDPOINT")
  );
}

/** Local-dev override for the SaaS API base URL. */
export function getDevApiUrl(): string | undefined {
  return (
    readImportMetaEnv("VITE_FARADAY_API_URL") ??
    readProcessEnv("FARADAY_API_URL")
  );
}
