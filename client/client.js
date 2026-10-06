window.__ModuleLoader__.load({
	id: "@copylee/dsh-proxy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/accent.ts
		/**
		* The accent colour shared by the copylee DSH plugins (docs/ui-spec.md).
		*
		* One choice — terracotta orange by default, blue or black — is kept in the
		* browser under a key every plugin reads, and painted as two CSS variables on
		* `<body>`, where the Host keeps its own theme variables. A plugin's styles
		* only ever write `var(--cl-accent)` / `var(--cl-accent-ink)`, so changing the
		* colour in any plugin's settings recolours all of them at once.
		*
		* This file is identical in every plugin; change it in all of them together.
		*/
		const ACCENTS = {
			orange: {
				name: "陶土橙",
				accent: "#D97757",
				ink: "#FFFFFF"
			},
			blue: {
				name: "蓝色",
				accent: "#3D63E6",
				ink: "#FFFFFF"
			},
			black: {
				name: "黑色",
				accent: "var(--dsw-alias-label-primary, #1F1E1D)",
				ink: "var(--dsw-alias-bg-base, #FFFFFF)"
			}
		};
		const ACCENT_IDS = Object.keys(ACCENTS);
		const DEFAULT_ACCENT = "orange";
		/** Use these in styles; the fallbacks cover the moment before the first paint. */
		const ACCENT = `var(--cl-accent, ${ACCENTS[DEFAULT_ACCENT].accent})`;
		const ACCENT_INK = `var(--cl-accent-ink, ${ACCENTS[DEFAULT_ACCENT].ink})`;
		const KEY = "copylee.dsh.accent";
		const EVENT = "copylee-dsh-accent";
		function isAccent(value) {
			return typeof value === "string" && Object.hasOwn(ACCENTS, value);
		}
		/** The choice made in this browser, or null while none has been made. */
		function storedAccent() {
			try {
				const stored = localStorage.getItem(KEY);
				return isAccent(stored) ? stored : null;
			} catch {
				return null;
			}
		}
		function readAccent() {
			return storedAccent() ?? "orange";
		}
		function paint() {
			const colors = ACCENTS[readAccent()];
			document.body?.style.setProperty("--cl-accent", colors.accent);
			document.body?.style.setProperty("--cl-accent-ink", colors.ink);
		}
		/** Choose the accent for every plugin. */
		function writeAccent(accent) {
			try {
				localStorage.setItem(KEY, accent);
			} catch {}
			paint();
			window.dispatchEvent(new Event(EVENT));
		}
		/** Paint the current accent and keep it current. Returns the undo for plugin disposal. */
		function installAccent() {
			if (typeof document === "undefined") return () => {};
			paint();
			if (document.body === null) document.addEventListener("DOMContentLoaded", paint, { once: true });
			window.addEventListener(EVENT, paint);
			window.addEventListener("storage", paint);
			return () => {
				window.removeEventListener(EVENT, paint);
				window.removeEventListener("storage", paint);
			};
		}
		function useAccent() {
			const [accent, setAccent] = react.useState(readAccent);
			react.useEffect(() => {
				const sync = () => setAccent(readAccent());
				window.addEventListener(EVENT, sync);
				window.addEventListener("storage", sync);
				return () => {
					window.removeEventListener(EVENT, sync);
					window.removeEventListener("storage", sync);
				};
			}, []);
			return [accent, writeAccent];
		}
		/** A row of round swatches: one of them is always chosen. */
		function AccentPicker({ label = "强调色", hint = "对 copylee 的全部插件生效", names }) {
			const [accent, choose] = useAccent();
			const h = react.createElement;
			const name = (id) => names?.[id] ?? ACCENTS[id].name;
			return h("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 10,
				fontSize: 13,
				flexWrap: "wrap"
			} }, h("span", { style: { fontWeight: 500 } }, label), h("span", {
				role: "radiogroup",
				"aria-label": label,
				style: {
					display: "inline-flex",
					gap: 8
				}
			}, ...ACCENT_IDS.map((id) => h("button", {
				key: id,
				type: "button",
				role: "radio",
				"aria-checked": accent === id,
				"aria-label": name(id),
				title: name(id),
				onClick: () => choose(id),
				style: {
					width: 18,
					height: 18,
					padding: 0,
					borderRadius: "50%",
					cursor: "pointer",
					background: ACCENTS[id].accent,
					border: "2px solid var(--dsw-alias-bg-base, #fff)",
					boxShadow: accent === id ? "0 0 0 2px var(--dsw-alias-label-primary, #1F1E1D)" : "0 0 0 1px var(--dsw-alias-border-l2, rgba(127,127,127,.35))"
				}
			}))), h("span", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary, #888)"
			} }, `${name(accent)} · ${hint}`));
		}
		//#endregion
		//#region src/client/provider-picker.ts
		const h$2 = react.createElement;
		/** Editable provider suggestions, using the same floating menu as proxy modes. */
		function ProviderPicker({ value, options, disabled, label, placeholder, onChange }) {
			const id = react.useId();
			const input = react.useRef(null);
			const list = react.useRef(null);
			const [open, setOpen] = react.useState(false);
			const [active, setActive] = react.useState(-1);
			const [pos, setPos] = react.useState({});
			const query = value.trim().toLowerCase();
			const filtered = options.filter((row) => row.id.toLowerCase().includes(query) || row.name.toLowerCase().includes(query));
			const visible = open && !disabled && filtered.length > 0;
			const place = react.useCallback(() => {
				const r = input.current?.getBoundingClientRect();
				if (!r) return;
				const below = window.innerHeight - r.bottom - 12;
				const above = r.top - 12;
				const up = below < Math.min(filtered.length * 34 + 8, 220) && above > below;
				const width = Math.min(Math.max(r.width, 200), 440, window.innerWidth - 16);
				setPos({
					left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
					width,
					maxHeight: Math.max(0, Math.min(280, (up ? above : below) - 4)),
					...up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }
				});
			}, [filtered.length]);
			react.useEffect(() => {
				if (!visible) return;
				place();
				const pointer = (e) => {
					if (!list.current?.contains(e.target) && !input.current?.contains(e.target)) setOpen(false);
				};
				const scroll = (e) => {
					if (!list.current?.contains(e.target)) place();
				};
				document.addEventListener("pointerdown", pointer, true);
				window.addEventListener("scroll", scroll, true);
				window.addEventListener("resize", place);
				return () => {
					document.removeEventListener("pointerdown", pointer, true);
					window.removeEventListener("scroll", scroll, true);
					window.removeEventListener("resize", place);
				};
			}, [visible, place]);
			react.useEffect(() => {
				if (visible && active >= 0) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
			}, [visible, active]);
			const choose = (index) => {
				if (disabled || !filtered[index]) return;
				onChange(filtered[index].id);
				setOpen(false);
				setActive(-1);
				input.current?.focus();
			};
			return h$2("div", { style: {
				flex: 1,
				minWidth: 0
			} }, h$2("input", {
				ref: input,
				className: "dshp-select",
				value,
				disabled,
				placeholder,
				spellCheck: false,
				autoComplete: "off",
				role: "combobox",
				"aria-label": label,
				"aria-autocomplete": "list",
				"aria-expanded": visible,
				"aria-controls": visible ? `${id}-list` : void 0,
				"aria-activedescendant": visible && active >= 0 ? `${id}-${active}` : void 0,
				style: { cursor: "text" },
				onFocus: () => {
					place();
					setOpen(true);
				},
				onClick: () => {
					place();
					setOpen(true);
				},
				onBlur: () => {
					setOpen(false);
					setActive(-1);
				},
				onChange: (e) => {
					onChange(e.target.value.trim());
					setActive(-1);
					setOpen(true);
				},
				onKeyDown: (e) => {
					if (e.nativeEvent.isComposing) return;
					if (e.key === "Escape") {
						e.preventDefault();
						setOpen(false);
						setActive(-1);
					} else if (e.key === "Tab") setOpen(false);
					else if (["ArrowDown", "ArrowUp"].includes(e.key) && filtered.length) {
						e.preventDefault();
						place();
						setOpen(true);
						setActive((i) => i < 0 ? e.key === "ArrowDown" ? 0 : filtered.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
					} else if (e.key === "Enter" && visible && active >= 0) {
						e.preventDefault();
						choose(active);
					}
				}
			}), visible ? h$2("div", {
				ref: list,
				id: `${id}-list`,
				role: "listbox",
				"aria-label": label,
				className: "dshp-menu",
				style: pos
			}, ...filtered.map((row, i) => h$2("div", {
				key: row.id,
				id: `${id}-${i}`,
				role: "option",
				"aria-selected": row.id === value,
				"data-index": i,
				"data-active": i === active,
				className: "dshp-option",
				onPointerMove: () => setActive(i),
				onPointerDown: (e) => e.preventDefault(),
				onClick: () => choose(i)
			}, h$2("span", {
				style: {
					flex: 1,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap"
				},
				title: row.id
			}, row.name === row.id ? row.id : `${row.name} · ${row.id}`), row.id === value ? h$2("span", { "aria-hidden": true }, "✓") : null))) : null);
		}
		//#endregion
		//#region src/client/select.ts
		const h$1 = react.createElement;
		/** Menu appearance and fixed-position behavior follow dsh-free-search. */
		const selectCss = `
.dshp-select{box-sizing:border-box;width:100%;height:36px;padding:0 12px;display:flex;align-items:center;gap:8px;text-align:left;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,transparent);color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dshp-select:hover{border-color:var(--dsw-alias-border-l3,#888)}
.dshp-select:focus-visible,.dshp-select[aria-expanded=true]{outline:2px solid var(--cl-accent,#D97757);outline-offset:2px}
.dshp-select:disabled{opacity:.5;cursor:default}
.dshp-menu{position:fixed;z-index:1100;box-sizing:border-box;padding:4px;overflow-y:auto;overscroll-behavior:contain;border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-menu-surface-fill,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#222);backdrop-filter:var(--dsw-menu-backdrop-filter,none);box-shadow:var(--dsw-elevation-prominent,0 10px 32px rgba(0,0,0,.16),0 0 0 .5px rgba(0,0,0,.1))}
.dshp-option{display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 8px;box-sizing:border-box;border-radius:var(--dsw-radius-md,8px);font-size:13px;line-height:20px;cursor:pointer;user-select:none}
.dshp-option[data-active=true]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
`;
		function Select({ options, value, disabled, label, onChange }) {
			const id = react.useId();
			const trigger = react.useRef(null);
			const list = react.useRef(null);
			const [open, setOpen] = react.useState(false);
			const [active, setActive] = react.useState(0);
			const [pos, setPos] = react.useState({});
			const selected = options.findIndex((option) => option.value === value);
			const place = react.useCallback(() => {
				const r = trigger.current?.getBoundingClientRect();
				if (!r) return;
				const below = window.innerHeight - r.bottom - 12;
				const above = r.top - 12;
				const up = below < Math.min(options.length * 34 + 8, 220) && above > below;
				const width = Math.min(Math.max(r.width, 180), 440, window.innerWidth - 16);
				setPos({
					left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
					width,
					maxHeight: Math.max(0, Math.min(360, (up ? above : below) - 4)),
					...up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }
				});
			}, [options.length]);
			const close = (refocus = false) => {
				setOpen(false);
				if (refocus) trigger.current?.focus();
			};
			const choose = (index) => {
				if (!disabled && options[index]) onChange(options[index].value);
				close(true);
			};
			const show = () => {
				if (!disabled) {
					place();
					setActive(Math.max(0, selected));
					setOpen(true);
				}
			};
			react.useEffect(() => {
				if (disabled) setOpen(false);
			}, [disabled]);
			react.useEffect(() => {
				if (!open) return;
				const pointer = (e) => {
					if (!list.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false);
				};
				const scroll = (e) => {
					if (!list.current?.contains(e.target)) place();
				};
				document.addEventListener("pointerdown", pointer, true);
				window.addEventListener("scroll", scroll, true);
				window.addEventListener("resize", place);
				return () => {
					document.removeEventListener("pointerdown", pointer, true);
					window.removeEventListener("scroll", scroll, true);
					window.removeEventListener("resize", place);
				};
			}, [open, place]);
			react.useEffect(() => {
				list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
			}, [active, open]);
			return h$1("div", { style: { minWidth: 0 } }, h$1("button", {
				ref: trigger,
				type: "button",
				className: "dshp-select",
				disabled,
				role: "combobox",
				"aria-label": label,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				"aria-controls": open ? `${id}-list` : void 0,
				"aria-activedescendant": open ? `${id}-${active}` : void 0,
				onBlur: () => close(),
				onClick: () => open ? close() : show(),
				onKeyDown: (e) => {
					if (disabled) return;
					if (!open) {
						if ([
							"ArrowDown",
							"ArrowUp",
							"Enter",
							" "
						].includes(e.key)) {
							e.preventDefault();
							show();
						}
					} else if (e.key === "Escape") {
						e.preventDefault();
						close(true);
					} else if (e.key === "Tab") close();
					else if ([
						"ArrowDown",
						"ArrowUp",
						"Home",
						"End"
					].includes(e.key)) {
						e.preventDefault();
						setActive((i) => e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
					} else if (["Enter", " "].includes(e.key)) {
						e.preventDefault();
						choose(active);
					}
				}
			}, h$1("span", { style: {
				flex: 1,
				minWidth: 0,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			} }, options[selected]?.label), h$1("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				style: { transform: open ? "rotate(180deg)" : void 0 }
			}, h$1("path", {
				d: "M4 6l4 4 4-4",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6
			}))), open ? h$1("div", {
				ref: list,
				id: `${id}-list`,
				role: "listbox",
				"aria-label": label,
				className: "dshp-menu",
				style: pos
			}, ...options.map((option, i) => h$1("div", {
				key: option.value,
				id: `${id}-${i}`,
				role: "option",
				"aria-selected": i === selected,
				"data-index": i,
				"data-active": i === active,
				className: "dshp-option",
				onPointerMove: () => setActive(i),
				onPointerDown: (e) => e.preventDefault(),
				onClick: () => choose(i)
			}, h$1("span", { style: { flex: 1 } }, option.label), h$1("span", { style: { width: 14 } }, i === selected ? h$1("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				"aria-hidden": true
			}, h$1("path", {
				d: "M3.5 8.5 6.5 11.5 12.5 4.5",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.7,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			})) : null)))) : null);
		}
		//#endregion
		//#region src/client/locales.ts
		/** Settings page copy. */
		const zh = {
			nav: "网络代理",
			title: "网络代理",
			subtitle: "为 DeepSeek Harness 配置全局代理，或为某个模型提供商单独配置代理。保存后立即生效，无需重启。",
			globalTitle: "全局代理",
			globalHint: "开启后，模型请求、联网搜索、网页抓取、HTTP MCP 以及 Agent 启动的命令都走这个代理。关闭时沿用启动时的 HTTP(S)_PROXY 环境变量。",
			enabled: "启用",
			proxyMode: "代理方式",
			off: "关闭（沿用启动设置）",
			system: "系统代理（自动检测）",
			manual: "手动代理",
			detected: "检测到系统代理：",
			notDetected: "未检测到可用的系统 HTTP(S) 代理；将沿用启动设置。",
			detectFailed: "系统代理检测不可用，请重试。",
			refresh: "重新检测",
			proxyUrl: "代理地址",
			proxyUrlPlaceholder: "http://127.0.0.1:7890",
			noProxy: "不走代理的主机",
			noProxyHint: "每行一个或用逗号分隔，例如 internal.example.com；会同时匹配子域名。本机地址始终直连。",
			providersTitle: "按提供商代理",
			providersHint: "只影响该提供商的模型请求（含“获取可用模型”），优先级高于全局代理。",
			followGlobal: "跟随全局",
			useProxy: "使用代理",
			direct: "直连",
			noProviders: "还没有已配置的模型提供商。可以在下方输入提供商 id 添加（例如 deepseek-official、anthropic）。",
			addProvider: "添加提供商 id",
			addProviderPlaceholder: "例如 anthropic、openai、my-gateway",
			add: "添加",
			accent: "强调色",
			accentHint: "对 copylee 的全部插件生效",
			accentOrange: "陶土橙",
			accentBlue: "蓝色",
			accentBlack: "黑色",
			save: "保存",
			discard: "放弃修改",
			saving: "正在保存…",
			saved: "已保存，已对后续请求生效。",
			loading: "正在加载…",
			loadFailed: "加载失败：",
			saveFailed: "保存失败：",
			readOnly: "当前配置是只读的（可能被启动参数或全局补丁覆盖），无法在这里修改。",
			notMounted: "没有找到 dsh-proxy 插件条目，请确认插件已安装并启用。",
			invalid: "地址无效：",
			unsaved: "有未保存的修改"
		};
		const en = {
			nav: "Network proxy",
			title: "Network proxy",
			subtitle: "Set a global proxy for DeepSeek Harness, or a proxy for one model provider. Changes apply immediately, no restart needed.",
			globalTitle: "Global proxy",
			globalHint: "When on, model requests, web search, web fetch, HTTP MCP and commands the agent runs all use this proxy. When off, the HTTP(S)_PROXY variables from launch apply.",
			enabled: "Enabled",
			proxyMode: "Proxy mode",
			off: "Off (use launch settings)",
			system: "System proxy (auto-detect)",
			manual: "Manual proxy",
			detected: "Detected system proxy: ",
			notDetected: "No system HTTP(S) proxy detected; launch settings apply.",
			detectFailed: "System proxy detection unavailable. Please retry.",
			refresh: "Detect again",
			proxyUrl: "Proxy URL",
			proxyUrlPlaceholder: "http://127.0.0.1:7890",
			noProxy: "Hosts that bypass the proxy",
			noProxyHint: "One per line or comma-separated, e.g. internal.example.com; subdomains match too. Loopback is always direct.",
			providersTitle: "Per-provider proxy",
			providersHint: "Affects only that provider's model requests (including \"Fetch available models\") and takes precedence over the global proxy.",
			followGlobal: "Follow global",
			useProxy: "Use proxy",
			direct: "Direct",
			noProviders: "No model providers are configured yet. Add a provider id below (e.g. deepseek-official, anthropic).",
			addProvider: "Add provider id",
			addProviderPlaceholder: "e.g. anthropic, openai, my-gateway",
			add: "Add",
			accent: "Accent colour",
			accentHint: "applies to every copylee plugin",
			accentOrange: "Terracotta",
			accentBlue: "Blue",
			accentBlack: "Black",
			save: "Save",
			discard: "Discard changes",
			saving: "Saving…",
			saved: "Saved. Applies to the next request.",
			loading: "Loading…",
			loadFailed: "Failed to load: ",
			saveFailed: "Failed to save: ",
			readOnly: "This configuration is read-only here (a launch flag or home patch overrides it).",
			notMounted: "No dsh-proxy plugin entry was found. Make sure the plugin is installed and enabled.",
			invalid: "Invalid URL: ",
			unsaved: "Unsaved changes"
		};
		//#endregion
		//#region src/client/nav-icon.ts
		/**
		* Give the "网络代理" row in the DSH settings navigation a network icon
		* instead of the shell's fallback gear.
		*
		* `settings.section` registrations only carry `id`, `order` and `label`; the
		* shell picks icons for built-in ids only. So the row is marked by its label
		* and CSS swaps the glyph (drawn as a currentColor mask so hover / active
		* colors still apply).
		*/
		const MARKER = "data-dsh-proxy-settings-nav";
		const ICON_SVG = "%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='16' y='16' width='6' height='6' rx='1'/%3E%3Crect x='2' y='16' width='6' height='6' rx='1'/%3E%3Crect x='9' y='2' width='6' height='6' rx='1'/%3E%3Cpath d='M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3'/%3E%3Cpath d='M12 12V8'/%3E%3C/svg%3E";
		const navIconCss = `
[${MARKER}] > svg:first-child { display: none; }
[${MARKER}]::before {
  content: '';
  flex: none;
  width: 16px;
  height: 16px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml,${ICON_SVG}") center / contain no-repeat;
  mask: url("data:image/svg+xml,${ICON_SVG}") center / contain no-repeat;
}
`;
		/** Keep the marker on the settings-nav button that carries one of `labels`; returns a disposer. */
		function registerNavIcon(...labels) {
			const style = document.createElement("style");
			style.setAttribute("data-dsh-proxy", "nav-icon");
			style.textContent = navIconCss;
			document.head.appendChild(style);
			let disposed = false;
			let frame = 0;
			const sync = () => {
				frame = 0;
				if (disposed) return;
				const dialogs = document.querySelectorAll("[role=\"dialog\"]");
				if (dialogs.length === 0) return;
				for (const dialog of dialogs) for (const button of dialog.querySelectorAll("nav button")) {
					const mine = labels.includes(button.textContent?.trim() ?? "");
					if (mine && !button.hasAttribute(MARKER)) button.setAttribute(MARKER, "");
					else if (!mine && button.hasAttribute(MARKER)) button.removeAttribute(MARKER);
				}
			};
			sync();
			const observer = new MutationObserver(() => {
				if (frame === 0) frame = requestAnimationFrame(sync);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return () => {
				disposed = true;
				if (frame !== 0) cancelAnimationFrame(frame);
				observer.disconnect();
				style.remove();
				document.querySelectorAll(`[${MARKER}]`).forEach((element) => element.removeAttribute(MARKER));
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
		//#endregion
		//#region src/client/model.ts
		/** Read a stored (possibly partial or foreign) section into the form. */
		function draftFrom(value) {
			const section = isObject(value) ? value : {};
			const global = isObject(section.global) ? section.global : {};
			const providers = isObject(section.providers) ? section.providers : {};
			const draft = {
				global: {
					enabled: global.enabled === true,
					...global.mode === "system" ? { mode: "system" } : {},
					url: typeof global.url === "string" ? global.url : "",
					noProxyText: Array.isArray(global.noProxy) ? global.noProxy.filter((item) => typeof item === "string").join("\n") : ""
				},
				providers: {}
			};
			for (const [id, raw] of Object.entries(providers)) {
				if (!isObject(raw)) continue;
				const url = typeof raw.url === "string" ? raw.url : "";
				const choice = !(raw.enabled !== false) ? "global" : raw.mode === "direct" ? "direct" : raw.mode === "system" ? "system" : "proxy";
				draft.providers[id] = {
					choice,
					url
				};
			}
			return draft;
		}
		/** Build the section to store. "Follow global" keeps a typed URL as a disabled entry so it is not lost. */
		function settingsFrom(draft) {
			const providers = {};
			for (const [id, entry] of Object.entries(draft.providers)) {
				const url = entry.url.trim();
				if (entry.choice === "global") {
					if (url !== "") providers[id] = {
						enabled: false,
						mode: "proxy",
						url
					};
				} else providers[id] = {
					enabled: true,
					mode: entry.choice,
					url: entry.choice === "proxy" ? url : ""
				};
			}
			return {
				global: {
					enabled: draft.global.enabled,
					...draft.global.mode === "system" ? { mode: "system" } : {},
					url: draft.global.url.trim(),
					noProxy: splitHosts(draft.global.noProxyText)
				},
				providers
			};
		}
		/** Split a NO_PROXY text box on commas, whitespace and newlines. */
		function splitHosts(text) {
			return [...new Set(text.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
		}
		/**
		* Validate what would be applied.
		* @returns field key (`global` or a provider id) → message; empty when valid.
		*/
		function validate(draft) {
			const errors = {};
			const check = (key, url) => {
				try {
					parseProxyUrl(url);
				} catch (error) {
					errors[key] = error.message;
				}
			};
			if (draft.global.enabled && draft.global.mode !== "system") check("global", draft.global.url);
			for (const [id, entry] of Object.entries(draft.providers)) if (entry.choice === "proxy") check(id, entry.url);
			return errors;
		}
		/**
		* The providers the page lists: the ones currently registered (configured on
		* the Models page) and any id the section already names. Catalog providers
		* that are only declared are offered as suggestions instead, so the list does
		* not fill with every provider the installed catalog knows.
		*/
		function providerRows(registered, declared, configured) {
			const names = /* @__PURE__ */ new Map();
			for (const item of declared) names.set(item.provider, item.displayName ?? item.provider);
			const rows = /* @__PURE__ */ new Map();
			for (const item of registered) rows.set(item.id, {
				id: item.id,
				name: names.get(item.id) ?? item.name ?? item.id
			});
			for (const id of configured) if (!rows.has(id)) rows.set(id, {
				id,
				name: names.get(id) ?? id
			});
			const suggestions = [...names].filter(([id]) => !rows.has(id)).map(([id, name]) => ({
				id,
				name
			}));
			return {
				rows: [...rows.values()],
				suggestions
			};
		}
		/** A provider id a user may type: what the Models page accepts. */
		function isProviderId(text) {
			return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(text);
		}
		function isObject(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		//#endregion
		//#region src/client/index.ts
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
		/** The Loader entry id this page edits; see cordis.patch.yml. */
		const ENTRY_ID = "dsh-proxy";
		const NS = "settings.dshProxy";
		const h = react.createElement;
		const S = {
			page: {
				display: "grid",
				gap: 20,
				maxWidth: 880,
				paddingBottom: 32,
				color: "var(--dsw-alias-label-primary, inherit)"
			},
			title: {
				margin: 0,
				fontSize: 20,
				fontWeight: 600
			},
			subtitle: {
				margin: "6px 0 0",
				fontSize: 13,
				lineHeight: 1.6,
				color: "var(--dsw-alias-label-secondary, #666)"
			},
			card: {
				display: "grid",
				gap: 14,
				padding: 16,
				borderRadius: "var(--dsw-radius-lg, 12px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))"
			},
			cardTitle: {
				margin: 0,
				fontSize: 15,
				fontWeight: 600
			},
			hint: {
				margin: 0,
				fontSize: 12,
				lineHeight: 1.55,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			label: {
				display: "grid",
				gap: 6,
				fontSize: 13,
				fontWeight: 500
			},
			input: {
				boxSizing: "border-box",
				width: "100%",
				padding: "8px 10px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))",
				background: "transparent",
				color: "inherit",
				fontFamily: "var(--ds-font-family-code, monospace)"
			},
			row: {
				display: "grid",
				gridTemplateColumns: "minmax(100px, 1fr) 200px minmax(160px, 1.4fr)",
				gap: 10,
				alignItems: "center",
				padding: "8px 0",
				borderTop: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.15))"
			},
			providerName: {
				fontSize: 13,
				fontWeight: 500,
				overflow: "hidden",
				textOverflow: "ellipsis"
			},
			providerId: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #888)",
				fontFamily: "var(--ds-font-family-code, monospace)"
			},
			error: {
				fontSize: 12,
				color: "var(--dsw-alias-state-error-primary, #d33)"
			},
			ok: {
				fontSize: 12,
				color: "var(--dsw-alias-state-success-primary, #2a2)"
			},
			toggle: {
				display: "flex",
				gap: 8,
				alignItems: "center",
				fontSize: 13,
				cursor: "pointer"
			},
			actions: {
				display: "flex",
				gap: 10,
				alignItems: "center",
				flexWrap: "wrap"
			},
			primary: {
				padding: "7px 16px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: `1px solid ${ACCENT}`,
				background: ACCENT,
				color: ACCENT_INK,
				cursor: "pointer"
			},
			secondary: {
				padding: "7px 14px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))",
				background: "transparent",
				color: "inherit",
				cursor: "pointer"
			},
			addRow: {
				display: "flex",
				gap: 8
			}
		};
		function ProxySection({ api }) {
			const { t } = api;
			const [status, setStatus] = react.useState("loading");
			const [message, setMessage] = react.useState(null);
			const [writable, setWritable] = react.useState(false);
			const [view, setView] = react.useState(void 0);
			const [providers, setProviders] = react.useState([]);
			const [suggestions, setSuggestions] = react.useState([]);
			const [draft, setDraft] = react.useState(() => draftFrom(void 0));
			const [dirty, setDirty] = react.useState(false);
			const [saving, setSaving] = react.useState(false);
			const [newId, setNewId] = react.useState("");
			const [system, setSystem] = react.useState(null);
			const [detectError, setDetectError] = react.useState(false);
			const refreshSystem = react.useCallback(async () => {
				try {
					setSystem(await api.detect());
					setDetectError(false);
				} catch {
					setDetectError(true);
				}
			}, [api]);
			const needsSystem = draft.global.enabled && draft.global.mode === "system" || Object.values(draft.providers).some((entry) => entry.choice === "system");
			react.useEffect(() => {
				if (!needsSystem) return;
				refreshSystem();
				const timer = setInterval(() => {
					refreshSystem();
				}, 3e4);
				return () => clearInterval(timer);
			}, [needsSystem, refreshSystem]);
			const dirtyRef = react.useRef(false);
			dirtyRef.current = dirty;
			const load = react.useCallback(async (resetDraft) => {
				try {
					const result = await api.load();
					setWritable(result.writable);
					setView(result.view);
					setProviders(result.providers);
					setSuggestions(result.suggestions);
					if (resetDraft || !dirtyRef.current) {
						setDraft(draftFrom(result.view?.value));
						setDirty(false);
					}
					setStatus("ready");
				} catch (error) {
					setStatus("error");
					setMessage({
						kind: "error",
						text: t("loadFailed") + error.message
					});
				}
			}, [api, t]);
			react.useEffect(() => {
				load(true);
				return api.subscribe(() => {
					load(false);
				});
			}, [api, load]);
			const errors = validate(draft);
			const edit = (update) => {
				setDraft((previous) => {
					const next = structuredClone(previous);
					update(next);
					return next;
				});
				setDirty(true);
				setMessage(null);
			};
			const save = async () => {
				if (view === void 0 || Object.keys(errors).length > 0) return;
				setSaving(true);
				try {
					await api.save(draft, view.revision);
					setMessage({
						kind: "ok",
						text: t("saved")
					});
					setDirty(false);
					await load(true);
				} catch (error) {
					setMessage({
						kind: "error",
						text: t("saveFailed") + error.message
					});
				} finally {
					setSaving(false);
				}
			};
			if (status === "loading") return h("div", { style: S.page }, t("loading"));
			const disabled = !writable || view === void 0 || saving;
			const shown = [...providers];
			for (const id of Object.keys(draft.providers)) if (!shown.some((row) => row.id === id)) shown.push({
				id,
				name: id
			});
			const choiceOf = (id) => draft.providers[id]?.choice ?? "global";
			const urlOf = (id) => draft.providers[id]?.url ?? "";
			return h("div", { style: S.page }, h("style", null, selectCss), h("div", null, h("h2", { style: S.title }, t("title")), h("p", { style: S.subtitle }, t("subtitle"))), view === void 0 ? h("div", { style: S.error }, t("notMounted")) : null, view !== void 0 && !writable ? h("div", { style: S.error }, t("readOnly")) : null, h("section", { style: S.card }, h("h3", { style: S.cardTitle }, t("globalTitle")), h("p", { style: S.hint }, t("globalHint")), h("div", { style: S.label }, t("proxyMode"), h(Select, {
				label: t("proxyMode"),
				disabled,
				value: !draft.global.enabled ? "off" : draft.global.mode === "system" ? "system" : "proxy",
				options: [
					{
						value: "off",
						label: t("off")
					},
					{
						value: "system",
						label: t("system")
					},
					{
						value: "proxy",
						label: t("manual")
					}
				],
				onChange: (value) => edit((next) => {
					next.global.enabled = value !== "off";
					next.global.mode = value === "system" ? "system" : "proxy";
				})
			})), draft.global.enabled && draft.global.mode === "system" ? h("div", { style: S.actions }, h("span", {
				style: detectError ? S.error : S.hint,
				role: "status"
			}, detectError ? t("detectFailed") : system ? `${t("detected")}${system.url} (${system.source})` : t("notDetected")), h("button", {
				type: "button",
				style: S.secondary,
				onClick: () => {
					refreshSystem();
				}
			}, t("refresh"))) : null, draft.global.mode !== "system" ? h("label", { style: S.label }, t("proxyUrl"), h("input", {
				style: S.input,
				value: draft.global.url,
				placeholder: t("proxyUrlPlaceholder"),
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.global.url = value;
					});
				}
			}), errors.global === void 0 ? null : h("span", { style: S.error }, t("invalid") + errors.global)) : null, h("label", { style: S.label }, t("noProxy"), h("textarea", {
				style: {
					...S.input,
					minHeight: 64,
					resize: "vertical"
				},
				value: draft.global.noProxyText,
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.global.noProxyText = value;
					});
				}
			}), h("span", { style: S.hint }, t("noProxyHint")))), h("section", { style: S.card }, h("h3", { style: S.cardTitle }, t("providersTitle")), h("p", { style: S.hint }, t("providersHint")), shown.length === 0 ? h("p", { style: S.hint }, t("noProviders")) : null, ...shown.map((row) => h("div", {
				key: row.id,
				style: S.row
			}, h("div", null, h("div", {
				style: S.providerName,
				title: row.name
			}, row.name), h("div", { style: S.providerId }, row.id)), h(Select, {
				label: `${row.name} ${t("proxyMode")}`,
				value: choiceOf(row.id),
				disabled,
				options: [
					{
						value: "global",
						label: t("followGlobal")
					},
					{
						value: "system",
						label: t("system")
					},
					{
						value: "proxy",
						label: t("useProxy")
					},
					{
						value: "direct",
						label: t("direct")
					}
				],
				onChange: (value) => {
					const choice = value;
					edit((next) => {
						next.providers[row.id] = {
							choice,
							url: next.providers[row.id]?.url ?? ""
						};
					});
				}
			}), h("div", null, choiceOf(row.id) === "proxy" ? h("input", {
				style: S.input,
				value: urlOf(row.id),
				placeholder: t("proxyUrlPlaceholder"),
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.providers[row.id] = {
							choice: "proxy",
							url: value
						};
					});
				}
			}) : null, choiceOf(row.id) === "system" ? h("span", { style: S.hint }, detectError ? t("detectFailed") : system ? `${t("detected")}${system.url}` : t("notDetected")) : null, errors[row.id] === void 0 ? null : h("div", { style: S.error }, t("invalid") + errors[row.id])))), h("div", { style: S.addRow }, h(ProviderPicker, {
				value: newId,
				placeholder: t("addProviderPlaceholder"),
				label: t("addProvider"),
				disabled,
				options: suggestions.filter((row) => !shown.some((item) => item.id === row.id)),
				onChange: setNewId
			}), h("button", {
				type: "button",
				style: S.secondary,
				disabled: disabled || !isProviderId(newId) || shown.some((row) => row.id === newId),
				onClick: () => {
					const id = newId;
					edit((next) => {
						next.providers[id] = {
							choice: "proxy",
							url: ""
						};
					});
					setNewId("");
				}
			}, t("add")))), h("div", { style: S.actions }, h("button", {
				type: "button",
				style: {
					...S.primary,
					opacity: disabled || !dirty || Object.keys(errors).length > 0 ? .5 : 1
				},
				disabled: disabled || !dirty || Object.keys(errors).length > 0,
				onClick: () => {
					save();
				}
			}, saving ? t("saving") : t("save")), h("button", {
				type: "button",
				style: S.secondary,
				disabled: !dirty || saving,
				onClick: () => {
					setDraft(draftFrom(view?.value));
					setDirty(false);
					setMessage(null);
				}
			}, t("discard")), dirty ? h("span", { style: S.hint }, t("unsaved")) : null, message === null ? null : h("span", { style: message.kind === "ok" ? S.ok : S.error }, message.text)), h(AccentPicker, {
				label: t("accent"),
				hint: t("accentHint"),
				names: {
					orange: t("accentOrange"),
					blue: t("accentBlue"),
					black: t("accentBlack")
				}
			}));
		}
		function unwrap(result) {
			if (result.ok) return result.value;
			throw new Error(result.error.message);
		}
		function createApi(ctx, t) {
			return {
				t,
				async detect() {
					const response = await fetch("/api/dsh-proxy/proxy-status", {
						method: "POST",
						credentials: "same-origin"
					});
					if (!response.ok) throw new Error("System proxy detection unavailable");
					return unwrap(await response.json()).system;
				},
				async load() {
					const [described, registered, declared] = await Promise.all([
						ctx.remote.settings.describe(),
						ctx.remote.llm.listProviders().catch(() => ({
							ok: true,
							value: []
						})),
						ctx.remote.llm.listConfigurableProviders().catch(() => ({
							ok: true,
							value: []
						}))
					]);
					const settings = unwrap(described);
					const view = settings.namespaces.find((item) => item.ns === ENTRY_ID);
					const configured = Object.keys(draftFrom(view?.value).providers);
					const { rows, suggestions } = providerRows(registered.ok ? registered.value : [], declared.ok ? declared.value : [], configured);
					return {
						writable: settings.writable,
						view,
						providers: rows,
						suggestions
					};
				},
				async save(draft, revision) {
					const next = settingsFrom(draft);
					unwrap(await ctx.remote.settings.mutate(ENTRY_ID, [{
						op: "set",
						path: ["global"],
						value: next.global
					}, {
						op: "set",
						path: ["providers"],
						value: next.providers
					}], revision));
				},
				subscribe(listener) {
					return ctx.remote.$on?.("settings/document-updated", (ns) => {
						if (ns === "dsh-proxy") listener();
					}) ?? (() => {});
				}
			};
		}
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.settings",
			"remote.llm"
		];
		function apply(ctx) {
			ctx.effect(() => installAccent(), "dsh-proxy: accent colour");
			let t = (key) => zh[key];
			if (ctx.locale !== void 0) {
				const locale = ctx.locale;
				ctx.effect(() => locale.register(NS, {
					zh,
					en
				}), "dsh-proxy: dictionaries");
				const bound = locale.bind(NS);
				t = (key) => bound(key);
			} else if (typeof navigator !== "undefined" && !navigator.language.startsWith("zh")) t = (key) => en[key];
			const api = createApi(ctx, t);
			ctx.effect(() => registerNavIcon(zh.nav, en.nav), "dsh-proxy: settings nav icon");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-proxy",
				order: 60,
				label: () => t("nav")
			}, () => h(ProxySection, { api })));
		}
		//#endregion
		exports.ENTRY_ID = ENTRY_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
