import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFile } from "node:child_process";
import Schema from "@deepseek-ai/schemastery";
//#region src/undici.ts
/**
* undici, loaded on first use. Importing it costs well over 100 ms, and a
* Harness with no proxied provider never needs it, so it must not ride along
* with the plugin's own import. `require` keeps the load synchronous for the
* callers that hand out a dispatcher from a getter.
*/
let loaded;
function undici() {
	return loaded ??= createRequire(import.meta.url)("undici");
}
//#endregion
//#region src/fetch-router.ts
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
const STATE_KEY = Symbol.for("dsh-proxy.fetch-router.v1");
function acquireState() {
	const existing = globalThis[STATE_KEY];
	if (existing !== void 0) {
		existing.owners += 1;
		return existing;
	}
	if (typeof globalThis.fetch !== "function") throw new Error("@copylee/dsh-proxy: 当前 Node 运行时没有全局 fetch");
	const storage = new AsyncLocalStorage();
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
	const original = globalThis.fetch;
	const routed = function fetch(input, init) {
		const scope = storage.getStore();
		if (scope === void 0) return original.call(globalThis, input, init);
		return routedFetch(input, init, scope.dispatcher);
	};
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		enumerable: descriptor?.enumerable ?? true,
		writable: true,
		value: routed
	});
	const state = {
		owners: 1,
		storage,
		original,
		routed,
		descriptor
	};
	Object.defineProperty(globalThis, STATE_KEY, {
		configurable: true,
		value: state
	});
	return state;
}
/**
* Issue one request through `dispatcher`. A global `Request` is unpacked
* because undici's own `fetch` only recognizes its own Request class.
*/
async function routedFetch(input, init, dispatcher) {
	let url;
	let merged;
	if (typeof Request !== "undefined" && input instanceof Request) {
		url = input.url;
		merged = {
			method: input.method,
			headers: input.headers,
			signal: input.signal,
			redirect: input.redirect,
			...input.body === null ? {} : {
				body: input.body,
				duplex: "half"
			},
			...init
		};
	} else {
		url = input;
		merged = { ...init };
	}
	const { fetch: undiciFetch } = undici();
	return await undiciFetch(url, {
		...merged,
		dispatcher
	});
}
function scopedIterable(storage, scope, factory) {
	return { [Symbol.asyncIterator]() {
		let iterator;
		const target = () => {
			iterator ??= factory()[Symbol.asyncIterator]();
			return iterator;
		};
		return {
			next: (...args) => storage.run(scope, () => target().next(...args)),
			return: (value) => storage.run(scope, async () => {
				if (iterator?.return === void 0) return {
					done: true,
					value
				};
				return await iterator.return(value);
			}),
			throw: (error) => storage.run(scope, async () => {
				if (iterator?.throw === void 0) throw error;
				return await iterator.throw(error);
			})
		};
	} };
}
/** Take a hold on the process-wide fetch router. */
function acquireFetchRouter() {
	const state = acquireState();
	let released = false;
	return {
		run: (dispatcher, callback) => state.storage.run({ dispatcher }, callback),
		wrap: (dispatcher, factory) => scopedIterable(state.storage, { dispatcher }, factory),
		release() {
			if (released) return;
			released = true;
			state.owners -= 1;
			if (state.owners > 0) return;
			const host = globalThis;
			if (globalThis.fetch === state.routed) {
				if (state.descriptor === void 0) Reflect.deleteProperty(globalThis, "fetch");
				else Object.defineProperty(globalThis, "fetch", state.descriptor);
			}
			if (host[STATE_KEY] === state) Reflect.deleteProperty(host, STATE_KEY);
			state.storage.disable();
		}
	};
}
//#endregion
//#region src/proxy-url.ts
/** Proxy URL validation and credential-safe display. */
/** Why a proxy URL was refused, phrased for the user. */
var ProxyUrlError = class extends Error {
	name = "ProxyUrlError";
};
/**
* Parse a proxy URL the user typed.
*
* Only `http:` and `https:` forward proxies are accepted: the Harness transport
* (undici's ProxyAgent, like the launcher's own env-var policy) speaks CONNECT
* over HTTP. A bare `127.0.0.1:7890` is read as `http://127.0.0.1:7890`.
*
* @param raw - the configured value.
* @returns the normalized URL.
* @throws ProxyUrlError when the value cannot be used; the message never contains credentials.
*/
function parseProxyUrl(raw) {
	const text = raw.trim();
	if (text.length === 0) throw new ProxyUrlError("代理地址为空");
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
	let url;
	try {
		url = new URL(candidate);
	} catch {
		throw new ProxyUrlError("代理地址不是合法的 URL");
	}
	if (url.protocol === "socks:" || url.protocol.startsWith("socks")) throw new ProxyUrlError("不支持 SOCKS 代理，请改用代理软件的 HTTP 端口（如 Clash 的 7890 混合端口）");
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new ProxyUrlError(`不支持的代理协议 ${url.protocol}，只支持 http:// 或 https://`);
	if (url.hostname.length === 0) throw new ProxyUrlError("代理地址缺少主机名");
	if (url.pathname !== "" && url.pathname !== "/" || url.search !== "" || url.hash !== "") throw new ProxyUrlError("代理地址不能包含路径、查询参数或片段");
	return url;
}
/**
* Render a proxy URL for logs and errors with any credentials masked.
* @param url - a parsed proxy URL.
* @returns `scheme://***@host:port` or `scheme://host:port`.
*/
function redactProxyUrl(url) {
	const auth = url.username !== "" || url.password !== "" ? "***@" : "";
	return `${url.protocol}//${auth}${url.host}`;
}
//#endregion
//#region src/system-proxy.ts
function runCommand(file, args) {
	return new Promise((resolve) => {
		execFile(file, args, {
			timeout: 3e3,
			windowsHide: true
		}, (error, stdout) => resolve(error ? "" : stdout));
	});
}
function pickWindowsProxy(server) {
	if (!server.includes("=")) return server.trim() || void 0;
	const parts = Object.fromEntries(server.split(";").map((part) => part.split("=").map((x) => x.trim())).filter((pair) => pair.length === 2 && pair[1]));
	return parts.https ?? parts.http;
}
/** Same priority as dsh-free-search: environment, Windows Internet Settings, macOS scutil. */
async function detectSystemProxy(options = {}) {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const run = options.run ?? runCommand;
	const candidates = [];
	for (const name of [
		"HTTPS_PROXY",
		"https_proxy",
		"HTTP_PROXY",
		"http_proxy",
		"ALL_PROXY",
		"all_proxy"
	]) if (env[name]) candidates.push({
		url: env[name],
		source: `env ${name}`
	});
	if (platform === "win32") {
		const out = await run("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"]);
		const server = out.match(/ProxyServer\s+REG_SZ\s+(.+)/i)?.[1];
		const picked = /ProxyEnable\s+REG_DWORD\s+0x0*1\b/i.test(out) && server ? pickWindowsProxy(server) : void 0;
		if (picked) candidates.push({
			url: picked,
			source: "Windows system proxy"
		});
	} else if (platform === "darwin") {
		const out = await run("scutil", ["--proxy"]);
		const field = (key) => out.match(new RegExp(`\\b${key}\\s*:\\s*(\\S+)`))?.[1];
		for (const kind of ["HTTPS", "HTTP"]) {
			const host = field(`${kind}Proxy`);
			if (field(`${kind}Enable`) === "1" && host) candidates.push({
				url: `${host.includes(":") ? `[${host}]` : host}:${field(`${kind}Port`) ?? "80"}`,
				source: "macOS system proxy"
			});
		}
	}
	for (const candidate of candidates) try {
		return {
			...candidate,
			url: parseProxyUrl(candidate.url).href.replace(/\/$/, "")
		};
	} catch {}
	return null;
}
//#endregion
//#region src/status-route.ts
const STATUS_PATH = "/api/dsh-proxy/proxy-status";
/** Match the free-search bridge's loopback and same-origin checks. */
function isLocalRequest(req) {
	if (![
		"127.0.0.1",
		"::1",
		"::ffff:127.0.0.1"
	].includes(req.socket.remoteAddress ?? "")) return false;
	try {
		const host = new URL(`http://${req.headers.host ?? ""}`);
		if (![
			"localhost",
			"127.0.0.1",
			"[::1]"
		].includes(host.hostname) || req.headers["sec-fetch-site"] === "cross-site") return false;
		return req.headers.origin === void 0 || new URL(req.headers.origin).host === host.host;
	} catch {
		return false;
	}
}
function statusRoute(detect) {
	return {
		kind: "exact",
		path: STATUS_PATH,
		async handler(req, res) {
			const send = (status, body) => {
				res.writeHead(status, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end(JSON.stringify(body));
			};
			if (!isLocalRequest(req)) return send(403, { ok: false });
			if (req.method !== "POST") return send(405, { ok: false });
			const system = await detect();
			send(200, {
				ok: true,
				value: { system: system ? {
					...system,
					url: redactProxyUrl(new URL(system.url))
				} : null }
			});
		}
	};
}
//#endregion
//#region src/global.ts
/** Loopback is always direct: the Web UI and local servers would otherwise loop through the proxy. */
const LOOPBACK = [
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
	"0.0.0.0"
];
async function loadHostHttpProxy() {
	try {
		return await import("@deepseek-ai/dsh-http-proxy");
	} catch {
		return;
	}
}
/**
* Fallback for a Harness without `dsh-http-proxy`: swap undici's global
* dispatcher directly.
*/
async function installWithUndici(url, noProxy) {
	const { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = await import("undici");
	const previous = getGlobalDispatcher();
	const agent = new EnvHttpProxyAgent({
		httpProxy: url,
		httpsProxy: url,
		noProxy: [...LOOPBACK, ...noProxy].join(",")
	});
	setGlobalDispatcher(agent);
	return async () => {
		if (getGlobalDispatcher() === agent) setGlobalDispatcher(previous);
		await agent.close();
	};
}
/** Stable key of what an install depends on; `undefined` means "no global proxy". */
function keyOf(config) {
	if (!config.enabled || config.url.trim() === "") return void 0;
	return JSON.stringify([config.url.trim(), config.noProxy.map((host) => host.trim()).filter(Boolean)]);
}
var GlobalProxyLayer = class {
	options;
	key;
	dispose;
	/** Serializes installs: the host package requires LIFO disposal. */
	queue = Promise.resolve();
	constructor(options) {
		this.options = options;
	}
	/**
	* Bring the process-wide proxy in line with `config`.
	* @param config - the current global section.
	* @returns resolves once the new route is installed (or the invalid value was reported).
	*/
	apply(config) {
		const next = this.queue.then(() => this.reconcile(config));
		this.queue = next.catch(() => {});
		return next;
	}
	/** Remove this layer, restoring the launcher's own proxy policy. */
	close() {
		const next = this.queue.then(() => this.release());
		this.queue = next.catch(() => {});
		return next;
	}
	async release() {
		const dispose = this.dispose;
		this.dispose = void 0;
		this.key = void 0;
		await dispose?.();
	}
	async reconcile(config) {
		if (config.enabled && config.mode === "system") {
			const detected = await (this.options.detectSystemProxy ?? detectSystemProxy)();
			if (!detected) this.options.warn("未检测到可用的系统 HTTP(S) 代理，恢复启动时的代理设置");
			config = {
				...config,
				url: detected?.url ?? ""
			};
		}
		const key = keyOf(config);
		if (key === this.key) return;
		await this.release();
		if (key === void 0) {
			this.options.info("全局代理已关闭，恢复启动时的代理设置");
			return;
		}
		let url;
		try {
			url = parseProxyUrl(config.url);
		} catch (error) {
			this.options.warn(`全局代理未生效：${error.message}`);
			return;
		}
		const proxy = url.href.replace(/\/$/, "");
		const noProxy = config.noProxy.map((host) => host.trim()).filter(Boolean);
		const module = await (this.options.loadHttpProxy ?? loadHostHttpProxy)();
		if (module === void 0) this.dispose = await installWithUndici(proxy, noProxy);
		else {
			const values = {
				HTTP_PROXY: proxy,
				HTTPS_PROXY: proxy,
				...noProxy.length === 0 ? {} : { NO_PROXY: noProxy.join(",") }
			};
			this.dispose = await module.installProxyFromEnvironment({ get: (name) => name in values ? { value: values[name] } : void 0 }, (message) => {
				this.options.warn(`全局代理：${message}`);
			});
		}
		this.key = key;
		this.options.info(`全局代理已启用：${redactProxyUrl(url)}`);
	}
};
//#endregion
//#region src/provider-routes.ts
/**
* Build the dispatchers for every enabled provider entry.
* @param providers - the `providers` section.
* @returns the table, plus one issue per entry that could not be used (it stays on the global route).
*/
function createRouteTable(providers) {
	const routes = /* @__PURE__ */ new Map();
	const owned = /* @__PURE__ */ new Map();
	const route = (key, create, label) => {
		let cell = owned.get(key);
		if (cell === void 0) owned.set(key, cell = { create });
		const shared = cell;
		return {
			get dispatcher() {
				return shared.made ??= shared.create();
			},
			label
		};
	};
	const issues = [];
	for (const [provider, entry] of Object.entries(providers)) {
		if (!entry.enabled) continue;
		if (entry.mode === "direct") {
			routes.set(provider, route("direct", () => new (undici()).Agent(), "直连"));
			continue;
		}
		let url;
		try {
			url = parseProxyUrl(entry.url);
		} catch (error) {
			issues.push({
				provider,
				message: error.message
			});
			continue;
		}
		const key = url.href;
		routes.set(provider, route(key, () => new (undici()).ProxyAgent({ uri: key.replace(/\/$/, "") }), redactProxyUrl(url)));
	}
	return {
		table: {
			routes,
			async close() {
				await Promise.allSettled([...owned.values()].map((cell) => cell.made?.close()));
			}
		},
		issues
	};
}
//#endregion
//#region src/config.ts
/**
* Plugin configuration. Both sections are volatile: a Settings edit updates
* the running references and fires `loader/volatile-update` instead of
* remounting the plugin, so a changed proxy applies to the next request.
*/
const GlobalProxyConfig = Schema.object({
	enabled: Schema.boolean().default(false).description("启用全局代理"),
	mode: Schema.union(["proxy", "system"]).default("proxy").description("proxy：手动代理；system：自动检测系统代理"),
	url: Schema.string().default("").description("全局代理地址，例如 http://127.0.0.1:7890"),
	noProxy: Schema.array(String).default([]).description("不走代理的主机名（本机回环地址始终直连）")
});
const ProviderProxyConfig = Schema.object({
	enabled: Schema.boolean().default(true).description("启用此提供商的单独代理设置"),
	mode: Schema.union([
		"proxy",
		"direct",
		"system"
	]).default("proxy").description("proxy：走下方地址；direct：强制直连"),
	url: Schema.string().default("").description("此提供商使用的代理地址，例如 http://127.0.0.1:7890")
});
const Config = Schema.object({
	global: GlobalProxyConfig.volatile(),
	providers: Schema.dict(ProviderProxyConfig).default({}).description("按 LLM 提供商 id 单独配置代理").volatile()
});
//#endregion
//#region src/index.ts
const name = "@copylee/dsh-proxy";
/**
* How long a replaced provider route stays open. A stream that started on it
* may still issue requests (a retry, a follow-up call) under its old scope.
*/
const RETIRED_ROUTE_GRACE_MS = 6e5;
/** Read both live references once, for one reconciliation. */
function snapshot(config) {
	return {
		global: config.global.get() ?? {
			enabled: false,
			url: "",
			noProxy: []
		},
		providers: config.providers.get() ?? {}
	};
}
function apply(context, config) {
	const ctx = context;
	const logger = ctx.logger("dsh-proxy");
	const launchEnv = { ...process.env };
	const detect = () => detectSystemProxy({ env: launchEnv });
	const global = new GlobalProxyLayer({
		detectSystemProxy: detect,
		info: (message) => {
			logger.info(message);
		},
		warn: (message) => {
			logger.warn(message);
		}
	});
	let table = createRouteTable({}).table;
	const retired = /* @__PURE__ */ new Set();
	let lastProviders;
	const updateProviders = (providers) => {
		if (providers === lastProviders) return;
		lastProviders = providers;
		const { table: next, issues } = createRouteTable(providers);
		for (const issue of issues) logger.warn(`提供商 ${issue.provider} 的代理未生效：${issue.message}`);
		for (const [provider, route] of next.routes) logger.info(`提供商 ${provider} → ${route.label}`);
		const previous = table;
		table = next;
		const timer = setTimeout(() => {
			retired.delete(timer);
			previous.close();
		}, RETIRED_ROUTE_GRACE_MS);
		timer.unref?.();
		retired.add(timer);
	};
	let generation = 0;
	let stopped = false;
	let resolvedKey = "";
	const reconcile = () => {
		const settings = snapshot(config);
		const current = ++generation;
		if (Object.values(settings.providers).some((entry) => entry.enabled && entry.mode === "system")) detect().then((system) => {
			if (stopped || current !== generation) return;
			const resolved = Object.fromEntries(Object.entries(settings.providers).map(([id, entry]) => [id, entry.mode === "system" ? {
				...entry,
				mode: "proxy",
				url: system?.url ?? ""
			} : entry]));
			const key = JSON.stringify(resolved);
			if (key !== resolvedKey) {
				resolvedKey = key;
				updateProviders(resolved);
			}
		}).catch((error) => logger.warn(`系统代理检测失败：${String(error)}`));
		else {
			resolvedKey = "";
			updateProviders(settings.providers);
		}
		global.apply(settings.global).catch((error) => {
			logger.warn(`全局代理安装失败：${error instanceof Error ? error.message : String(error)}`);
		});
	};
	ctx.effect(() => {
		reconcile();
		const stop = ctx.on("loader/volatile-update", () => {
			reconcile();
		});
		const poll = setInterval(() => {
			if (snapshot(config).global.mode === "system" || Object.values(snapshot(config).providers).some((entry) => entry.enabled && entry.mode === "system")) reconcile();
		}, 3e4);
		poll.unref?.();
		return async () => {
			stopped = true;
			stop();
			clearInterval(poll);
			for (const timer of retired) clearTimeout(timer);
			retired.clear();
			await Promise.allSettled([global.close(), table.close()]);
		};
	}, "dsh-proxy: routes");
	ctx.inject(["webServer"], (serverCtx) => {
		serverCtx.effect(() => serverCtx.webServer.register(statusRoute(detect)), "dsh-proxy: system proxy status");
	});
	ctx.inject(["llm"], (llmCtx) => {
		llmCtx.effect(() => {
			const router = acquireFetchRouter();
			const stopStream = llmCtx.on("llm/stream", (options, next) => {
				const route = options.provider === void 0 ? void 0 : table.routes.get(options.provider);
				return route === void 0 ? next() : router.wrap(route.dispatcher, next);
			}, { global: true });
			const llm = llmCtx.llm;
			const original = llm.discoverModels;
			let patched;
			if (typeof original === "function") {
				patched = function discoverModels(settingsNs, request, signal) {
					const route = request?.provider === void 0 ? void 0 : table.routes.get(request.provider);
					const call = () => original.call(this, settingsNs, request, signal);
					return route === void 0 ? call() : router.run(route.dispatcher, call);
				};
				try {
					llm.discoverModels = patched;
				} catch {
					patched = void 0;
				}
			}
			return () => {
				stopStream();
				if (patched !== void 0 && llm.discoverModels === patched) llm.discoverModels = original;
				router.release();
			};
		}, "dsh-proxy: provider routing");
	});
}
//#endregion
export { Config, ProxyUrlError, RETIRED_ROUTE_GRACE_MS, apply, name, parseProxyUrl, redactProxyUrl };
