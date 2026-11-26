# 4-a — Collaboration Hub Frontend

Task ID: 4-a | Agent: frontend
Scope: Collab Hub view + wiring only. Backend (Flask, port 5001) untouched.

## Files created
- src/components/student-network/collab-hub-view.tsx — full Collaboration Hub view:
  - SectionHeader + "Post an idea" gradient CTA; All / Open / Mine filter Tabs with counts.
  - PostIdeaDialog: title (4-80 chars validated + counter), description, category Select
    (DSA/Web/AI & ML/Mobile/Hardware/Research/Startup/General), comma-separated skills with
    live blue chip preview, team-size Slider 2..10 with live "N students" label. POST /collabs.
  - CollabCard grid (1 col mobile, 2 md+): status badge (teal open / muted closed), amber
    category badge, clickable owner row, line-clamp-3 description, blue skills badges, member
    avatar stack + "n/size members · spots left|Team full", Posted {timeAgo}.
  - Actions by my_status: none+open → Apply dialog (optional message); applied → amber
    "Application pending" chip; member → emerald "You're on the team" chip; owner →
    Applications (n) / Suggested teammates dialogs + DropdownMenu (Close/Reopen recruiting,
    Delete via AlertDialog).
  - ApplicationsDialog: GET /collab-applications filtered by collab_id; Accept (amber
    gradient) / Reject (destructive outline) mutations.
  - CandidatesDialog: GET /collabs/{id}/candidates; coverage % bar (amber gradient) + shared
    skill badges + relationship chip + View profile.
  - Skeletons for hub + dialogs; EmptyStates; all errors toasted from ApiError.message.
  - Query keys ['collabs'], ['collab-applications'], ['collab-candidates', id]; local
    invalidateCollabs() invalidates all three on every mutation.

## Files modified
- src/lib/types.ts — appended CollabItem, CollabApplicationItem, CollabCandidate,
  CollabMyStatus; extended NotificationKind with collab_application | collab_accepted |
  collab_rejected.
- src/store/app-store.ts — 'collab' added to View union.
- src/components/student-network/app-root.tsx — case 'collab' → CollabHubView.
- src/components/student-network/app-shell.tsx — Briefcase nav item "Collaboration Hub"
  after Network Explorer.
- src/components/student-network/notifications-view.tsx — KIND_META entries for the three
  collab kinds (Lightbulb/amber, Handshake/emerald, XCircle/rose) — required, the Record is
  exhaustive over NotificationKind and would otherwise crash on new kinds.

## Browser verification (gateway http://localhost:81, agent-browser)
- Login aarav → Collaboration Hub loads; DSA Visualiser Suite card: Open badge, 2/4 members ·
  2 spots left, owner controls visible. PASS
- Posted "Campus Food Review App" (Web, React+TypeScript chips previewed live, slider set to
  3 via keyboard) → card appeared newest-first, toast "Idea posted", counts 2/2/2. PASS
- Suggested teammates dialog on new idea: ranked candidates — ishita 100% (react+typescript),
  farah 50% (react) with coverage bars + shared-skill badges. PASS
- Applications dialog on new idea (before anyone applied): empty state. PASS
- Logged out → ishita → Apply with message → "Application pending" chip; toast shown. PASS
- Extra (to hit the full-team path): farah applied; aarav accepted farah → card shows
  3/3 members · Team full + Closed badge (backend auto-closed), Open tab count 2→1. PASS
- aarav Applications dialog showed ishita's and farah's applications with italic messages,
  Accept/Reject buttons. PASS
- Notifications view as aarav and ishita renders new collab_* kinds without crashing. PASS
- Cleanup: deleted "Campus Food Review App" via Manage → Delete → AlertDialog confirm.
  Final API state: only collab 1 (DSA Visualiser Suite, open, 2 members). PASS
- agent-browser errors / console: no page errors, no console errors/warnings at any step.
- bun run lint: zero errors, zero warnings.
- Mobile viewport 390x844 screenshot taken; layout is 1-column as designed.

## Notes for following agents
- Query key roots added by this feature: ['collabs'], ['collab-applications'],
  ['collab-candidates']. They are NOT part of invalidateNetwork() in src/lib/invalidate.ts
  (kept local to the view to avoid touching shared code).
- Accept fills the last spot → backend auto-sets status 'closed' (network.py
  _finish_collab_application); reopening a full team returns 400 (toasted as server message).
- Screenshots: /tmp/collab-hub-initial.png, /tmp/collab-candidates.png, /tmp/collab-applied.png,
  /tmp/collab-accept.png, /tmp/collab-full-closed.png, /tmp/collab-after-delete.png,
  /tmp/collab-mobile.png.
