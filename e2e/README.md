# End-to-end tests (real browser, local only)

These tests open the real app in headless Chrome and check that proofreading work is never lost
(edit → saved → reopened, Timeline Editor, offline, login ending, History restore) and that the
app-wide rules hold (saves need login, failed saves are loud, listening stays public).
They use only the **local** app, backend and database — they refuse to run against anything else.

## Run them (before pushing changes to the editor, saving, login or the backend)
1. Local MySQL with a `vani_local` database, and the backend on port 8081 using it:
   `SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/vani_local SPRING_DATASOURCE_USERNAME=root SPRING_DATASOURCE_PASSWORD= SERVER_PORT=8081 ./gradlew bootRun`
2. The website on port 3000 pointed at it: `NEXT_PUBLIC_API_URL=http://localhost:8081 npx next dev -p 3000`
3. Once: `npm run e2e:seed` (creates the test accounts and the "E2E test lecture" in the local DB)
4. `npm run test:e2e`

Needs Google Chrome installed (or set `E2E_CHROME` to a Chrome/Chromium binary) and Node 22+.
Other settings: `E2E_APP_URL`, `E2E_API_URL`, `E2E_DB`, `E2E_MYSQL` (see `config.mjs`).
