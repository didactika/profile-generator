import assert from "node:assert/strict";
import test from "node:test";

import { ProfileCollector } from "../lib/sources/collector.mjs";

const encoded = (text) => ({ encoding: "base64", content: Buffer.from(text).toString("base64") });

test("collector reads what a Moodle plugin supports from the version.php of each of its lines", async () => {
  const plugin = {
    name: "moodle-local_demo",
    full_name: "didactika/moodle-local_demo",
    html_url: "https://github.com/didactika/moodle-local_demo",
    owner: { login: "didactika" },
    default_branch: "main",
    private: false,
    archived: false,
    fork: false,
    stargazers_count: 0,
    custom_properties: { "project-type": "moodle-plugin" },
  };
  const versionFiles = {
    main: "<?php $plugin->release = '5.3.1'; $plugin->supported = [503, 503];",
    MOODLE_400_STABLE: "<?php $plugin->release = '4.0.1'; $plugin->supported = [400, 502];",
  };
  const requested = [];
  const github = {
    async get(path) {
      requested.push(path);
      if (path === "/orgs/didactika") return { login: "didactika", name: "Didactika", avatar_url: "", html_url: "", blog: "" };
      if (path.startsWith("/orgs/didactika/repos")) return [plugin];
      if (path.endsWith("/branches?per_page=100")) {
        return [{ name: "main" }, { name: "MOODLE_400_STABLE" }, { name: "feat/other" }];
      }
      const version = path.match(/\/contents\/version\.php\?ref=(.+)$/);
      if (version) return encoded(versionFiles[decodeURIComponent(version[1])]);
      if (path.endsWith("/contents/package.json")) return null;
      if (path.endsWith("/releases/latest")) return { tag_name: "v5.3.1", html_url: "https://example.test/v5.3.1" };
      if (path.endsWith("/languages")) return {};
      if (path.endsWith("/contributors?per_page=100")) return [];
      if (path.endsWith("/stats/commit_activity")) return [];
      if (path.endsWith("/releases?per_page=100")) return [];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };
  const collector = new ProfileCollector({ github, npm: null, log: { step() {}, detail() {}, warn() {} } });

  const data = await collector.collect(["didactika"]);

  assert.deepEqual(data.repos[0].moodleLines.map((line) => [line.branch, line.supported, line.release]), [
    ["main", [503, 503], "5.3.1"],
    ["MOODLE_400_STABLE", [400, 502], "4.0.1"],
  ]);
  assert.deepEqual(data.repos[0].latestRelease, { tag: "v5.3.1", url: "https://example.test/v5.3.1" });
  assert.equal(requested.some((path) => path.includes("feat")), false, "only the default branch and the Moodle lines are read");
});

test("collector does not look for version.php in a repository that is not a Moodle plugin", async () => {
  const repo = {
    name: "tool",
    full_name: "didactika/tool",
    html_url: "https://github.com/didactika/tool",
    owner: { login: "didactika" },
    default_branch: "main",
    private: false,
    archived: false,
    fork: false,
    stargazers_count: 0,
    custom_properties: { "project-type": "npm-package" },
  };
  const requested = [];
  const github = {
    async get(path) {
      requested.push(path);
      if (path === "/orgs/didactika") return { login: "didactika", name: "Didactika", avatar_url: "", html_url: "", blog: "" };
      if (path.startsWith("/orgs/didactika/repos")) return [repo];
      if (path.endsWith("/branches?per_page=100")) return [{ name: "main" }, { name: "v1.x" }];
      if (path.endsWith("/contents/package.json")) return null;
      if (path.endsWith("/releases/latest")) return null;
      if (path.endsWith("/languages")) return {};
      if (path.endsWith("/contributors?per_page=100")) return [];
      if (path.endsWith("/stats/commit_activity")) return [];
      if (path.endsWith("/releases?per_page=100")) return [];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };
  const collector = new ProfileCollector({ github, npm: null, log: { step() {}, detail() {}, warn() {} } });

  const data = await collector.collect(["didactika"]);

  assert.equal(data.repos[0].moodleLines, undefined);
  assert.equal(requested.some((path) => path.includes("version.php")), false);
});
