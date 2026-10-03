/**
 * The per-provider route table: provider id → the dispatcher its model
 * requests use. Dispatchers are shared per proxy URL, and a replaced table is
 * closed gracefully (`close()`, not `destroy()`) so a stream already running
 * on it finishes. A dispatcher is only built when a request first asks for it,
 * so a table of routes nobody has used yet costs nothing at startup.
 */
import type { Dispatcher } from 'undici'
import { undici } from './undici.ts'
import type { ProviderProxyConfig } from './config.ts'
import { parseProxyUrl, redactProxyUrl } from './proxy-url.ts'

export interface ProviderRoute {
  readonly dispatcher: Dispatcher
  /** Credential-free description for logs and status. */
  readonly label: string
}

export interface RouteTable {
  readonly routes: ReadonlyMap<string, ProviderRoute>
  close(): Promise<void>
}

export interface RouteIssue {
  provider: string
  message: string
}

/**
 * Build the dispatchers for every enabled provider entry.
 * @param providers - the `providers` section.
 * @returns the table, plus one issue per entry that could not be used (it stays on the global route).
 */
export function createRouteTable(providers: Readonly<Record<string, ProviderProxyConfig>>): { table: RouteTable; issues: RouteIssue[] } {
  const routes = new Map<string, ProviderRoute>()
  const owned = new Map<string, { create: () => Dispatcher; made?: Dispatcher }>()
  const route = (key: string, create: () => Dispatcher, label: string): ProviderRoute => {
    let cell = owned.get(key)
    if (cell === undefined) owned.set(key, cell = { create })
    const shared = cell
    return { get dispatcher() { return shared.made ??= shared.create() }, label }
  }
  const issues: RouteIssue[] = []
  for (const [provider, entry] of Object.entries(providers)) {
    if (!entry.enabled) continue
    if (entry.mode === 'direct') {
      routes.set(provider, route('direct', () => new (undici().Agent)(), '直连'))
      continue
    }
    let url: URL
    try {
      url = parseProxyUrl(entry.url)
    } catch (error) {
      issues.push({ provider, message: (error as Error).message })
      continue
    }
    const key = url.href
    routes.set(provider, route(key, () => new (undici().ProxyAgent)({ uri: key.replace(/\/$/, '') }), redactProxyUrl(url)))
  }
  return {
    table: {
      routes,
      async close() {
        await Promise.allSettled([...owned.values()].map(cell => cell.made?.close()))
      },
    },
    issues,
  }
}
