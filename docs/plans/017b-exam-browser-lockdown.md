# Plan 017b — Exam Browser Lockdown: Apps, Hotkeys, Screenshots + Per-Round Proctoring Option

> Raised by SG on 2026-10-03 after the first end-to-end mock drive. Two repos: `siq-Secure-browser`
> (lockdown, v1.0.2) and `siq-web` (round proctoring option, new activity type).

## 1. Objective

1. **No unauthorised app during the exam.** Before the exam the student must close every blocked app
   (one click closes them all); during the exam any blocked app that starts is closed automatically and
   reported to staff.
2. **Hotkeys and screenshots locked for the whole exam**, not only while the window has focus; every
   attempt reported to staff.
3. **Per-round proctoring option** for mock drives: proctoring is optional — College Admin, HOD (own
   departments) and Super Admin turn it on or off per round, or for all rounds at once. (SG: the
   rule from 018b that forced proctoring on every round is removed.)

## 2. Scope

**Exam browser (v1.0.2)**
- Curated blocklist of apps by category with exact process names (remote access, screen recording /
  streaming, meetings / chat, other browsers, AI assistants, virtual cameras, remote shells).
- **System check** screen before the exam: blocked apps (with "Close these apps for me"), second
  monitor, virtual machine. The exam opens only when the check passes.
- During the exam: re-scan every 5 s, force-close any blocked app, report it; display added → report.
- Shortcuts blocked for the whole exam (not just while focused): existing list + PrintScreen variants and
  Windows-key combinations where Windows allows; clipboard cleared at start and periodically.
- Window kept on top and re-focused if the student switches away; each switch reported.
- Every event forwarded to the exam page (`postMessage`) so it lands in the staff activity log.

**Website**
- New activity type `BLOCKED_APP`; exam page accepts `blocked-app` from the browser.
- Mock drive page: per-round "Proctored" switch + "Proctor all rounds".

### Not possible / out of scope (stated plainly)
- **Ctrl+Alt+Del** can never be blocked by an app. **Alt+Tab and the Windows key** can't be reliably
  blocked without a native keyboard driver; mitigated by staying on top, re-focusing and reporting.
- **Closing every running app** is unsafe (Explorer, antivirus, drivers) — replaced by the blocklist.
- macOS build — needs a Mac.

## 3. Prerequisites / Dependencies

- Plan 017 (exam browser), 018 / 018b (activity log, integrity panel), 023–024 (drives).
- No new packages (Node `child_process` for `tasklist` / `taskkill`).

## 4. Technical Approach

- **Detection:** `tasklist /FO CSV /NH` → exact image names (lower-case) matched against the blocklist —
  no substring matches (the old check flagged anything containing "zoom", and Chrome, which the student
  used to open the link).
- **Closing:** `taskkill /F /T /IM <name>` for blocked names only, never system processes. Before the exam
  the student confirms ("unsaved work in these apps will be lost"); during the exam it is automatic.
- **Shortcuts:** registered with `globalShortcut` when the exam starts and kept until it ends (today they
  are dropped on blur, which is exactly when they matter). Each OS-reserved combination is tried and
  skipped silently if Windows refuses it.
- **Screenshots:** `setContentProtection(true)` already makes captures black; PrintScreen / Win+Shift+S
  presses are additionally swallowed where possible and reported.
- **Reporting path:** main process → renderer (`security:alert`) → `iframe.contentWindow.postMessage`
  to the SelectIQ site only → the exam page's activity hook → `/api/exam/[token]/proctoring/flag`.

## 5. Implementation Steps

**siq-Secure-browser**
1. `electron/blocked-apps.cjs`: categories + exact process names; `scanBlockedApps()`,
   `closeApps(names)`.
2. `electron/main.cjs`: IPC `system:check` / `system:close-apps`; exam-time watcher (5 s) with auto-close;
   `display-added` watch; shortcuts kept for the whole exam + PrintScreen / Windows-key variants;
   clipboard clearing; re-focus on blur; forward each event as `security:alert`.
3. Remove the old substring process monitor and the start-up quit on a second monitor (now part of the
   system check, with re-check).
4. `src/components/SystemCheck.jsx`: the pre-exam screen (website look).
5. `BrowserShell.jsx`: run the system check before showing the exam; forward alerts to the iframe.
6. Preload: expose the two IPC calls.
7. Version 1.0.2; build installer; publish release.

**siq-web**
8. Migration: `ProctoringFlagType` += `BLOCKED_APP`; flag route + activity hook + labels.
9. API `PATCH /api/mock-drives/[id]/proctoring` `{ roundIds | all, enabled }` (only rounds not yet opened).
10. Drive page: "Proctored" switch per round + "Proctor all rounds".

## 6. File Changes

| Repo | Action | File |
|---|---|---|
| browser | Create | `electron/blocked-apps.cjs`, `src/components/SystemCheck.jsx` |
| browser | Modify | `electron/main.cjs`, `electron/preload.cjs`, `src/components/BrowserShell.jsx`, `package.json` |
| browser | Delete/replace | old `startProcessMonitor` in `electron/security-checks.cjs` |
| web | Modify | `prisma/schema.prisma` + migration, flag route, `use-activity-monitor.ts`, `lib/proctoring/integrity.ts` |
| web | Create | `src/app/api/mock-drives/[id]/proctoring/route.ts` |
| web | Modify | `src/services/mock-drives.ts`, `src/components/mock-drives/drive-controls.tsx`, drive page |

## 7. Testing / Verification

- [ ] Blocklist matches exact names only (no false positives on similarly named apps)
- [ ] System check lists open blocked apps; "Close these apps" closes them; exam opens only when clear
- [ ] Starting a blocked app mid-exam → closed within ~5 s and shown in the staff panel
- [ ] PrintScreen / Win+Shift+S during the exam → reported; captures are black
- [ ] Switching away (Alt+Tab) → window comes back on top; switch reported
- [ ] Shortcuts stay blocked after a focus change; released after the exam
- [ ] Second monitor connected mid-exam → reported
- [ ] Web: `BLOCKED_APP` flag accepted and shown; per-round and "all rounds" proctoring switch; rounds
      already opened can't be changed
- [ ] Installer v1.0.2 built and published; manual run on Windows by SG

## 8. Documentation Updates

- `docs/roles-and-permissions.md` (exam integrity section): blocked apps, shortcut and screenshot rules.
- Browser README: blocklist and what can / can't be blocked.

## 9. Estimated Effort

- Claude Code: ~2 hours across both repos
- Manual testing on Windows: ~30 minutes (open Zoom / AnyDesk / Chrome, try PrintScreen, Alt+Tab)
