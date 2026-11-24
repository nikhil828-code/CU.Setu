# F-1 — Frontend Build (CampusConnect React SPA)

Task ID: F-1 | Agent: frontend
Scope: React frontend SPA only, inside the existing Next.js 16 project at /home/z/my-project.
The Flask backend (port 5001, /home/z/my-project/mini-services/student-network-api) was already
complete and running — untouched per the task rules.

## What was built

Single-page client-side SPA on `/` (src/app/page.tsx -> AppRoot). All "pages" are client views
switched via a zustand store (no URL routing). All browser API calls go through the gateway as
relative paths with the port in the `XTransformPort=5001` query param.

### Files created
- src/lib/types.ts — all API types mirroring the Flask contract
- src/lib/api.ts — apiFetch<T> wrapper + ApiError(message, status); prefixes /api, appends XTransformPort=5001
- src/lib/time.ts — timeAgo() / fullDate()
- src/lib/avatar.ts — initialsOf() + gradientFor() (deterministic string hash, 8 navy/violet gradients)
- src/lib/invalidate.ts — invalidateNetwork(queryClient) helper (invalidates all prefix roots)
- src/store/app-store.ts — zustand: me, view, profileTarget, setMe, goto, openProfile, logoutLocal
- src/components/student-network/:
  - app-root.tsx — QueryClientProvider + auth bootstrap (/api/auth/me -> feed, else landing) + splash
  - brand-mark.tsx — SVG brand glyph (3 connected nodes) [small addition beyond spec list]
  - user-avatar.tsx — initials gradient avatar, sizes sm/md/lg/xl, optional unread ring, clickable
  - empty-state.tsx, stat-chip.tsx, section-header.tsx — shared primitives
  - landing-view.tsx — navy hero (/hero-network.jpg), live stats with count-up, 3 feature cards, DSA strip, sticky footer
  - login-view.tsx — centered card, demo hint (aarav/pass123 one-click fill)
  - register-view.tsx — split layout with /auth-visual.jpg side panel (lg+), full validation + datalist
  - app-shell.tsx — desktop fixed w-64 navy sidebar + mobile top bar/bottom tabs; polls /api/notifications every 30s; badge counts
  - feed-view.tsx, post-composer.tsx (1000-char counter), post-card.tsx (optimistic like toggle w/ rollback, comments, delete confirm)
  - profile-view.tsx — gradient banner, stats, BFS path chain ("You -> X -> Y", hops label), mutual strip, skills/interests cards, posts
  - edit-profile-dialog.tsx — prefilled form (remounted per open; no effect-setState), PUT /api/profile -> setMe + invalidate
  - connect-button.tsx — shared relationship action for all 5 Relationship states
  - connections-view.tsx — degree summary + collapsible 2nd/3rd degree lists + connection grid + remove confirm
  - requests-view.tsx — Received/Sent tabs with counts, accept/reject/cancel
  - discover-view.tsx — recommendation grid, reason chips, mutual avatar stack, match-score meter
  - search-view.tsx — debounced (250ms) Trie search with keepPreviousData, relationship badges
  - notifications-view.tsx — kind icons, unread highlight (bg-accent/60) + dot, mark-all-read

### Files modified
- src/app/page.tsx — replaced with thin 'use client' + <AppRoot />
- src/app/layout.tsx — metadata only (title/description); Toaster import + body classes untouched
- src/app/globals.css — appended .thin-scrollbar utility (custom slim scrollbars for long lists)

## Verification results
- `bun run lint` — zero errors, zero warnings (fixed one react-hooks/set-state-in-effect in the
  edit dialog by remounting the form on open instead of setState-in-effect).
- Gateway flow verified end to end: `http://localhost:81/` -> 200 with title "CampusConnect —
  University Student Network"; `/api/stats?XTransformPort=5001` -> Flask JSON; login via gateway
  sets session cookie; authed /api/feed returns posts. All response shapes (recommendations with
  relationship+score, search items, notifications, degrees) were diffed against src/lib/types.ts.
- dev.log tail after final writes: only `✓ Compiled` / `GET / 200` entries. The transient
  module-not-found error in the log was from the hot-reload window while files were still being
  written and had already resolved itself.
- SSR of `/` renders the splash screen cleanly ("Connecting to your network…").

## Notes for following agents
- The visible 404s for `/api/*?XTransformPort=5001` in dev.log are MY OWN curls that bypassed the
  gateway and hit the Next dev server directly — the real browser path (through Caddy :81) proxies
  correctly. Not an app issue.
- Toasts use the shadcn toast (`toast` from @/hooks/use-toast) because layout.tsx renders that
  Toaster; sonner's Toaster is NOT mounted.
- Query keys: ['feed'], ['user', username], ['user-posts', username], ['path', username],
  ['requests'], ['connections'], ['degrees'], ['recommendations', scope, limit],
  ['search', q], ['notifications'], ['stats']. invalidateNetwork() invalidates by prefix.
- Auth: login/register success -> queryClient.clear() + setMe + goto('feed'); logout ->
  POST /api/auth/logout then clear + logoutLocal (falls back to local logout on server error).
