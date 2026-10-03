/**
 * Request-scoped transport selection.
 *
 * A provider's model call runs inside `llm/stream`; everything the adapter
 * awaits from there (SDK construction, `fetch`, retries) shares one async
 * context. The router keeps the chosen dispatcher in an AsyncLocalStorage
 * and a thin `globalThis.fetch` wrapper passes it as `init.dispatcher`, which
 * undici prefers over the global dispatcher. Outside such a scope the wrapper
 * calls the original `fetch` untouched, so every other request keeps the
 * global route (the global layer, or the launcher's env-var policy).
 *
 * A routed request goes through this package's own undici `fetch`: the
 * `fetch` built into Node 22 bundles an older undici that cannot drive a
 * dispatcher from undici 8 passed per request.
 *
 * The wrapper is process-wide and reference-counted, so a plugin reload or a
 * second instance never stacks wrappers or removes one still in use.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Dispatcher } from 'undici'
import { undici } from './undici.ts'

const STATE_KEY = Symbol.for('dsh-proxy.fetch-router.v1')

interface Scope {
  readonly dispatcher: Dispatcher
}

interface RouterState {
  owners: number
  readonly storage: AsyncLocalStorage<Scope>
  readonly original: typeof fetch
  readonly routed: typeof fetch
  readonly descriptor: PropertyDescriptor | undefined
}

type GlobalWithRouter = typeof globalThis & { [STATE_KEY]?: RouterState }

export interface FetchRouter {
  /** Run `callback` with every `fetch` it issues sent through `dispatcher`. */
  run<T>(dispatcher: Dispatcher, callback: () => T): T
  /**
   * Wrap a lazily produced stream so that producing it and every `next()`
   * step run inside the dispatcher's scope.
   */
  wrap<T>(dispatcher: Dispatcher, factory: () => AsyncIterable<T>): AsyncIterable<T>
  /** Drop this owner's hold; the last owner restores the original `fetch`. */
  release(): void
}

function acquireState(): RouterState {
  const host = globalThis as GlobalWithRouter
  const existing = host[STATE_KEY]
  if (existing !== undefined) {
    existing.owners += 1
    return existing
  }
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('@copylee/dsh-proxy: 当前 Node 运行时没有全局 fetch')
  }
  const storage = new AsyncLocalStorage<Scope>()
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  const original = globalThis.fetch
  const routed = function fetch(input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> {
    const scope = storage.getStore()
    if (scope === undefined) return original.call(globalThis, input, init)
    return routedFetch(input, init, scope.dispatcher)
  } as typeof fetch
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    writable: true,
    value: routed,
  })
  const state: RouterState = { owners: 1, storage, original, routed, descriptor }
  Object.defineProperty(globalThis, STATE_KEY, { configurable: true, value: state })
  return state
}

/**
 * Issue one request through `dispatcher`. A global `Request` is unpacked
 * because undici's own `fetch` only recognizes its own Request class.
 */
async function routedFetch(input: Parameters<typeof fetch>[0], init: RequestInit | undefined, dispatcher: Dispatcher): Promise<Response> {
  let url: string | URL
  let merged: RequestInit
  if (typeof Request !== 'undefined' && input instanceof Request) {
    url = input.url
    merged = {
      method: input.method,
      headers: input.headers,
      signal: input.signal,
      redirect: input.redirect,
      ...input.body === null ? {} : { body: input.body, duplex: 'half' },
      ...init,
    } as RequestInit
  } else {
    url = input as string | URL
    merged = { ...init }
  }
  const { fetch: undiciFetch } = undici()
  return await undiciFetch(url, { ...merged, dispatcher } as Parameters<typeof undiciFetch>[1]) as unknown as Response
}

function scopedIterable<T>(storage: AsyncLocalStorage<Scope>, scope: Scope, factory: () => AsyncIterable<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      let iterator: AsyncIterator<T> | undefined
      const target = (): AsyncIterator<T> => {
        iterator ??= factory()[Symbol.asyncIterator]()
        return iterator
      }
      return {
        next: (...args: [] | [unknown]) => storage.run(scope, () => target().next(...args)),
        return: (value?: unknown) => storage.run(scope, async () => {
          if (iterator?.return === undefined) return { done: true as const, value: value as T }
          return await iterator.return(value)
        }),
        throw: (error?: unknown) => storage.run(scope, async () => {
          if (iterator?.throw === undefined) throw error
          return await iterator.throw(error)
        }),
      }
    },
  }
}

/** Take a hold on the process-wide fetch router. */
export function acquireFetchRouter(): FetchRouter {
  const state = acquireState()
  let released = false
  return {
    run: (dispatcher, callback) => state.storage.run({ dispatcher }, callback),
    wrap: (dispatcher, factory) => scopedIterable(state.storage, { dispatcher }, factory),
    release() {
      if (released) return
      released = true
      state.owners -= 1
      if (state.owners > 0) return
      const host = globalThis as GlobalWithRouter
      if (globalThis.fetch === state.routed) {
        if (state.descriptor === undefined) Reflect.deleteProperty(globalThis, 'fetch')
        else Object.defineProperty(globalThis, 'fetch', state.descriptor)
      }
      if (host[STATE_KEY] === state) Reflect.deleteProperty(host, STATE_KEY)
      state.storage.disable()
    },
  }
}
