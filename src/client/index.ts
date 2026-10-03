/**
 * Browser half: the "Network proxy" section in Settings. It reads the
 * plugin's own entry (`dsh-proxy`) through `remote.settings.describe()`,
 * lists providers through `remote.llm`, and writes with
 * `remote.settings.mutate()`. The host applies the edit as a volatile update,
 * so it reaches the next request without a restart.
 *
 * Built by tsdown into `client/client.js` in the ModuleLoader format; React is
 * the only import taken from the host's module table.
 */
import * as React from 'react'
import { ACCENT, ACCENT_INK, AccentPicker, installAccent } from './accent.ts'
import { ProviderPicker } from './provider-picker.ts'
import { Select, selectCss } from './select.ts'
import { en, zh, type LocaleKey } from './locales.ts'
import {
  draftFrom, isProviderId, providerRows, settingsFrom, validate,
  type Draft, type ProviderChoice, type ProviderRow,
} from './model.ts'

/** The Loader entry id this page edits; see cordis.patch.yml. */
export const ENTRY_ID = 'dsh-proxy'
const NS = 'settings.dshProxy'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code?: string; message: string } }

interface NamespaceView { ns: string; value: unknown; revision: number }

interface ClientContext {
  effect(execute: () => (() => void) | void, label?: string): void
  slots: {
    inject(name: string, register: () => unknown): void
    register(meta: Record<string, unknown>, render: (props: any) => unknown): unknown
  }
  locale?: {
    register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
    bind(ns: string): (key: string) => string
  }
  remote: {
    $on?(event: string, listener: (...args: unknown[]) => void): () => void
    settings: {
      describe(): Promise<RemoteResult<{ writable: boolean; namespaces: NamespaceView[] }>>
      mutate(ns: string, ops: { op: 'set' | 'unset'; path: string[]; value?: unknown }[], expectedRevision?: number): Promise<RemoteResult<unknown>>
    }
    llm: {
      listProviders(): Promise<RemoteResult<{ id: string; name?: string }[]>>
      listConfigurableProviders(): Promise<RemoteResult<{ provider: string; displayName?: string }[]>>
    }
  }
}

type T = (key: LocaleKey) => string

interface Api {
  load(): Promise<{ writable: boolean; view: NamespaceView | undefined; providers: ProviderRow[]; suggestions: ProviderRow[] }>
  detect(): Promise<{ url: string; source: string } | null>
  save(draft: Draft, revision: number): Promise<void>
  subscribe(listener: () => void): () => void
  t: T
}

const h = React.createElement

const S: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 20, maxWidth: 880, paddingBottom: 32, color: 'var(--dsw-alias-label-primary, inherit)' },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  subtitle: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary, #666)' },
  card: { display: 'grid', gap: 14, padding: 16, borderRadius: 'var(--dsw-radius-lg, 12px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600 },
  hint: { margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--dsw-alias-label-tertiary, #888)' },
  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 500 },
  input: { boxSizing: 'border-box', width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit', fontFamily: 'var(--ds-font-family-code, monospace)' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 200px minmax(160px, 1.4fr)', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.15))' },
  providerName: { fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' },
  providerId: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', fontFamily: 'var(--ds-font-family-code, monospace)' },
  error: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary, #d33)' },
  ok: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary, #2a2)' },
  toggle: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  primary: { padding: '7px 16px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: `1px solid ${ACCENT}`, background: ACCENT, color: ACCENT_INK, cursor: 'pointer' },
  secondary: { padding: '7px 14px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit', cursor: 'pointer' },
  addRow: { display: 'flex', gap: 8 },
}

function ProxySection({ api }: { api: Api }) {
  const { t } = api
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [writable, setWritable] = React.useState(false)
  const [view, setView] = React.useState<NamespaceView | undefined>(undefined)
  const [providers, setProviders] = React.useState<ProviderRow[]>([])
  const [suggestions, setSuggestions] = React.useState<ProviderRow[]>([])
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(undefined))
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [newId, setNewId] = React.useState('')
  const [system, setSystem] = React.useState<{ url: string; source: string } | null>(null)
  const [detectError, setDetectError] = React.useState(false)
  const refreshSystem = React.useCallback(async () => {
    try { setSystem(await api.detect()); setDetectError(false) } catch { setDetectError(true) }
  }, [api])
  const needsSystem = (draft.global.enabled && draft.global.mode === 'system') || Object.values(draft.providers).some(entry => entry.choice === 'system')
  React.useEffect(() => {
    if (!needsSystem) return
    void refreshSystem()
    const timer = setInterval(() => { void refreshSystem() }, 30_000)
    return () => clearInterval(timer)
  }, [needsSystem, refreshSystem])
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty

  const load = React.useCallback(async (resetDraft: boolean) => {
    try {
      const result = await api.load()
      setWritable(result.writable)
      setView(result.view)
      setProviders(result.providers)
      setSuggestions(result.suggestions)
      if (resetDraft || !dirtyRef.current) {
        setDraft(draftFrom(result.view?.value))
        setDirty(false)
      }
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage({ kind: 'error', text: t('loadFailed') + (error as Error).message })
    }
  }, [api, t])

  React.useEffect(() => {
    void load(true)
    return api.subscribe(() => { void load(false) })
  }, [api, load])

  const errors = validate(draft)
  const edit = (update: (next: Draft) => void) => {
    setDraft(previous => {
      const next: Draft = structuredClone(previous)
      update(next)
      return next
    })
    setDirty(true)
    setMessage(null)
  }

  const save = async () => {
    if (view === undefined || Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      await api.save(draft, view.revision)
      setMessage({ kind: 'ok', text: t('saved') })
      setDirty(false)
      await load(true)
    } catch (error) {
      setMessage({ kind: 'error', text: t('saveFailed') + (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return h('div', { style: S.page }, t('loading'))
  const disabled = !writable || view === undefined || saving

  const shown = [...providers]
  for (const id of Object.keys(draft.providers)) if (!shown.some(row => row.id === id)) shown.push({ id, name: id })

  const choiceOf = (id: string): ProviderChoice => draft.providers[id]?.choice ?? 'global'
  const urlOf = (id: string): string => draft.providers[id]?.url ?? ''

  return h('div', { style: S.page },
    h('style', null, selectCss),
    h('div', null,
      h('h2', { style: S.title }, t('title')),
      h('p', { style: S.subtitle }, t('subtitle')),
    ),
    view === undefined ? h('div', { style: S.error }, t('notMounted')) : null,
    view !== undefined && !writable ? h('div', { style: S.error }, t('readOnly')) : null,

    // Global proxy
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, t('globalTitle')),
      h('p', { style: S.hint }, t('globalHint')),
      h('div', { style: S.label },
        t('proxyMode'),
        h(Select, {
          label: t('proxyMode'), disabled,
          value: !draft.global.enabled ? 'off' : draft.global.mode === 'system' ? 'system' : 'proxy',
          options: [{ value: 'off', label: t('off') }, { value: 'system', label: t('system') }, { value: 'proxy', label: t('manual') }],
          onChange: (value: string) => edit(next => { next.global.enabled = value !== 'off'; next.global.mode = value === 'system' ? 'system' : 'proxy' }),
        }),
      ),
      draft.global.enabled && draft.global.mode === 'system' ? h('div', { style: S.actions },
        h('span', { style: detectError ? S.error : S.hint, role: 'status' }, detectError ? t('detectFailed') : system ? `${t('detected')}${system.url} (${system.source})` : t('notDetected')),
        h('button', { type: 'button', style: S.secondary, onClick: () => { void refreshSystem() } }, t('refresh')),
      ) : null,
      draft.global.mode !== 'system' ? h('label', { style: S.label },
        t('proxyUrl'),
        h('input', {
          style: S.input, value: draft.global.url, placeholder: t('proxyUrlPlaceholder'), disabled, spellCheck: false,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const value = event.target.value; edit(next => { next.global.url = value }) },
        }),
        errors.global === undefined ? null : h('span', { style: S.error }, t('invalid') + errors.global),
      ) : null,
      h('label', { style: S.label },
        t('noProxy'),
        h('textarea', {
          style: { ...S.input, minHeight: 64, resize: 'vertical' }, value: draft.global.noProxyText, disabled, spellCheck: false,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => { const value = event.target.value; edit(next => { next.global.noProxyText = value }) },
        }),
        h('span', { style: S.hint }, t('noProxyHint')),
      ),
    ),

    // Per-provider proxy
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, t('providersTitle')),
      h('p', { style: S.hint }, t('providersHint')),
      shown.length === 0 ? h('p', { style: S.hint }, t('noProviders')) : null,
      ...shown.map(row => h('div', { key: row.id, style: S.row },
        h('div', null,
          h('div', { style: S.providerName, title: row.name }, row.name),
          h('div', { style: S.providerId }, row.id),
        ),
        h(Select, {
          label: `${row.name} ${t('proxyMode')}`, value: choiceOf(row.id), disabled,
          options: [{ value: 'global', label: t('followGlobal') }, { value: 'system', label: t('system') }, { value: 'proxy', label: t('useProxy') }, { value: 'direct', label: t('direct') }],
          onChange: (value: string) => {
            const choice = value as ProviderChoice
            edit(next => { next.providers[row.id] = { choice, url: next.providers[row.id]?.url ?? '' } })
          },
        }),
        h('div', null,
          choiceOf(row.id) === 'proxy'
            ? h('input', {
              style: S.input, value: urlOf(row.id), placeholder: t('proxyUrlPlaceholder'), disabled, spellCheck: false,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const value = event.target.value; edit(next => { next.providers[row.id] = { choice: 'proxy', url: value } }) },
            })
            : null,
          choiceOf(row.id) === 'system' ? h('span', { style: S.hint }, detectError ? t('detectFailed') : system ? `${t('detected')}${system.url}` : t('notDetected')) : null,
          errors[row.id] === undefined ? null : h('div', { style: S.error }, t('invalid') + errors[row.id]),
        ),
      )),
      h('div', { style: S.addRow },
        h(ProviderPicker, {
          value: newId, placeholder: t('addProviderPlaceholder'), label: t('addProvider'), disabled,
          options: suggestions.filter(row => !shown.some(item => item.id === row.id)),
          onChange: setNewId,
        }),
        h('button', {
          type: 'button', style: S.secondary, disabled: disabled || !isProviderId(newId) || shown.some(row => row.id === newId),
          onClick: () => { const id = newId; edit(next => { next.providers[id] = { choice: 'proxy', url: '' } }); setNewId('') },
        }, t('add')),

      ),
    ),

    h('div', { style: S.actions },
      h('button', {
        type: 'button', style: { ...S.primary, opacity: disabled || !dirty || Object.keys(errors).length > 0 ? 0.5 : 1 },
        disabled: disabled || !dirty || Object.keys(errors).length > 0, onClick: () => { void save() },
      }, saving ? t('saving') : t('save')),
      h('button', {
        type: 'button', style: S.secondary, disabled: !dirty || saving,
        onClick: () => { setDraft(draftFrom(view?.value)); setDirty(false); setMessage(null) },
      }, t('discard')),
      dirty ? h('span', { style: S.hint }, t('unsaved')) : null,
      message === null ? null : h('span', { style: message.kind === 'ok' ? S.ok : S.error }, message.text),
    ),

    h(AccentPicker, { label: t('accent'), hint: t('accentHint'), names: { orange: t('accentOrange'), blue: t('accentBlue'), black: t('accentBlack') } }),
  )
}

function unwrap<V>(result: RemoteResult<V>): V {
  if (result.ok) return result.value
  throw new Error(result.error.message)
}

function createApi(ctx: ClientContext, t: T): Api {
  return {
    t,
    async detect() {
      const response = await fetch('/api/dsh-proxy/proxy-status', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('System proxy detection unavailable')
      return unwrap(await response.json() as RemoteResult<{ system: { url: string; source: string } | null }>).system
    },
    async load() {
      const [described, registered, declared] = await Promise.all([
        ctx.remote.settings.describe(),
        ctx.remote.llm.listProviders().catch(() => ({ ok: true, value: [] }) as RemoteResult<{ id: string; name?: string }[]>),
        ctx.remote.llm.listConfigurableProviders().catch(() => ({ ok: true, value: [] }) as RemoteResult<{ provider: string; displayName?: string }[]>),
      ])
      const settings = unwrap(described)
      const view = settings.namespaces.find(item => item.ns === ENTRY_ID)
      const configured = Object.keys(draftFrom(view?.value).providers)
      const { rows, suggestions } = providerRows(registered.ok ? registered.value : [], declared.ok ? declared.value : [], configured)
      return { writable: settings.writable, view, providers: rows, suggestions }
    },
    async save(draft, revision) {
      const next = settingsFrom(draft)
      unwrap(await ctx.remote.settings.mutate(ENTRY_ID, [
        { op: 'set', path: ['global'], value: next.global },
        { op: 'set', path: ['providers'], value: next.providers },
      ], revision))
    },
    subscribe(listener) {
      return ctx.remote.$on?.('settings/document-updated', (ns) => { if (ns === ENTRY_ID) listener() }) ?? (() => {})
    },
  }
}

export const inject = ['slots', 'locale', 'remote', 'remote.settings', 'remote.llm']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installAccent(), 'dsh-proxy: accent colour')
  let t: T = key => zh[key]
  if (ctx.locale !== undefined) {
    const locale = ctx.locale
    ctx.effect(() => locale.register(NS, { zh, en }), 'dsh-proxy: dictionaries')
    const bound = locale.bind(NS)
    t = key => bound(key)
  } else if (typeof navigator !== 'undefined' && !navigator.language.startsWith('zh')) {
    t = key => en[key]
  }
  const api = createApi(ctx, t)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-proxy',
    order: 60,
    label: () => t('nav'),
  }, () => h(ProxySection, { api })))
}
