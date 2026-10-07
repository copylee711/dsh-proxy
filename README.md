# @copylee/dsh-proxy

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

English | [中文](README.zh.md)

A network proxy plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`):

- **Global proxy**: enter `http://127.0.0.1:7890` under **Settings → Network proxy**, and model requests, web search, web fetch, HTTP MCP, and commands the agent runs all go through it.
- **Per-provider proxy**: give one model provider its own proxy or force it direct. For example, Anthropic through `http://127.0.0.1:7890` and DeepSeek direct.
- **Applies on save**: no dsh restart needed.

Precedence: provider setting > global proxy > `HTTP(S)_PROXY` from launch.

## Install

```sh
dsh plugin --profile web add @copylee/dsh-proxy
```

Restart `dsh web`, and a **Network proxy** page appears in Settings.

> Keep the `@copylee/` scope. The unscoped `dsh-proxy` and `dsh-network-proxy` packages on npm belong to other people and are unrelated.

You can also install straight from GitHub. Built output is committed, so no build script or `allowBuilds` entry is needed:

```sh
dsh plugin --profile web add github:copylee711/dsh-proxy
```

## Use

Open **Settings → Network proxy**:

![The Network proxy page in Settings: a global proxy, and per-provider rows set to Direct or Use proxy](assets/settings-network-proxy.png)

| Area | What it does |
|---|---|
| Global proxy | Tick **Enabled** and enter the proxy URL. **Hosts that bypass the proxy** takes one host per line and matches subdomains too. `localhost` / `127.0.0.1` are always direct. |
| Per-provider proxy | Lists configured model providers. Each can be **Follow global**, **Use proxy**, or **Direct**. Add a provider not in the list by typing its id below it (e.g. `deepseek-official`, `anthropic`, `openai`, or a custom Provider ID from the Models page). |

**Save** applies to the next request, including **Fetch available models** on the Models page.

### System proxy

The global selector offers Off (use launch settings), System proxy (auto-detect), and Manual proxy. Each provider can also select its own system proxy, overriding the global route. Menus follow dsh-free-search's floating cards, hover highlights, and selection checkmarks, with Arrow, Home/End, Enter, Esc, and Tab keyboard support.

Detection tries valid HTTP(S) values from HTTPS_PROXY / https_proxy, HTTP_PROXY / http_proxy, and ALL_PROXY / all_proxy in that order, then Windows current-user Internet Settings or macOS scutil. Linux uses environment variables. A launch environment snapshot prevents the plugin's own installed proxy from feeding back into detection. OS settings are checked every 30 seconds; the settings page also offers Detect again. SOCKS, PAC, and WPAD are not supported. When detection finds no usable proxy, the global layer restores launch settings and provider overrides fall back to the global route with a warning. Status and logs mask proxy credentials.

```yaml
global:
  enabled: true
  mode: system
  noProxy: []
providers:
  openai:
    enabled: true
    mode: system
```

Existing configurations without mode continue using their manual proxy. The global proxy remains disabled by default.

### Accent colour

The bottom of the page offers an accent colour (terracotta, blue or black) for the primary button and focus rings. The choice is shared with the other copylee plugins: changing it in any one of them recolours all of them.

### Configuration file

The same settings live in `$DSH_HOME/profiles/<profile>/cordis.patch.yml` (the Web UI profile is `web`):

```yaml
- id: dsh-proxy
  config:
    global:
      enabled: true
      url: http://127.0.0.1:7890
      noProxy: [internal.example.com]
    providers:
      anthropic:
        mode: proxy
        url: http://127.0.0.1:7890
      deepseek-official:
        mode: direct
```

| Field | Meaning |
|---|---|
| `global.enabled` | Turn the global proxy on. Default `false`, which keeps the launch environment's proxy. |
| `global.url` | Global proxy URL. |
| `global.noProxy` | Hosts reached directly while the global proxy is on. |
| `providers.<id>.enabled` | Use this provider's own setting. Default `true`; `false` follows the global route. |
| `providers.<id>.mode` | `proxy` (use `url`) or `direct` (bypass every proxy, the global one included). |
| `providers.<id>.url` | This provider's proxy URL. |

Proxy URLs may be `http://` or `https://`. A bare `127.0.0.1:7890` becomes `http://127.0.0.1:7890`. Credentials go in the URL: `http://user:password@host:port`.

## How it works

- **Global proxy** installs through dsh's own `@deepseek-ai/dsh-http-proxy`, the package the launcher uses for `HTTP(S)_PROXY`. Loopback bypass, `NO_PROXY` matching, `web_fetch` routing, and the proxy environment of spawned tools therefore behave exactly as upstream. Turning it off restores the launch policy.
- **Per-provider proxy** hooks the `llm/stream` middleware. A provider's model call runs in one async context. The plugin puts that provider's undici `ProxyAgent` (or a direct `Agent`) in an AsyncLocalStorage, and `fetch` uses it inside that context. Other requests are untouched, and concurrent calls to different providers don't interfere.
- Both sections are Cordis volatile fields. Saving in Settings fires `loader/volatile-update`, and the plugin switches routes in place without reloading.

## Limits

- **HTTP(S) proxies only; SOCKS5 is not supported.** The "mixed port" of Clash, v2rayN, and similar apps (e.g. 7890) also speaks HTTP, so use that port.
- **Per-provider routes cover that provider's model requests only** (including model discovery). Web search, web fetch, and other traffic use the global route.
- **Credentials are stored in plain text.** A username and password in the URL are saved in the profile's `cordis.patch.yml`. The global proxy URL also reaches commands the agent runs through their environment.
- **Telemetry stays direct.** It uses Node's `http` module, as it does in upstream dsh.

## Develop

```sh
npm install
npm run typecheck
npm test        # global / per-provider / direct routing against local fake proxies
npm run build   # regenerates lib/ and client/ (commit them)
```

Try it in a local dsh: `dsh plugin --profile web add /path/to/dsh-proxy`.

## License

MIT
