/**
 * undici, loaded on first use. Importing it costs well over 100 ms, and a
 * Harness with no proxied provider never needs it, so it must not ride along
 * with the plugin's own import. `require` keeps the load synchronous for the
 * callers that hand out a dispatcher from a getter.
 */
import { createRequire } from 'node:module'

type Undici = typeof import('undici')

let loaded: Undici | undefined

export function undici(): Undici {
  return loaded ??= createRequire(import.meta.url)('undici') as Undici
}
