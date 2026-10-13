import assert from "node:assert/strict";
import test from "node:test";

import { MoodleDirectoryClient } from "../lib/sources/moodle-directory.mjs";

const answer = (status, body = {}, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: String(status),
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

const directory = (...components) => answer(200, { plugins: components.map((component) => ({ component })) });

/** A client whose requests are answered in turn and whose pauses are written down instead of waited for. */
function client(answers, options = {}) {
  const pauses = [];
  const urls = [];
  const queue = [...answers];
  const instance = new MoodleDirectoryClient({
    fetchImpl: async (url) => {
      urls.push(url);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    sleep: async (milliseconds) => { pauses.push(milliseconds); },
    ...options,
  });
  return { instance, pauses, urls };
}

test("a plugin the directory has is listed with the address of its page", async () => {
  const { instance, urls } = client([directory("local_demo", "tool_other")]);

  assert.deepEqual(await instance.publishedPlugin("local_demo"), {
    component: "local_demo",
    url: "https://moodle.org/plugins/local_demo",
  });
  assert.deepEqual(urls, ["https://download.moodle.org/api/1.3/pluglist.php"]);
});

test("a plugin the directory does not have is null", async () => {
  const { instance } = client([directory("local_demo")]);

  assert.equal(await instance.publishedPlugin("local_unknown"), null);
});

test("the list is downloaded once for every plugin asked about", async () => {
  const { instance, urls } = client([directory("local_a", "local_b")]);

  assert.ok(await instance.publishedPlugin("local_a"));
  assert.ok(await instance.publishedPlugin("local_b"));
  assert.equal(await instance.publishedPlugin("local_c"), null);
  assert.equal(urls.length, 1);
});

test("a rate limit is waited out with a growing pause and then the list is read", async () => {
  const { instance, pauses } = client([answer(429), answer(503), directory("local_demo")]);

  assert.equal((await instance.publishedPlugin("local_demo")).component, "local_demo");
  assert.deepEqual(pauses, [2000, 4000]);
});

test("the pause the directory asks for wins over the default one", async () => {
  const { instance, pauses } = client([answer(429, {}, { "retry-after": "7" }), directory("local_demo")]);

  await instance.publishedPlugin("local_demo");

  assert.deepEqual(pauses, [7000]);
});

test("a directory that cannot be read is an error, not a list of unpublished plugins", async () => {
  const { instance } = client([answer(403)]);

  await assert.rejects(() => instance.publishedPlugin("local_demo"), /403 .* while reading the Moodle plugins directory/);
});

test("a failed attempt is not remembered, so the next plugin asks again", async () => {
  const { instance } = client([answer(403), directory("local_demo")]);

  await assert.rejects(() => instance.publishedPlugin("local_demo"));
  assert.equal((await instance.publishedPlugin("local_demo")).component, "local_demo");
});

test("a network failure is an error after the retries", async () => {
  const { instance } = client([new Error("offline"), new Error("offline")], { retries: 1 });

  await assert.rejects(() => instance.publishedPlugin("local_demo"), /Could not read the Moodle plugins directory: offline/);
});

test("an answer without a list of plugins is an error", async () => {
  const { instance } = client([answer(200, { unexpected: true })]);

  await assert.rejects(() => instance.publishedPlugin("local_demo"), /no plugins/);
});
