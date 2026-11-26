# 5-a — DSA Playground Frontend

Task ID: 5-a | Agent: frontend
Scope: DSA Playground visualizers (Graph / BFS / Trie / Heap / Hash Map) + wiring only.
Backend (Flask, port 5001, /api/playground/*) untouched. All 5 endpoints' JSON shapes were
curl-verified before coding (graph 48 steps, bfs 19 steps, trie 262 insert steps, heap 148
default steps / 31 for 5 custom values, hashmap 136 steps).

## Files created
- src/components/student-network/playground/playback.tsx — `usePlayback(totalSteps)` hook +
  `PlaybackBar` component: step index, play/pause, prev/next, restart, speed slider 0.5x–3x
  (850ms base interval), "Step i / N" + progress %. Effective `playing` is derived
  (playingIntent && !atEnd) so no setState happens inside the effect body (lint rule).
- src/components/student-network/playground/circle-graph.tsx — shared CircleGraph SVG
  (640x640 viewBox, nodes on a circle sorted by username, blue #3B82F6 fill + radial glow,
  cyan edges, optional per-node ring/dim, node click -> degree popover handled by caller).
  Edge draw-in uses framer-motion pathLength (verified framer sets pathLength="1" attr +
  stroke-dasharray, works on <line>).
- src/components/student-network/playground/graph-tab.tsx — replays add_vertex (48)/add_edge
  steps; nodes fade in, cyan edges draw; stats badges (20 vertices · 28 edges · shown n/m);
  scrollable step log with amber current line; click node -> "@user · full name · degree N"
  strip.
- src/components/student-network/playground/bfs-tab.tsx — source Select (defaults to the
  logged-in student; derived default, no setState-in-effect) + Run BFS; BfsTraceReplay
  keyed by source so playback resets per trace. Levels: 0 amber #F59E0B, 1 cyan #22D3EE,
  2 blue #3B82F6, 3+ violet #8B5CF6; unvisited slate dim; current node pulsing #F97316 ring;
  discovery edges orange; queue chip row (front chip orange) reflects steps[i].queue;
  level badge; "N students reachable from @x" at end.
- src/components/student-network/playground/trie-tab.tsx — tree layout computed once from
  the final `tree` (recursive leaf-slot layout: 116 nodes, 27 leaf slots, depth 9); insert
  replay derivation adds visible paths/terminal owners/active-word amber path + current-char
  amber node; terminal nodes get amber dot + SVG <title> owner tooltip; root navy "•".
  Prefix search: jumps insert replay to end, POSTs /playground/trie/search, auto-plays the
  search trace (match steps walk amber path, miss draws red ✕ at the divergence parent +
  rose "no words start with this prefix", collect highlights the subtree cyan + lists
  matched students), Clear button restores insert mode. Search input lowercased+trimmed.
- src/components/student-network/playground/heap-tab.tsx — default POST {} (real
  connection counts) or custom comma-separated values (validated: finite numbers, ≤24,
  errors toasted); replay keyed by mode. Array view: index-labelled boxes (motion layout —
  swaps slide, pt-6 so index labels aren't clipped by overflow-x-auto) with amber ring on
  swap positions; tree view: SVG, node i children 2i+1/2i+2 (halved x-span per level),
  root blue-filled, amber on swap; popped items dim while re-heapifying and accumulate in
  the green "Popped order (ascending)" chip row. Pure derivation: push appends, swap
  exchanges i/j, state is authoritative snapshot, pop_min records the root leaving.
- src/components/student-network/playground/hashmap-tab.tsx — 8 bucket cells (grid 2/4/8
  cols by breakpoint), amber ring on the active bucket; pills chain per bucket with owner
  tooltip and animated ×count badge; current-op strip (hash detail text / insert / count);
  live ranked skill bar list (blue→cyan gradient, max-h-80 scroll) that ends equal to the
  server counts; final table snapshot panel; capacity/distinct-skills badges.
- src/components/student-network/dsa-playground-view.tsx — SectionHeader + subtitle +
  shadcn Tabs (Graph, BFS, Trie, Heap, Hash Map), each tab its own file above.

## Files modified
- src/lib/types.ts — appended PlaygroundGraphNode/Response, PlaygroundTrieWord,
  PlaygroundTrieInsertStep/Node/Response, PlaygroundTrieSearchStep/Response,
  PlaygroundHeapItem/Step/Response, PlaygroundHashmapStep/Response. BfsStep/BfsTraceResponse
  already existed (Network Explorer) and are reused — the playground BFS response has the
  identical shape.
- src/store/app-store.ts — 'playground' added to the View union.
- src/components/student-network/app-root.tsx — import + `case 'playground'` →
  DsaPlaygroundView.
- src/components/student-network/app-shell.tsx — FlaskConical icon import + nav item
  "DSA Playground" after Collaboration Hub.

## Browser verification (gateway http://localhost:81, agent-browser; login aarav/pass123)
- Nav: "DSA Playground" item present in sidebar; view renders SectionHeader + 5 tabs. PASS
- Graph: Play advanced ~1 step/sec; ran to Step 48/48 — 20 node groups + 28 edge lines in
  the SVG; node click → "@aarav · Aarav Sharma · degree 8" strip; VLM confirms circular
  blue nodes + cyan edges, clean layout. PASS
- BFS: picked kabir → Run BFS → queue chips tracked steps (front highlighted, e.g.
  "ishita, meera, nikhil82, priya, rohan" at step 5); level colors verified from SVG fills
  (1 amber source, 8 cyan level-1, 10 blue level-2, 1 slate unreachable = adi2007, matching
  degrees); 4 orange discovery edges mid-replay; end state shows "19 students reachable
  from @aarav" and empty queue. VLM: queue card + colors + pulsing ring confirmed. PASS
- Trie: stepped 6 insert steps (7 nodes visible; aarav completes with terminal dot);
  search "an" → insert replay jumped to 262/262, search trace auto-played 3/3, amber path
  + cyan subtree (29 amber circles incl. 28 terminal dots, 4 cyan subtree nodes), "@ananya
  · Ananya Das" match chip; search "zz" → red ✕ marker at the root, "no words start with
  this prefix" + "'zz' diverges — no child 'z'" shown; re-searching "an" after "zz" works.
  PASS (after fixing a crash — see Bugs found & fixed)
- Heap: default mode played to Step 15/148 (push farah 4); custom [9,4,7,1,3] → 31 steps,
  mid-state array boxes verified against the API trace ([v4 1, v2 4, v3 7, v1 9, v5 3] at
  step 12); replay to 31/31 ends with empty heap + popped order v4 1, v5 3, v2 4, v3 7,
  v1 9 (ascending 1,3,4,7,9); "Back to real data" switch works; index labels visible after
  the pt-6 clip fix. PASS
- Hash Map: played to 136/136; all 8 buckets filled (python×8, c++×4, java×4 …), bucket 6
  amber-highlighted during the final insert; "(final)" badge on the live ranked list whose
  top equals the server counts (python 8, c++ 4, java 4, data structures 3, dsa 3, react 3);
  VLM confirms buckets, op strip, bars, final table. PASS
- Mobile 390x844: screenshots taken (heap/bfs) — stacks vertically, no overflow issues.
- agent-browser errors: 0 after fixes; console: no warnings/errors (only devtools/HMR info).
- bun run lint: zero errors, zero warnings.

## Bugs found & fixed during verification
1. usePlayback scheduled only ONE tick (index not in the effect deps) — added index to deps
   so each tick re-schedules; verified ~1 step/850ms.
2. Trie search crash: searching a shorter trace after a longer one ("zz" after "an") read
   steps beyond the new length (TypeError reading 'op'). Fixed by searchPlayback.jumpTo(0)
   inside mutation onSuccess + a `if (!s) break` guard in the derivation loop.
3. Heap array-view index labels were clipped by overflow-x-auto (CSS overflow-y
   auto-computation) — added pt-6 padding to the scroll container.
4. Lint: setState-in-effect (bfs default source now derived; playback playing flag derived)
   and use*-named plain function in heap tab renamed to applyCustomValues; trie hooks moved
   above the early return.

## Notes for following agents
- New query keys: ['playground-graph'], ['playground-trie'], ['playground-heap', values],
  ['playground-hashmap']. Not in invalidateNetwork().
- Playback engine is reusable for any future step-trace endpoints (e.g. DFS/Dijkstra):
  derive state purely from steps[0..index] and render.
- Heap swap steps carry full post-swap arrays; the frontend applies them as position
  swaps and uses 'state' steps as authoritative resets (popped item disappears at the next
  state step after the sift-down swaps).
- Screenshots: /tmp/pga-graph-complete.png, /tmp/pga-graph-check.png (full),
  /tmp/pga-bfs.png, /tmp/pga-bfs-full2.png (full, mid-replay), /tmp/pga-bfs-end.png,
  /tmp/pga-trie-insert.png, /tmp/pga-trie-zz-an.png, /tmp/pga-trie-miss-zz.png,
  /tmp/pga-heap-default.png, /tmp/pga-heap-default2.png, /tmp/pga-heap-mid.png,
  /tmp/pga-heap-custom.png, /tmp/pga-hashmap.png, /tmp/pga-hashmap-final.png (full),
  /tmp/pga-mobile-bfs.png, /tmp/pga-mobile-heap.png (390x844).
