import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("RecentLogsTable uses custom ConfirmDialog instead of window.confirm", () => {
  const tableContent = read("components/daily-log/recent-logs-table.tsx");

  assert.equal(tableContent.includes("ConfirmDialog"), true);
  assert.equal(tableContent.includes("window.confirm"), false);
  assert.equal(tableContent.includes("confirm("), false);
});

test("ConfirmDialog correctly implements Radix UI Dialog and alertdialog role", () => {
  const dialogContent = read("components/shared/confirm-dialog.tsx");

  assert.equal(dialogContent.includes('from "radix-ui"'), true);
  assert.equal(dialogContent.includes('role="alertdialog"'), true);
});
