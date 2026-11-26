# 6-a — Project Showcase Frontend

Task ID: 6-a | Agent: frontend (showcase)
Scope: Project Showcase view + wiring only. Backend (Flask, port 5001, /api/projects/* +
/api/projects/{id}/featured|contributors) untouched — all endpoints curl-verified before
coding (GET /api/projects -> {projects:[...]}, multipart POST/PUT with optional `cover`
file, owner-only featured/delete/contributor actions, notification kind `project_contributor`).

## Files created
- src/components/student-network/showcase-view.tsx — the full view:
  - SectionHeader ("Project Showcase", subtitle per spec) + amber->orange gradient
    "Publish a project" CTA.
  - Featured spotlight strip (only when featured exist): horizontally scrollable row
    (snap-x, thin-scrollbar) of larger cards (w-300/340px) with amber "Featured" star
    badge overlaid on the cover, owner row, category badge, clamp-2 description, tech
    chips, GitHub/Demo links. Strip reflects the active category filter.
  - Category filter chips (role=tablist): All + Web/DSA/AI & ML/Mobile/Hardware/
    Research/Startup/General + any custom categories seen in any cached ['projects', *]
    query (view always loads "All" first, so custom ones are known immediately).
    Clicking sets ?category= (encodeURIComponent) on a keyed query ['projects', category];
    active chip = navy #0F1F46 pill. Per-category EmptyState variant when filtered empty.
  - Project grid 1/2/3 cols (grid gap-4 md:grid-cols-2 xl:grid-cols-3), motion
    whileHover y:-2, rounded-xl border bg-card shadow-sm hover:shadow-md, p-4 content.
  - Card: cover top (aspect-video object-cover; empty cover_url -> navy gradient
    #16294F/#0F1F46/#0A1631 placeholder with amber monogram of the title initials +
    faint FolderKanban watermark), title, owner row (UserAvatar + name -> profile,
    "owner" pill), category badge + "Published {timeAgo}", clamp-2 description, blue
    tech chips (5 + +N), contributor avatar stack (4 + +N + count), GitHub/Demo outline
    buttons (asChild anchors, target=_blank rel="noopener noreferrer"), footer mt-auto.
  - is_mine ellipsis DropdownMenu: Edit details (Pencil), Add/Remove from Featured
    (Star), Contributors (n) (UserPlus), Delete (Trash2, destructive) with nested
    AlertDialog confirm (same nesting pattern as CollabCard).
  - Publish/Edit dialog (shared ProjectForm, remounts on open): cover picker (hidden
    file input + dashed drop-zone button showing chosen filename + object-URL preview;
    edit mode shows the existing cover with "current" tag; clear button; 25MB/image-type
    guards), title with x/80 counter, description Textarea x/800, category Select (fixed
    8 + editing project's custom category if any), tech stack Input with live blue
    chips, GitHub/Demo URL inputs. Submit = multipart FormData via apiUpload — POST
    /projects (create) or PUT /projects/{id} (edit; omitting the cover file keeps the
    existing cover — backend contract cover_url '' = keep). Server 4xx messages are
    toasted (verified: "GitHub links must start with http:// or https://.").
  - Contributors dialog (owner): add-by-username input (strips leading @) + list of
    current contributors with remove buttons; add/remove toast + invalidate ['projects'].
  - Loading skeletons (aspect-video cover + rows), error EmptyState, empty EmptyState
    ("No projects published yet — be the first", action = publish CTA).
- All mutations invalidate ['projects'] (prefix) -> every keyed category query refreshes.

## Files modified
- src/lib/types.ts — appended ProjectItem (mirrors the serializer exactly); added
  'project_contributor' to the NotificationKind union (required for the exhaustive
  KIND_META Record in notifications-view).
- src/lib/api.ts — apiUpload gained an optional `method: 'POST' | 'PUT' = 'POST'`
  parameter (backwards compatible; needed for the multipart PUT edit-with-cover path).
- src/store/app-store.ts — 'showcase' added to the View union.
- src/components/student-network/app-root.tsx — ShowcaseView import + case 'showcase'.
- src/components/student-network/app-shell.tsx — FolderKanban icon import + nav item
  "Project Showcase" right after "DSA Playground".
- src/components/student-network/notifications-view.tsx — KIND_META entry
  project_contributor: UserPlus icon, bg-amber-100 text-amber-600, label
  "Project contributor" (mirrors how collab_* kinds were added).

## Browser verification (gateway http://localhost:81, agent-browser, login aarav/pass123)
1. Nav "Project Showcase" present; view renders header + CTA + featured strip +
   9 chips + the seeded project (featured strip card + grid card, ishita contributor
   stack, GitHub + Demo links). DOM + VLM verified. PASS
2. Publish "ML Study Buddy" (no cover, AI & ML via Select, tech "Python, PyTorch" ->
   live chips, github https://github.com/aarav/ml-buddy) via dialog: appears in list
   (newest first), manage menu visible (is_mine). PASS
3. Edit: dialog prefilled (title/desc/category/tech/urls), description changed ->
   updated in card. PASS
4. Feature toggle: "Add to Featured" -> strip = [ML Study Buddy, CU.Setu Graph
   Explorer v2]; "Remove from Featured" -> strip back to [Graph Explorer]. PASS
5. Contributors dialog: added "kabir" -> row + "1 contributor" on the card; kabir's
   notifications show kind project_contributor ("@aarav credited you as a contributor
   on \"ML Study Buddy\".") — verified in a second browser session (login kabir) where
   the Notifications page renders it with the amber UserPlus icon, no crash. PASS
6. Server validation toast: publish with github "github.com/aarav/nope" -> 400,
   dialog stays open, toast title "Could not publish" + server message. PASS
7. Cover upload E2E: published "Cover Upload Tester" with a generated 64x64 PNG via
   the picker (filename + preview shown in dialog) -> card serves
   /api/media/projects/...test-cover.png?XTransformPort=5001; then edited WITHOUT
   touching the cover -> cover kept + description updated. PASS
8. Delete: "ML Study Buddy" and "Cover Upload Tester" deleted via AlertDialog ->
   gone from list/API; DB left with exactly the original project 1
   "CU.Setu Graph Explorer v2" (featured). PASS
9. Category filter: "Web" -> GET /api/projects?category=Web&XTransformPort=5001
   (network-verified); "AI & ML" -> per-category EmptyState "Nothing in AI & ML yet". PASS
10. Mobile 390x844: cards stack 1/row, chips row scrolls internally, no page
    overflow (docW 390 == winW 390), VLM confirms clean layout. PASS
- agent-browser errors: 0 (fresh reload). Console: only Fast Refresh/HMR/React
  DevTools info logs. bun run lint: zero errors, zero warnings.
- One transient dev-server "module-not-found" appeared in dev.log/console while files
  were being written mid-edit (import added before the view file landed); resolved on
  next compile — not present after reload.

## Notes for following agents
- New query keys: ['projects', category] ('' = All). Invalidate with
  queryKey: ['projects'] to refresh all categories.
- apiUpload(path, form, method?) now supports multipart PUT — reuse it for any future
  edit-with-media flows.
- NotificationKind now includes 'project_contributor' (UserPlus/amber in notifications-view).
- Screenshots: /tmp/sc-6a-initial.png (+ -full), /tmp/sc-6a-card.png, /tmp/sc-6a-published.png,
  /tmp/sc-6a-featured-two.png, /tmp/sc-6a-final.png, /tmp/sc-6a-filter-empty.png,
  /tmp/sc-6a-with-cover.png, /tmp/sc-6a-mobile.png, /tmp/sc-6a-kabir-notif.png,
  /tmp/sc-6a-final-view.png.
