// Local end-to-end test setup. These accounts exist ONLY in the local test database
// (created by `npm run e2e:seed`); the tests refuse to run against anything but localhost.
export const APP = process.env.E2E_APP_URL || "http://localhost:3000";
export const API = process.env.E2E_API_URL || "http://localhost:8081";
export const DB = process.env.E2E_DB || "vani_local";
export const MYSQL = (process.env.E2E_MYSQL || "mysql -u root").split(" ");

export const ADMIN = { name: "E2E Admin", email: "e2e-admin@test.local", password: "e2e-test-pass", role: "ROLE_ADMIN" };
export const PROOFREADER = { name: "E2E Proofreader", email: "e2e-proofreader@test.local", password: "e2e-test-pass", role: "ROLE_PROOFREADER" };
export const LISTENER = { name: "E2E Listener", email: "e2e-user@test.local", password: "e2e-test-pass", role: "ROLE_USER" };
export const LECTURE_TITLE = "E2E test lecture (local only)";

for (const url of [APP, API]) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url) && process.env.E2E_ALLOW_REMOTE !== "1") {
    throw new Error(`E2E tests only run against localhost, not ${url}`);
  }
}
