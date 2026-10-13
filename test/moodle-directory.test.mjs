import assert from "node:assert/strict";
import test from "node:test";

import { MoodleDirectoryClient } from "../lib/sources/moodle-directory.mjs";

const answer = (status, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: String(status),
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
});

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
  const { instance, urls } = client([answer(200)]);

  assert.deepEqual(await instance.publishedPlugin("local_demo"), {
    component: "local_demo",
    url: "https://moodle.org/plugins/local_demo",
  });
  assert.deepEqual(urls, ["https://moodle.org/plugins/local_demo"]);
});

test("a plugin the directory does not have is null", async () => {
  const { instance } = client([answer(404)]);

  assert.equal(await instance.publishedPlugin("local_unknown"), null);
});

test("requests are spaced, but the first one is not delayed", async () => {
  const { instance, pauses } = client([answer(200), answer(404), answer(200)], { pace: 700 });

  await instance.publishedPlugin("local_a");
  await instance.publishedPlugin("local_b");
  await instance.publishedPlugin("local_c");

  assert.deepEqual(pauses, [700, 700]);
});

test("a rate limit is waited out with a growing pause and then the request succeeds", async () => {
  const { instance, pauses } = client([answer(429), answer(429), answer(200)]);

  assert.equal((await instance.publishedPlugin("local_demo")).component, "local_demo");
  assert.deepEqual(pauses, [2000, 4000]);
});

test("the pause the directory asks for wins over the default one", async () => {
  const { instance, pauses } = client([answer(429, { "retry-after": "7" }), answer(200)]);

  await instance.publishedPlugin("local_demo");

  assert.deepEqual(pauses, [7000]);
});

test("a directory that keeps failing is an error, not an unpublished plugin", async () => {
  const { instance } = client([answer(429), answer(429), answer(429)], { retries: 2 });

  await assert.rejects(() => instance.publishedPlugin("local_demo"), /429 .* while checking local_demo/);
});

test("a network failure is an error after the retries, not an unpublished plugin", async () => {
  const { instance } = client([new Error("offline"), new Error("offline")], { retries: 1 });

  await assert.rejects(() => instance.publishedPlugin("local_demo"), /Could not check the Moodle plugins directory for local_demo: offline/);
});
