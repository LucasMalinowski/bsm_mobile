# BSM System — Project Memo

> **This file is mirrored verbatim in both repos**: `bsm_system` (web) and `bsm_mobile` (app). It's a system-wide orientation doc — read this first, before `FEATURES.md` (web API/feature detail) or any repo-specific docs, when picking up work in either repo without prior context. It describes the system **as it currently stands**. It is not a changelog and does not track session-specific bug fixes — update it when the *shape* of the system changes (a new feature ships, a screen moves, a convention changes), not when a bug gets fixed.

---

## 1. What this is

BSM System is a multi-tenant **calibration and equipment management SaaS** for labs and industrial clients (ISO 17025-adjacent context — equipment tracking, calibration records, maintenance tickets, document control). "BSM" = the product name shown in-app.

Two client applications share one backend:

| App | Repo | Stack | Who uses it |
|---|---|---|---|
| Web | `bsm_system` | Next.js 16 + Supabase | All three roles, full feature surface, the only place Super Admin's full toolset lives |
| Mobile | `bsm_mobile` | Expo / React Native | Field use — equipment lookup, QR scanning, tickets, on-the-go approvals |

**There is no separate mobile backend.** `bsm_mobile` is a pure client that calls `bsm_system`'s Next.js API routes over HTTPS (`EXPO_PUBLIC_API_BASE_URL` in `bsm_mobile/.env`). Any backend change in `bsm_system/src/app/api/**` affects both apps simultaneously.

UI copy is in **Portuguese (pt-BR)** throughout both apps. Code, comments, and identifiers are in English.

---

## 2. Roles

Three roles, defined once in `bsm_system/src/types` and enforced identically for both clients since they hit the same API:

- **`super_admin`** — no `company_id` (it's `null` by design). Operates across all companies. Only role that can register calibrations, manage calibration document templates, create/delete companies, view the audit log, and upload documents (admins are hard-blocked from document upload at the API layer, even though they hold the permission by default — see §4).
- **`admin`** — scoped to one company (`company_id` set). Manages their company's equipment, tickets, documents, users, and settings.
- **`employee`** — scoped to one company. Read-heavy: can view equipment/documents, create/update tickets, cannot manage users or company settings.

---

## 3. Architecture

### Web (`bsm_system`)
- **Next.js 16**, App Router, **`src/proxy.ts`** (not `middleware.ts` — Next.js 16 renamed it; both cannot coexist, see `bsm_system/AGENTS.md`).
- **Supabase**: Postgres + Auth + Storage. Two client modes:
  - `createSupabaseServerClient()` (`src/lib/supabase/server.ts`) — anon-key, RLS-enforced, cookie-bound. Used for almost everything.
  - `createSupabaseAdminClient()` (`src/lib/supabase/admin.ts`) — service-role, bypasses RLS. Used for: public/unauthenticated lookups (invite tokens, QR scan resolution), cross-tenant Super Admin operations, and anywhere RLS would otherwise block a legitimate cross-company read (e.g. resolving a Super Admin's name as a record's creator).
- **Session**: cookie-based Supabase SSR session. `getServerSession()` (`src/lib/auth/get-session.ts`) is the single source of truth for "who is this request" — it has two paths in one function: a cookie path (web) and a `Authorization: Bearer <token>` path (mobile). Both resolve to the same `AuthUser` shape.
- **Styling**: Tailwind CSS 4, light theme. Per-company brand colors via CSS vars (`--brand-primary`/`--brand-secondary`/`--brand-accent`, default `#0363a9`/`#008adb`/`#e0f0fb`), editable by admins in Company Settings, cached via `unstable_cache` (60s TTL, tag `company-theme`).
- **UI primitives**: Radix UI (Dialog, Select, Tabs, Checkbox, Avatar, DropdownMenu) wrapped in `src/components/ui/`. Forms: `react-hook-form` + `zod`. Data fetching on the client: TanStack Query where needed, otherwise server components fetch directly.
- **PWA**: installable via `@ducanh2912/next-pwa` (service worker, manifest, iOS install prompt).
- Notable libs: `qrcode` (generate), `jsqr` (decode, client-side camera scan), `fflate` (in-place XLSX patching for calibration spreadsheets), `xlsx` (used for ad-hoc spreadsheet construction), `resend` (email).

### Mobile (`bsm_mobile`)
- **Expo SDK 54**, **Expo Router** (file-based, same convention as Next.js App Router — folders in `src/app/` map to routes), **React Native 0.81**, React 19.
- **No cookies** — auth is pure Bearer token. Access/refresh tokens and the logged-in user object are persisted via `expo-secure-store` (`src/auth/tokenStorage.ts`), loaded into a React context (`src/auth/AuthProvider.tsx`, `useAuth()`). Every API call attaches `Authorization: Bearer <access_token>` via the shared `apiFetch()` wrapper (`src/api/client.ts`), which also handles silent token refresh on a 401 and queues concurrent requests during refresh.
- **Super Admin company context**: since there's no cookie to carry web's "impersonation" state, mobile has its own mechanism — `activeCompanyId`, persisted alongside the session, set via a dedicated company-picker screen (`src/app/(app)/select-company.tsx`), surfaced as a banner in the header. It's attached as an explicit `company_id` query param / body field on the relevant API calls (the backend already supports this param for every list/create endpoint a Super Admin needs — see §4). This is **not** the same mechanism as web's impersonation cookie; it's a client-side equivalent achieving the same practical effect.
- **Theme**: dark, fixed (no per-company theming on mobile). Background `#0F0F10`, header/card surface `#111214`/`#151618`, accent indigo `#6366F1`. Hand-rolled `StyleSheet`-based components in `src/components/ui/` (`Card`, `Badge`, `Button`, `Input`, `CustomHeader`) — no component library (no Tamagui/NativeBase/etc).
- **Navigation**: 5 bottom tabs (Início / Equipamentos / Chamados / Documentos / Notificações), `src/app/(app)/(tabs)/`. Everything else (detail screens, create forms, profile, settings) is pushed on top via Expo Router's stack, outside the tab group, under `src/app/(app)/`.
- Notable libs: `expo-camera` (QR scan), `expo-image-picker` / `expo-document-picker` (photo/file uploads), `react-hook-form` + `zod` (same form pattern as web), TanStack Query for all data fetching.

### Database / multi-tenancy
- Every tenant-owned table carries a `company_id`. RLS policies (Postgres, `supabase/migrations/`) enforce company isolation at the database layer — the app layer's permission checks (`can()`, `src/lib/auth/permissions.ts`) are a second, independent gate, not the only one.
- `super_admin`'s RLS policies bypass company scoping via an `is_super_admin()` check; several storage and table policies needed an explicit `is_super_admin()` OR-clause added because a plain `company_id = current_user_company_id()` check can never match when the caller's own `company_id` is `null` — keep this in mind any time a new company-scoped policy is added.

---

## 4. Permissions model

Three layers that must stay in sync — this is the single most important thing to understand correctly before touching auth/permissions code:

1. **`DEFAULT_PERMISSIONS_BY_ROLE`** (`bsm_system/src/lib/auth/permissions.ts`) — the TypeScript source of truth for what each role gets by default. `super_admin` implicitly gets everything (`can()` short-circuits to `true`).
2. **`role_default_permissions`** (DB table, seeded in `0002_auth_profiles.sql`, corrected in `0015_fix_role_default_permissions_drift.sql`) — must match #1 exactly. This is what actually gets copied onto a user.
3. **`user_permissions`** (DB table) — the per-user *resolved* permission set. A DB trigger (`sync_user_permissions_from_role`, `0014_sync_user_permissions_from_role.sql`) copies `role_default_permissions` into this table whenever a profile is inserted or its `role` changes. **This table, not the role, is what Postgres RLS policies actually check** (`user_has_permission()` in `0003_rls_policies.sql`). The app layer separately falls back to `DEFAULT_PERMISSIONS_BY_ROLE` if `user_permissions` is empty for a user — so the two layers can silently disagree if `role_default_permissions` ever drifts from `DEFAULT_PERMISSIONS_BY_ROLE` again. If you add a new permission, update all three.

Per-user overrides on top of role defaults are possible via the RoleManager UI (web: `src/components/admin/role-manager.tsx`; mobile: the permission grid on `bsm_mobile/src/app/(app)/users/[id].tsx`) → `PUT /api/users/{id}/permissions`. Changing a user's **role** resets their permissions to that role's new defaults (by design, via the same trigger) — it does not preserve prior overrides.

One documented, intentional exception to the permission model: **document upload is hard-gated to `super_admin` only** at the API layer (`bsm_system/src/app/api/documents/route.ts`), regardless of what `document:upload` says in any permission set. Admins hold the permission string but are blocked anyway. This is a deliberate product decision, not a bug.

---

## 5. Domain model

| Entity | Purpose | Key fields |
|---|---|---|
| `companies` | Tenant root | `name`, `slug`, `cnpj`, brand colors, `logo_url` |
| `profiles` | Users (1:1 with Supabase `auth.users`) | `company_id` (null for SA), `role`, `is_active` — **no `email` column**, email lives only on `auth.users` and must be joined via the admin client when needed |
| `equipment` | Trackable assets | `internal_code`, `name`, `brand`, `model`, `serial_number`, `tag`, `scale`, `status`, `requires_calibration`, `calibration_periodicity`, `qr_code_token` |
| `equipment_calibration_points` | Expected calibration values per equipment | `point_value`, `criterion`, `error_tolerance` |
| `calibration_records` | History of performed calibrations | links to a generated child spreadsheet + optional certificate |
| `calibration_documents` / `calibration_document_versions` | SA-managed XLSX **templates**, versioned | placeholder tokens get substituted to produce a record's child spreadsheet |
| `tickets` | Maintenance/calibration/repair/inspection requests ("chamados") | `status`, `priority`, `type`, `assigned_to`, `is_support_request` (routes to SA instead of company admin) |
| `documents` | Company file library | `category_id`, `equipment_id` (optional link), `visible_to_employees`, versioned |
| `document_categories` | Per-company document tagging | |
| `notifications` | In-app notifications, several trigger types | polled, not realtime |
| `audit_logs` | SA-visible change history | diff of before/after on every tracked mutation |
| `invitations` | Email-based onboarding | token-based, accepted via `/invite/[token]` |
| `user_permissions` / `role_default_permissions` | See §4 | |

---

## 6. Feature map

For each area: what it does, and where it lives on each platform. "—" means not present on that platform (a real gap, not an oversight in this doc).

### Auth
- **Login**: web `/login` (cookie session) · mobile `(auth)/login.tsx` (Bearer token, stored via `tokenStorage`).
- **Logout**: web sidebar "Sair" form → `POST /api/auth/signout` · mobile Profile → "Sair da Conta" (confirmation dialog) → `authApi.signout()`.
- **Forgot/reset password**: web `/forgot-password` + `/update-password`, full flow · mobile has a "Esqueceu sua senha?" link on the login screen — **verify this is wired to a real flow before relying on it**, it was added since the last full mobile audit and the destination wasn't independently confirmed.
- **Invitation accept**: web `/invite/[token]` (handles hash-based session detection from the Supabase email link, with a bounded retry before showing a "couldn't confirm" state) · **no mobile equivalent** — invited users must accept on web first.
- **Impersonation (SA, web only)**: `POST /api/super-admin/impersonate` sets an httpOnly cookie; banner shown via `ImpersonationBanner`; exit via `/api/super-admin/impersonate/exit`.
- **Company context (SA, mobile only)**: see §3 — `select-company.tsx` + `activeCompanyId`, functionally equivalent to impersonation but mechanically different (no cookie involved).

### Dashboard
- Web `/dashboard`: equipment + ticket counts, recent equipment, recent tickets.
- Mobile `(tabs)/index.tsx` ("Painel Operacional"): open ticket count, equipment-in-calibration count, unread notifications banner, quick actions (Escanear QR / Novo Chamado / Novo Equipamento / Ver Perfil), recent tickets.
- SA-specific cross-company stats exist on web only.

### Equipment
- **List**: web `/equipment` (table desktop / cards mobile-width, search, status filter, sort, pagination, QR icon per row) · mobile `(tabs)/equipment.tsx` (search, status filter, sort, infinite-scroll-style pagination).
- **Create**: web — 3-step modal wizard (`NewEquipmentModal`): basics → photo + calibration points → confirm w/ doc-copy-from-same-model preview. Reachable from `/equipment/new` (auto-opens the modal) or in-page button. · mobile — single-screen form (`equipment/new.tsx`): basics + photo; **no calibration-points step, no doc-copy step** in the mobile create flow.
- **Detail**: web `/equipment/[id]` — 4 tabs (Dados / Calibração / Manutenção / Docs), inline edit modal. · mobile `equipment/[id].tsx` — 3 tabs (info / calibration-status / history); calibration tab here is **read-only display** (status, points, history) with a "Solicitar" button that opens a ticket, not a calibration form.
- **Edit**: web — modal on detail page · mobile — dedicated screen `equipment/[id]_edit.tsx`.
- **QR**: web generates a PNG (`GET /api/equipment/{id}/qrcode`) and resolves scans publicly (`GET /api/equipment/qr/{token}`, admin-client-backed since it's unauthenticated by design) · mobile has a full scanner screen (`equipment/scan.tsx`) with camera + manual-token fallback + recent-scans history; **no QR generation/download UI on mobile**.

### Calibration
- **Template management** (upload XLSX templates, version them, placeholder reference guide): web only, `/super-admin/calibration-documents`, SA-only.
- **Register a calibration** (the "parent/child spreadsheet" flow — pick a template, fill in points, generate a child XLSX with placeholders substituted, optionally attach a certificate): web only, reachable from the equipment detail's Calibração tab, SA-only action. Placeholder tokens currently supported: `{{nome_equipamento}}`, `{{codigo_interno}}`, `{{nome_empresa}}`, `{{cnpj_empresa}}`, `{{data_calibracao}}`, `{{periodicidade}}`, `{{marca}}`, `{{modelo}}`, `{{numero_serie}}`, `{{tag}}`, `{{escala}}`, `{{ponto_N_valor}}`, `{{ponto_N_criterio}}`, `{{ponto_N_erro}}`. Substitution logic: `bsm_system/src/app/api/equipment/[id]/calibrations/child-spreadsheet/route.ts` (literal string replace inside the XLSX's XML parts via `fflate`).
- **Mobile note**: a full calibration registration screen exists in the codebase at `bsm_mobile/src/app/(app)/equipment/calibration/[id].tsx` (form, points editor, certificate upload — feature-complete-looking) but **it is not linked from anywhere in the app's navigation** — not from the equipment detail screen, not from anywhere else. Treat it as built-but-unwired rather than either "working" or "absent" until someone confirms it end-to-end and adds a nav entry point.
- **Calibration-due notifications**: a daily cron (`vercel.json` → `GET /api/cron/calibration-due`) checks equipment due within 7 days and notifies company admins, respecting their `cal_alert` preference. Web-settings copy describes this window — keep it in sync if the 7-day threshold ever changes.

### Tickets ("Chamados")
- **List**: web `/tickets` (status tabs, filters, pagination) · mobile `(tabs)/tickets.tsx` (status + priority filter tabs, search).
- **Create**: both platforms use a multi-step flow — web's `NewTicketModal` (equipment select → details/photo → confirm, with an "Acionar Suporte BSM" toggle for admins that routes to SA) is reachable from the topbar (every page) and from `/tickets`. Mobile's `tickets/new.tsx` has the same fields including the support-request toggle and an equipment picker modal.
- **Detail**: web `/tickets/[id]` — status transition buttons, comments, photo, support-request badge · mobile `tickets/[id].tsx` — same plus an edit modal and a reassign ("Atribuir") modal with a real user picker.
- **Status machine** (enforced server-side, `TicketService.update()`): `open → in_progress|closed`, `in_progress → waiting|resolved|closed`, `waiting → in_progress|resolved|closed`, `resolved → closed|open`, `closed → open`.

### Documents
- **List/detail**: web `/documents` + `/documents/[id]` (categories, versions, visibility toggle, delete) · mobile `(tabs)/documents.tsx` + `documents/[id].tsx` (list, detail with version history, download/share via system sheet, version upload, delete, visibility toggle).
- **Upload**: web only (SA-only, see §4) — there is no document upload entry point on mobile at all.

### Users & Permissions
- **List/detail/permission-matrix/deactivate**: full parity on both platforms. Web: `/admin/users` (+ SA equivalent `/super-admin/users`), `RoleManager` component. Mobile: `users/index.tsx` + `users/[id].tsx` (collapsible permission grid, toggle-to-save, deactivate switch).
- **Invite**: web `InviteDialog` (admin or SA, SA gets a company picker) · mobile via Profile → "Convidar Usuário" modal.

### Company Settings
- Theme/colors, logo, name/CNPJ, notification preferences, document categories: **web only** (`/admin/settings`). Mobile has a read-only-leaning `company-settings.tsx` screen — check current field-level editability there before assuming parity with web.

### Notifications
- Both platforms: list (unread/all), mark-read, mark-all-read. Mobile additionally has deep-linking (tapping a notification navigates to the relevant ticket/equipment) and a dedicated preferences screen (`notification-preferences.tsx`). Neither platform uses realtime push — both poll.

### Super Admin Panel
- **Web only**, entirely: companies CRUD + impersonate (`/super-admin/companies`), cross-company equipment/tickets/documents/users panels, audit log with diff viewer (`/super-admin/audit`), calibration template management. Mobile's only SA-specific affordance is the company-context switcher (§3) — there is no SA panel UI on mobile.

---

## 7. Visual/UX conventions (current state — use this as the baseline when comparing against a new design)

**Web**: light theme, white/`gray-50` surfaces, brand-blue (`#0363a9` default, per-company override) primary actions, Tailwind utility-class styling throughout, Radix-driven modals/dialogs, sidebar nav (desktop) collapsing to card-based lists on narrow widths, 3-step modal wizards as the standard pattern for multi-field creation flows (equipment, tickets), badge pills for status/role/priority, lucide-react icon set.

**Mobile**: dark theme throughout (`#0F0F10` background / `#111214` header / `#151618` cards / `#6366F1` indigo accent), bottom tab bar (5 tabs), Ionicons icon set, hand-rolled `Card`/`Badge`/`Button`/`Input` components (no UI kit), FAB-style circular "+" buttons for primary create actions on list screens, full-screen forms (not modals) for create/edit, banner strips at the top of screens for contextual state (impersonation, active-company). Action feedback (loading states on taps) is currently inconsistent — some actions show no spinner and can take several seconds, which matters if a new design introduces stricter loading-state expectations.

Neither platform currently shares a design system or component library between web and mobile — they're styled independently. If the incoming design unifies them, that's a from-scratch alignment effort on at least one side, not a tweak.

---

## 8. Where to look — quick file map

**Web (`bsm_system`)**
```
src/app/(dashboard)/...        page components (one folder per feature area)
src/app/(auth)/, (public)/     login/forgot-password, invite-accept
src/app/api/**/route.ts        all backend logic — mobile calls these too
src/components/{equipment,tickets,documents,admin,sa,users,layout,calibration}/
src/lib/auth/                  permissions.ts (role defaults), get-session.ts
src/lib/services/              business logic, one per domain entity
src/lib/repositories/          DB query layer under services
src/lib/validations/           zod schemas per domain entity
src/lib/supabase/              server.ts (RLS client), admin.ts (service-role client)
supabase/migrations/           schema + RLS history, read sequentially for current rules
FEATURES.md                    deep web feature/API reference (complements this doc)
```

**Mobile (`bsm_mobile`)**
```
src/app/(auth)/                 login, forgot-password
src/app/(app)/(tabs)/           the 5 bottom-tab screens
src/app/(app)/{equipment,tickets,documents,users}/   detail/create/edit screens
src/app/(app)/profile.tsx, select-company.tsx, company-settings.tsx, notification-preferences.tsx
src/api/                        one file per domain entity, all funnel through client.ts
src/auth/                       AuthProvider.tsx (useAuth hook), tokenStorage.ts
src/components/ui/              Card, Badge, Button, Input, CustomHeader
src/types/api.ts                shared TS types for API payloads
```

---

## 9. Conventions and gotchas worth knowing before changing things

- **Next.js 16**: use `src/proxy.ts`, never create `src/middleware.ts` — they conflict and Next.js will refuse to build with both present.
- **`profiles` has no `email` column.** Any feature needing a user's email must join through Supabase Auth (`admin.auth.admin.listUsers()` / `getUserById()`), not a `profiles` select.
- **`super_admin.company_id` is `null` by design.** Any new RLS policy or query that does `company_id = current_user_company_id()` will silently exclude/break for Super Admin unless it also OR's in `is_super_admin()`. This exact mistake has recurred multiple times across storage policies, the `profiles` SELECT policy, and a user-role-update endpoint — check for it specifically whenever adding company-scoped logic.
- **Mobile is Bearer-token only.** Don't assume cookie-based mechanisms (impersonation cookie, proxy-based session refresh) reach mobile — they don't, by construction.
- **The web API is the only backend.** A "mobile bug" is frequently actually a backend bug surfacing identically on web once you check — and vice versa. Check both call sites before assuming a fix is platform-specific.
- All UI-facing copy is Portuguese; keep new copy consistent with that (and watch for missing accents — it's happened before and is easy to miss in a quick PR).
