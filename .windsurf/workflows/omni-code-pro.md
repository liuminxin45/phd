---
description: Architecture-first, pluginized Electron workbench (maintainable + isolated + minimal host)
auto_execution_mode: 3
---

# Omni Code Pro - Architecture & Implementation Guardrails (Desktop Workbench)

You are not a “code generator”. You are the project’s chief architect + tech lead.
Top priorities (descending):
1) Maintainability (clear boundaries, low coupling, easy debugging)
2) Isolation (platform vs plugins, renderer vs main, typed IPC only)
3) Minimalism (small host, minimal plugin contract, avoid unnecessary runtime complexity)
4) Prefer mature OSS / npm libs over bespoke code (but keep dependency surface small)

If anything conflicts, prioritize (1) and (2).

---

## Step 0 — Design System First (Hard Gate)

**Call `/ui-ux-pro-max` and generate design-system files before any UI code.**

Must exist (commit these files before proceeding):
- design-system/MASTER.md
- design-system/pages/shell.md
- design-system/pages/plugins.md
- design-system/pages/logs.md
- design-system/pages/settings.md

Rules:
- React UI must consume tokens from these files (CSS variables + Tailwind mapping).
- No hard-coded colors/spacing unless explicitly allowed by design-system.

---

## Step 1 — Requirements Extraction & Scope Lock (Hard Gate)

Extract and restate:
- Product shape: Sidebar (plugin nav) + Workspace (multi-tabs) + Internal pages (Plugins/Logs/Settings)
- Phase scope: WebApp-only plugins (siyuan/n8n/bookmarks). No phabricator. No plugin backend handlers in Phase 1.
- Architecture constraints:
  - main = backend carrier (tabs/webviews, plugin mgmt, logging, optional capture skeleton, sqlite)
  - renderer = React UI only (no fs access, no cross-origin fetch/collection)
  - preload = minimal typed bridge (window.omni), whitelist-only IPC

Output a short “Scope Lock” section in docs/ARCHITECTURE.md before coding.

---

## Step 2 — Pick Toolchain & OSS Libraries (Prefer Official, Keep Minimal)

### 2.1 Electron + Vite scaffold (choose one, justify)
Option A (recommended official path):
- Electron Forge + Vite plugin/template (official Forge integration)  
  - create with: `npx create-electron-app@latest omni-workbench --template=vite`
Option B:
- electron-vite (fast, focused build tooling)

Choose ONE and document the reason in docs/ARCHITECTURE.md.
References:
- Electron Forge Vite template / plugin-vite docs
- electron-vite docs

### 2.2 Required npm libs (use these unless there’s a hard blocker)
- Workspace: pnpm + TypeScript
- Manifest validation: zod
- File watch: chokidar
- URL glob match (future capture): micromatch
- SQLite: better-sqlite3 (fallback to sqlite3 only if ABI/build issues)
- Logging: pino + rotating transport (JSONL output)
- UI: Tailwind + lightweight component layer (shadcn-like is fine), router (React Router), state (zustand)

Keep dependency count lean. Every new dependency must be justified with:
- what it replaces
- why it is stable/mature
- what boundary it stays inside (which package)

---

## Step 3 — Repository Skeleton (Packages First, Apps Later)

Create pnpm workspace with clear layering. Suggested structure:

- apps/desktop-main
- apps/desktop-renderer
- packages/shared            # protocol/types only
- packages/plugin-manager    # plugin discovery/registry/validation (independent)
- packages/logging           # LogEvent + main log service + query helpers
- packages/storage           # sqlite schema + repo access layer
- packages/tab-host          # BrowserView/WebContentsView abstraction + lifecycle
- packages/capture           # CDP capture skeleton (disabled by default)
- packages/plugin-sdk        # future-facing minimal SDK (types + logger facade)
- plugins/                   # local plugins
- design-system/
- docs/

Hard boundary rule:
- shared has zero Electron deps
- renderer cannot import from main packages (except shared types via preload API typing)
- plugin-manager must not import Electron/UI
- apps only compose packages; packages should remain reusable

---

## Step 4 — Enforce Boundaries Automatically (Hard Gate)

Add architectural enforcement early to prevent “gradual spaghetti”:

- Add ESLint + TypeScript + Prettier
- Add a boundary tool (choose one):
  - eslint-plugin-boundaries (simple enforcement in lint)
  - or dependency-cruiser (stronger analysis/visualization)

Create rules that ensure:
- No cross-layer imports (e.g., renderer importing tab-host internals)
- Only public entrypoints allowed (e.g., `packages/*/src/index.ts`)
- No deep imports into other packages’ internal folders

Add scripts:
- `pnpm -r lint`
- `pnpm -r typecheck`
- `pnpm -r test` (can be minimal at Phase 1)
- `pnpm -r depcheck` (your boundary tool)

Workflow must not proceed to feature coding until these pass once.

---

## Step 5 — Plugin System (Phase 1: WebApp-only, Minimal Contract)

Implement packages/plugin-manager with:
- Discovery: scan `./plugins/<pluginId>/manifest.json`
- Validation: zod schema + helpful error messages
- Registry: enable/disable state stored in one place (e.g., `./plugins/.registry.json` or electron-store)
- Hot reload (dev): chokidar watch plugins dir, refresh list (no need for seamless web reload)

Manifest minimal fields (Phase 1):
- id, name, version
- nav: group, order, icon
- webapps[]: appId, title, url, partition, allowMultipleInstances
- permissions.hosts[]: host allowlist required for opening tabs (and future capture)

Hard rule:
- tabs.openWebApp MUST validate target url host is allowed by that plugin, else reject + log warn.

---

## Step 6 — Tab Host (Web Contents in main, UI in renderer)

Implement packages/tab-host:
- Underlying container: BrowserView or WebContentsView (wrap behind interface so you can swap later)
- Core APIs: list/open/close/activate, back/forward/reload, get title/url
- Graceful failure: navigation errors show a friendly error state and log it (no crash)

Renderer responsibilities:
- TabBar + Toolbar UI only; all actions go through window.omni (typed IPC).

---

## Step 7 — Unified Logging (Phase 1 Must Be Fully Usable)

Implement packages/logging:
- LogEvent type: ts, level, module, message, pluginId?, data?
- main LogService:
  - write JSONL to `logs/omni.jsonl`
  - rotation by size or day
  - query API: tail last N, filter by level/module/pluginId, simple search
- renderer logger:
  - IPC to main (renderer never writes files)
- preload:
  - expose window.omni.logs.{write,query,openLogDir,subscribe?}
- UI Logs page:
  - list + filter + search + detail drawer + export JSON

Make “open logs directory” a first-class debug affordance.

---

## Step 8 — Capture Skeleton (Phase 1: Provide framework, default OFF)

Implement packages/capture as a *disabled-by-default* service:
- attach/detach with tab lifecycle
- CDP wiring exists, but no plugin rules required in Phase 1
- ensure no resource leaks, no crash if debugger attach fails
- keep implementation minimal; postpone parser/rules to Phase 2

---

## Step 9 — UI Implementation (Strictly Follow design-system Tokens)

In apps/desktop-renderer:
- Shell layout: Sidebar + Workspace + TabBar + Toolbar
- Internal pages:
  - Plugins: list plugins, enabled toggle, reload
  - Logs: viewer as defined above
  - Settings: placeholder with real layout and token usage
- Sidebar:
  - group + search + reserved badge slot (UI only; data can be stubbed)

Token rules:
- derive Tailwind theme from CSS variables
- no ad-hoc colors/spacing
- prefer small reusable components (Button, Input, ListItem, Tab, Drawer)

---

## Step 10 — Phase 1 Sample Plugins (Only These Three)

Create these under `./plugins/`:

1) siyuan
- webapp url: http://127.0.0.1:6806/
- partition: persist:siyuan
- permissions.hosts: ["127.0.0.1","localhost"]

2) n8n
- webapp url: http://127.0.0.1:5678/
- partition: persist:n8n
- permissions.hosts: ["127.0.0.1","localhost"]

3) bookmarks
- webapps: 3-5 sample urls (corp placeholders ok)
- allowMultipleInstances: true
- permissions.hosts must cover these hosts (wildcards ok)

---

## Delivery Checklist (Must Pass Before You Stop)

- [ ] `pnpm i` then `pnpm dev` works on Windows
- [ ] Boundaries lint passes
- [ ] Plugin list renders; enable/disable persists
- [ ] Open WebApp tabs from Sidebar; multi-tabs; back/forward/reload works
- [ ] Logs are written to JSONL; Logs UI can tail/filter/search/export
- [ ] Unreachable URL does not crash; shows error + writes log
- [ ] preload API is typed and minimal; no direct ipcRenderer usage in renderer
- [ ] docs/ARCHITECTURE.md describes packages, responsibilities, and dependency rules
- [ ] docs/DEBUGGING.md explains logs location + how to open logs dir + basic troubleshooting
- [ ] docs/PLUGIN_GUIDE.md explains manifest + install/enable/hosts allowlist

If any item fails, fix it before adding new features.
