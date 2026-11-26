# 7-a — Campus Skill Analytics Frontend

Task ID: 7-a | Agent: frontend (skill analytics)
Scope: Skill Analytics view + wiring only. Backend (Flask, port 5001,
/api/analytics/skills + /students + /complementary) untouched — all endpoints
curl-verified with a real session before coding:
  GET /api/analytics/skills -> {students:20, distinct_skills:44, total_listings:68,
    top:[python 8/40.0, java 4, c++ 4, react 3, dsa 3, data structures 3, sql 2,
    cpp 2, c 2, pytorch 2, matlab 2, arduino 1], by_programme:{7 groups},
    by_year:{1st..4th Year}}
  GET /api/analytics/skills/students?skill=python -> 8 students
    (aarav, ishita, kabir, meera, nikhil82, rajacan, venna22, vikram).
  GET /api/analytics/skills/complementary?skill=react -> 8 items
    (python 2/3=66.7%, flask 33.3%, tailwind css, css, mongodb, node.js, java, data structures).
  Contract nuance found: /students?skill=<unknown> returns 200 {students:[]} (NOT 404);
  /complementary?skill=<unknown> returns 404 {"error":"No student on campus has that skill yet."}.
  The view handles BOTH paths gracefully (404 -> toast + inline EmptyState with the server
  message; 200-empty -> friendly inline EmptyState). 400 on empty skill is guarded client-side.

## Files created
- src/components/student-network/skill-analytics-view.tsx ('use client') — the full view:
  - SectionHeader "Campus Skill Analytics", subtitle mentions live hash-map counting +
    heap ranking of real profiles; Refresh outline button (spinner while refetching).
  - Stat chips row (grid-cols-3, StatChip): students / distinct skills / skill listings —
    all live API numbers (20 / 44 / 68 verified).
  - "Top skills on campus": recharts BarChart layout="vertical" (horizontal bars), top 12,
    amber->orange gradient bars (#FBBF24 -> #EA580C via <defs><linearGradient>), CartesianGrid,
    number XAxis, category YAxis (width 88, labels truncated >16 chars), custom Tooltip
    showing skill + count + pct of campus, ResponsiveContainer 100% x 430px. Bars are
    CLICKABLE: tapping a bar runs the people search for that skill (Bar onClick).
  - "Where the skills cluster": Tabs (Programme | Year, grid-cols-2 list on mobile). Each
    group = a card: group name + "{n} skills" + skill rows (name + count + proportional
    amber->orange Tailwind bar scaled to the group's own leader). 2-col grid (md:grid-cols-2),
    internal max-h-80 overflow-y-auto thin-scrollbar guard. Programmes sorted A->Z; years in
    natural API order.
  - "Find people by skill": Input + "Find people" submit (Enter works) + Popular chips
    (top 8, click = prefill + search). Result: "{n} students know {skill}" + horizontal
    flex-wrap row of student chips (UserAvatar + full name + programme · year), click opens
    profile via useAppStore openProfile. Loading spinner note; both empty paths handled.
  - "Complementary skills": Input ("What pairs with React?") + "Find pairs" + Try chips
    (top 6). Result: "{n} skills pair with {skill}" + rows: skill + "{count} of {of_owners}
    owners · {pct}%" + small proportional bar; CardDescription swaps to the explain text
    "Skills that students who know {skill} also list — set co-occurrence ranking." 404 ->
    toast (server message) + inline EmptyState.
  - Queries: ['skill-analytics'] (main), ['skill-students', skill] (enabled when set),
    ['skill-complementary', skill]. Errors -> ApiError message via toast useEffects.
    Loading -> full-page skeleton layout (stat chips + card blocks).
  - Styling: white cards on #F4F6FB, deep-navy/royal-blue/orange palette only (no
    indigo/purple), framer-motion page entrance, fully responsive (stacks on mobile).

## Files modified
- src/lib/types.ts — appended SkillCountItem, SkillAnalyticsResponse,
  SkillStudentsResponse, ComplementaryItem, ComplementarySkillsResponse.
- src/store/app-store.ts — 'analytics' added to the View union.
- src/components/student-network/app-root.tsx — SkillAnalyticsView import + case 'analytics'.
- src/components/student-network/app-shell.tsx — BarChart3 icon import + nav item
  "Skill Analytics" right after "Project Showcase" (desktop sidebar + mobile drawer share
  navItems).

## Browser verification (gateway http://localhost:81, agent-browser, login aarav/pass123)
1. Login -> nav shows "Skill Analytics" after "Project Showcase"; view renders header,
   subtitle, Refresh, stat chips 20 / 44 / 68. PASS (DOM + VLM)
2. Top chart: 12 amber->orange bars, python tallest (8) with 0..8 axis, all labels
   readable ("data structures" wraps to 2 lines — legible). VLM verified. PASS
   NOTE: full-page screenshots (--full) capture the chart EMPTY — agent-browser's full
   capture resizes the viewport, which restarts recharts' entrance animation mid-capture.
   Viewport screenshots (real user experience) always show the bars (19079 orange px
   scanned in the chart region); DOM confirms 12 bar paths with correct geometry/fill.
   Verify charts with viewport screenshots, not --full.
3. Tabs: Programme shows all 7 groups (B,tech cs & ai / B.Sc Data Science / B.Tech CSE /
   B.Tech ECE / B.Tech IT / BCA / M.Tech AI & DS) with counts+bars; Year shows 1st/2nd/
   3rd/4th Year groups (4/8/8/8 skills). VLM verified, no clipped rows after max-h-80
   bump (8-item cards fit fully). PASS
4. "python" chip click -> "8 students know Python" + 8 student chips (Aarav, Ishita,
   Kabir, Meera, M Reddy Nikhil, M Kiran Kumar chowdary, Vennapusa Vamsi krishna reddy,
   Vikram Singh); clicked Kabir chip -> Kabir Khan profile view opened. Bar-tap on the
   python bar ALSO triggers the search (verified via mouse click at bar center). Typing
   "java" + Enter -> "4 students know Java". PASS
5. Complementary "react" chip -> "8 skills pair with React": python "2 of 3 owners ·
   66.7%", flask/tailwind css/css/mongodb/node.js/java/data structures 33.3%; proportional
   bars; description swaps to the set co-occurrence explain text. VLM verified. PASS
6. Search "xyzabc" (people) -> graceful inline EmptyState "Nobody on campus lists
   "xyzabc" yet" (200-empty path, no crash). Complementary "xyzabc" -> 404 path: toast
   "Skill not found / No student on campus has that skill yet." + inline EmptyState
   "Nobody on campus knows "xyzabc" yet". PASS
7. Mobile 390x844: stat chips side-by-side, chart bars readable + python longest, sections
   stack cleanly, student chips wrap without truncation, no horizontal overflow
   (docW 390 == winW 390). VLM verified. PASS
8. agent-browser errors -> zero; console -> zero errors; bun run lint -> exit 0
   (zero errors, zero warnings); dev.log clean.

## Notes for following agents
- New query keys: ['skill-analytics'], ['skill-students', skill],
  ['skill-complementary', skill]. Recharts 2.15 is installed and used here — reuse
  layout="vertical" BarChart pattern; verify with VIEWPORT screenshots (full-page capture
  restarts recharts animations mid-capture -> bars look missing).
- Backend nuance: /analytics/skills/students returns 200+empty list for unknown skills
  while /analytics/skills/complementary 404s — both handled in the view.
- Pre-existing (out of scope, NOT from this task): VLM flags a minor sidebar avatar/Logout
  overlap at 1280x800 and a DialogContent aria-describedby warning from existing dialogs.
- Screenshots: /tmp/sc-7a-view.png (full page — chart area empty due to capture artifact),
  /tmp/sc-7a-fresh-chart.png, /tmp/sc-7a-chart-now.png (viewport chart OK),
  /tmp/sc-7a-complementary.png, /tmp/sc-7a-splits.png, /tmp/sc-7a-splits-final.png,
  /tmp/sc-7a-desktop-head.png, /tmp/sc-7a-desktop-mid.png,
  /tmp/sc-7a-mobile-top.png, /tmp/sc-7a-mobile-chart.png, /tmp/sc-7a-mobile-people.png.
