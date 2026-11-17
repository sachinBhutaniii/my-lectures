# my-lectures — rules for every change

## 1. Saves need a login (THE RULE) — automatic in `lib/axios.ts`
- Every save / update / delete made with `apiClient` (POST/PUT/PATCH/DELETE) by someone who is
  not logged in, or whose login has ended, sends them to the login page and brings them back
  afterwards. Listening and other reads stay public.
- The only writes allowed without login are listed in `PUBLIC_WRITE_ENDPOINTS`
  (`lib/apiRulesCore.ts`, currently just log in / sign up). Add one only with a reason.
- Never call `fetch()` for a write. Use `apiClient`, or `authedWriteFetch()` from
  `lib/apiRules.ts` for multipart uploads; both apply the same rules.

## 2. Fail loudly, never silently — also automatic
- A failed write shows a red notice with the server's reason (`components/GlobalNotices.tsx`)
  and is logged. Never `catch {}` a failed save; if you catch it, show it to the user.
- Opt-outs are per request and need a comment saying why:
  - `skipLoginRedirect: true` — background calls that must never bounce the user
    (listening-streak sync, proofreading activity log).
  - `skipLoudError: true` — the screen already shows its own visible error for that failure
    (e.g. the editor's "Not saved · kept on device").
- The proofreading editor handles a lost login with its own lock screen (keeps unsaved work):
  it registers `overrideLoginRequired()` while open.

## 3. Tests that guard against lost work
- `npm test` — unit tests (`tests/`). They also run on every deploy: `npm run build` runs them
  first, so a failing test stops the deploy and the current live version stays.
- `npm run test:e2e` — real-browser tests on the LOCAL app (`e2e/`, see `e2e/README.md`):
  edits saved and back after reopening, Timeline Editor changes, offline edits, login ending
  mid-edit, History restore, plus the rules above. Run them before pushing any change to the
  editor, saving, login or the backend. Any new way of saving work needs a test here.

## 4. Checks before pushing
- `npx tsc --noEmit -p .`, `npm test`, `npm run test:e2e`, `npx eslint <changed files>`, and
  try the change on localhost (`NEXT_PUBLIC_API_URL=http://localhost:8081 npx next dev`).
