import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Sudoku game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>九宫 SUDOKU｜专注每一格<\/title>/i);
  assert.match(html, /9乘9数独棋盘/);
  assert.match(html, /专家/);
  assert.match(html, /历史关卡/);
  assert.match(html, /填入数字 9/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the finished social image and removes the starter preview", async () => {
  const [packageJson, pageSource] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(pageSource, /number\s*===\s*solution\[index\]/);
  assert.match(pageSource, /jiugong-sudoku-history-v1/);
  assert.match(pageSource, /value\s*!==\s*solution\[selected\]/);
  await assert.rejects(access(new URL("../app\/_sites-preview", import.meta.url)));
});
