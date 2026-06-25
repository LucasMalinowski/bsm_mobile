# BSM Mobile — Full Feature Audit

**Date:** 2026-06-08  
**Backend reference:** `/home/lucas/Documentos/ruby/bsm_system/FEATURES.md`  
**Method:** Every screen file, every API module, and every type definition read and compared line-by-line against the backend feature spec.
▎ The backend web app uses Next.js 16. The middleware entry point is src/proxy.ts (not middleware.ts). Do not create src/middleware.ts — it will cause a
▎ "Both middleware file and proxy file detected" error.
---
 ``
## Legend

- ✅ Fully implemented and working end-to-end  
- ⚠️ Partially implemented — exists but has gaps or broken pieces  
- ❌ Not implemented — missing e``ntirely

---

## 1. Authentication & Session

| Feature | Status | Notes |
|---|---|---|
| Login (email + password) | ✅ | `src/app/(auth)/login.tsx` → `authApi.login()` |
| Logout | ✅ | Profile screen with confirmation dialog |
| Token storage (secure) | ✅ | `expo-secure-store` + localStorage fallback |
| Automatic token refresh (401 queue) | ✅ | `src/api/client.ts` — queues requests during refresh |
| Bootstrap session on app start | ✅ | `AuthProvider.bootstrap()` validates via `authApi.me()` |
| Password reset / forgot password | ❌ | No screen, no link on login screen |
| Password change (from profile) | ❌ | Not present anywhere in the app |
| Accept invitation flow | ❌ | Backend has `/invite/[token]`; mobile has no corresponding screen |
| Impersonation banner (SA) | ❌ | `impersonating` field exists on `AuthUser` type but never rendered |
| Two-factor authentication | ❌ | Not implemented |

---

## 2. Dashboard

| Feature | Status | Notes |
|---|---|---|
| Stats: open tickets count | ✅ | `src/app/(app)/(tabs)/index.tsx` |
| Stats: equipment in calibration count | ✅ | Same screen |
| Recent tickets list | ✅ | Last 5, with status/priority badges |
| Recent equipment list | ❌ | Backend dashboard shows recent equipment; mobile does not |
| Calibration-due alert widget | ❌ | Backend shows "overdue calibration" warnings; no equivalent on mobile |
| Unread notification banner | ⚠️ | Shows count only; no preview of notifications |
| Quick actions (QR scan, New Ticket) | ✅ | Permission-gated correctly |
| Quick action: New Equipment | ⚠️ | Shows only if `equipment:create` — correct, but routes to full-screen form, not a quick-add |

---

## 3. Equipment

### List
| Feature | Status | Notes |
|---|---|---|
| List with pagination (infinite scroll) | ✅ | 20/page, `equipment.tsx` |
| Search (name, internal_code) | ✅ | Real-time search bar |
| Status filter | ✅ | Todos / Ativo / Manutenção / Calibração / Inativo |
| Sort options UI | ❌ | Hardcoded to `updated_at desc`; no sort UI exposed |
| QR code icon in list row | ❌ | Backend web has it; mobile list has none |
| Delete button in list row | ❌ | Only accessible from detail screen |

### Create Equipment
| Feature | Status | Notes |
|---|---|---|
| All basic fields (name, code, brand, model, serial, location, date, status, notes) | ✅ | `src/app/(app)/equipment/new.tsx` |
| Photo upload | ✅ | `equipmentApi.uploadPhoto()` |
| Requires calibration toggle + periodicity | ✅ | Conditional selector shown correctly |
| **Category selector** | ❌ | `category_id` exists in `CreateEquipmentDTO` and API supports it; no UI dropdown |
| **Default calibration points setup** | ❌ | Backend wizard step 2 sets calibration points; mobile has no equivalent |
| **Copy docs from same-model equipment** | ❌ | Backend wizard step 3; API endpoint `POST /api/equipment/{id}/copy-docs` exists but no mobile UI |

### Edit Equipment
| Feature | Status | Notes |
|---|---|---|
| Edit all basic fields | ✅ | `src/app/(app)/equipment/[id]_edit.tsx` |
| Photo replacement | ✅ | |
| Category selector | ❌ | Same gap as create |

### Detail Screen
| Feature | Status | Notes |
|---|---|---|
| Specs tab (all metadata) | ✅ | |
| Calibration tab: shows points (read-only) | ✅ | |
| Calibration tab: shows records history | ✅ | |
| **Calibration points: create/edit/delete** | ❌ | API `POST /api/equipment/{id}/calibration-points` exists and is in `calibrationApi.setPoints()` but there is zero UI to invoke it |
| **Register calibration form (SA)** | ❌ | Backend has `RegisterCalibrationModal`; mobile shows a "Solicitar" button that opens a new ticket instead — not the same thing |
| **Calibration certificate view/upload** | ❌ | `calibrationApi.uploadCertificate()` is defined but no UI calls it |
| **Download child XLSX** | ❌ | `GET /api/equipment/{id}/calibrations/{recordId}/download` has no mobile UI |
| **Calibration template selection** | ❌ | `calibrationApi.listTemplates()` is defined but never called from any screen |
| History tab (audit trail) | ✅ | |
| Delete (permission-gated) | ✅ | |
| Edit button (permission-gated) | ✅ | |
| QR code download | ❌ | No download or share of QR PNG from mobile |
| `getDocsByModel` integration | ❌ | API function defined in `equipment.ts` but never called |

### QR Scanner
| Feature | Status | Notes |
|---|---|---|
| Camera-based QR scan | ✅ | `src/app/(app)/equipment/scan.tsx` |
| UUID extraction + redirect resolution | ✅ | Two-strategy resolution |
| Manual entry fallback | ❌ | Backend web has manual token input; mobile shows an alert with "Scan Again" / "Cancel" only — no text input fallback |
| Recent scans history | ❌ | Backend web stores last 10 scans; no equivalent in mobile |
| Vibration/haptic on success | ❌ | No feedback on successful scan |

---

## 4. Calibration

| Feature | Status | Notes |
|---|---|---|
| View calibration points (read-only) | ✅ | Equipment detail, calibration tab |
| View calibration records | ✅ | |
| **Edit calibration points** | ❌ | `calibrationApi.setPoints()` exists, no UI |
| **Register calibration (SA)** | ❌ | `calibrationApi.addRecord()` exists, no form/modal |
| **Upload certificate** | ❌ | `calibrationApi.uploadCertificate()` exists, no UI |
| **Download child XLSX** | ❌ | No endpoint call in any screen |
| **Calibration template list** | ❌ | `calibrationApi.listTemplates()` exists, never called |
| Calibration-due alerts | ❌ | `calibration_due` notification type renders in notifications screen; no proactive dashboard widget |

---

## 5. Tickets

### List
| Feature | Status | Notes |
|---|---|---|
| List with search | ✅ | `src/app/(app)/(tabs)/tickets.tsx` |
| Status filter tabs | ✅ | 6 states |
| Priority filter tabs | ✅ | |
| Delete button in list | ❌ | Only reachable from detail screen |

### Create Ticket
| Feature | Status | Notes |
|---|---|---|
| Title, description, priority, type | ✅ | `src/app/(app)/tickets/new.tsx` |
| Photo upload | ✅ | |
| Pre-linked equipment (from route param) | ✅ | |
| **Equipment selector** | ❌ | No dropdown to pick equipment from scratch; must navigate from equipment detail to pre-link |
| **Support request toggle** (`is_support_request`) | ❌ | Field is in the Zod schema and `CreateTicketDTO` but the checkbox is **never rendered** in the form UI |
| **Assignee selection** | ❌ | Backend auto-assigns or lets admin pick; mobile sends no `assigned_to` |

### Ticket Detail
| Feature | Status | Notes |
|---|---|---|
| View all ticket fields | ✅ | |
| Photo display | ✅ | |
| Status transition buttons | ✅ | `NEXT_STATUSES` state machine matches backend |
| Add comments | ✅ | |
| **Edit ticket** | ❌ | Edit button exists in `src/app/(app)/tickets/[id].tsx` but `onPress` handler is `() => {}` — completely empty stub |
| **Reassign ticket** | ❌ | No UI for changing `assigned_to` |
| **Delete ticket** | ⚠️ | Exists in detail (permission-gated); not in list view |
| Comment edit / delete | ❌ | Write-once only |
| Support request badge display | ❌ | Field exists in `Ticket` type but never rendered |

---

## 6. Documents

### List
| Feature | Status | Notes |
|---|---|---|
| List with search | ✅ | `src/app/(app)/(tabs)/documents.tsx` |
| File type icons | ✅ | MIME-based icons |
| Category filter | ❌ | No category filter UI |
| Sort options | ❌ | Hardcoded `updated_at desc` |

### Document Detail
| Feature | Status | Notes |
|---|---|---|
| View metadata (name, size, version, uploader, category, equipment, visibility) | ✅ | `src/app/(app)/documents/[id].tsx` |
| Version history | ✅ | Read-only list |
| Download / open via system share | ✅ | `FileSystem.downloadAsync()` + `Sharing.shareAsync()` |
| **Upload new version** | ❌ | `POST /api/documents/{id}/versions` has no mobile UI |
| **Delete document** | ❌ | No delete button anywhere in mobile documents |
| **Visible-to-employees toggle** | ❌ | Field shown in metadata but no toggle UI; `PATCH /api/documents/{id}` not called from any screen |
| **Inline PDF/image preview** | ❌ | Only metadata, no preview |

### Upload Document
| Feature | Status | Notes |
|---|---|---|
| Upload new document | ❌ | SA-only on web; mobile has zero upload UI at all |

---

## 7. Users & Permissions

| Feature | Status | Notes |
|---|---|---|
| Avatar upload (self) | ✅ | `src/app/(app)/profile.tsx` |
| View own permissions list | ✅ | Profile screen — shows raw permission strings |
| **User list screen (admin)** | ❌ | Link in profile navigates nowhere functional |
| **User detail / edit screen** | ❌ | Not implemented |
| **Invite user** | ❌ | Button in profile calls `Alert.alert()` only — no form, no API call |
| **User deactivation / activation** | ❌ | `PATCH /api/users/{id}/deactivate` not called anywhere |
| **Permission override matrix** | ❌ | `GET/PUT /api/users/{id}/permissions` not implemented |
| User role display | ✅ | Badge on profile |

### Missing API client functions (`src/api/users.ts`)
- `GET /api/users/{id}` — no `getById()` method
- `DELETE /api/users/{id}` — not implemented
- `PATCH /api/users/{id}/deactivate` — not implemented
- `GET /api/users/{id}/permissions` — not implemented
- `PUT /api/users/{id}/permissions` — not implemented

---

## 8. Company Settings

| Feature | Status | Notes |
|---|---|---|
| View company info | ⚠️ | Profile shows `company_id` truncated only |
| **Edit company name / CNPJ** | ❌ | `PATCH /api/companies/{id}` not called anywhere |
| **Logo upload** | ❌ | `POST /api/companies/{id}/logo` not implemented |
| **Theme / color settings** | ❌ | No settings screen |
| **Notification preferences (cal_alert, unassigned, weekly)** | ❌ | `GET/PATCH /api/notifications/preferences` endpoints exist but no mobile UI |
| **Document category management** | ❌ | `GET/POST/DELETE /api/document-categories` not implemented in mobile |

---

## 9. Notifications

| Feature | Status | Notes |
|---|---|---|
| List (unread / all toggle) | ✅ | `src/app/(app)/(tabs)/notifications.tsx` |
| Mark single as read | ✅ | |
| Mark all as read | ✅ | |
| Unread count badge on tab icon | ✅ | Via `CustomHeader` polling |
| **Deep links — tap notification navigates to source** | ❌ | Tapping a notification only marks it read; no routing to the relevant ticket/equipment |
| **Notification preferences UI** | ❌ | API exists; no settings screen |
| Delete notification | ❌ | No delete endpoint in mobile API client |
| Push notifications (Expo) | ❌ | Only polling (30s); no `expo-notifications` configured |

---

## 10. Super Admin Features (mobile scope)

The mobile app has no SA-specific screens. SA users can use the app as a regular admin/employee only:

| SA Feature | Status |
|---|---|
| SA dashboard (global stats) | ❌ |
| Manage all companies | ❌ |
| Impersonation flow | ❌ (`impersonating` field in `AuthUser` type but no UI) |
| Calibration document templates | ❌ |
| SA equipment/ticket/document cross-company views | ❌ |
| Audit log viewer | ❌ |
| Register calibration (SA-only) | ❌ |

---

## 11. Missing API Client Methods

Backend endpoints documented in `FEATURES.md` with no corresponding mobile call:

| Backend Endpoint | Impact |
|---|---|
| `GET /api/users/{id}` | Cannot view/edit a specific user |
| `DELETE /api/users/{id}` | Cannot delete users |
| `PATCH /api/users/{id}/deactivate` | Cannot deactivate/activate users |
| `GET /api/users/{id}/permissions` | Cannot read permission overrides |
| `PUT /api/users/{id}/permissions` | Cannot write permission overrides |
| `GET /api/companies/{id}` | Cannot fetch company details |
| `PATCH /api/companies/{id}` | Cannot update company settings |
| `POST /api/companies/{id}/logo` | Cannot upload company logo |
| `GET /api/document-categories` | Cannot list categories |
| `POST /api/document-categories` | Cannot create categories |
| `DELETE /api/document-categories/{id}` | Cannot delete categories |
| `GET /api/notifications/preferences` | Cannot load notification settings |
| `PATCH /api/notifications/preferences` | Cannot save notification settings |
| `GET /api/equipment/{id}/calibrations/{recordId}/download` | Cannot download child XLSX |
| `POST /api/documents/{id}/versions` | Cannot upload new document version |
| `PATCH /api/documents/{id}` | Cannot update document visibility or metadata |
| `POST /api/equipment/{id}/copy-docs` | Cannot copy docs during creation |

---

## 12. Confirmed Bugs (code-level stubs)

| File | Bug |
|---|---|
| `src/app/(app)/tickets/[id].tsx` | Edit button `onPress` is `() => {}` — handler is a no-op |
| `src/app/(app)/tickets/new.tsx` | `is_support_request` field in Zod schema but checkbox JSX was never added to the form |
| `src/app/(app)/profile.tsx` | "Convidar Usuário" button calls `Alert.alert()` instead of opening a form |
| `src/app/(app)/equipment/scan.tsx` | No manual token input fallback on scan failure |
| `src/app/(app)/documents/[id].tsx` | `visible_to_employees` shown in metadata but no toggle/patch call |

---

## Priority Summary

### P0 — Broken stubs (code exists, does nothing)
1. Ticket edit button (`tickets/[id].tsx` — empty handler)
2. User invite button (`profile.tsx` — alert only, no form)
3. Support request checkbox (`tickets/new.tsx` — schema field, no JSX)

### P1 — Core missing features blocking daily use
4. Calibration points edit UI
5. Register calibration form (SA)
6. Certificate upload UI
7. Document upload / new version upload
8. Document delete button
9. Equipment selector in new ticket form
10. Notification deep links (tap → navigate to source)

### P2 — Important but usable without
11. Forgot password / password reset screen
12. Admin user management screens (list, detail, invite form, permissions matrix)
13. Notification preferences settings screen
14. Company settings screen
15. Document visibility toggle
16. Ticket reassignment UI
17. Category selector in equipment create/edit

### P3 — Enhancements
18. QR scanner manual fallback input
19. Recent scans list
20. Calibration XLSX template selection
21. Dashboard: recent equipment list + calibration-due widget
22. SA impersonation banner
23. Push notifications (`expo-notifications`)
24. Sort options in equipment and document lists
