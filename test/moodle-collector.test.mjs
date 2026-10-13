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
      if (path.endsWith("/readme")) return encoded("[![PHP](https://img.shields.io/badge/PHP-8.3+-777bb4?style=flat-square)](https://www.php.net)");
      if (path.endsWith("/contents/package.json")) return null;
      if (path.endsWith("/releases/latest")) return { tag_name: "v5.3.1", html_url: "https://example.test/v5.3.1" };
      if (path.endsWith("/languages")) return {};
      if (path.endsWith("/contributors?per_page=100")) return [];
      if (path.endsWith("/stats/commit_activity")) return [];
      if (path.endsWith("/releases?per_page=100")) return [];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };
  const asked = [];
  const moodleDirectory = {
    async publishedPlugin(component) {
      asked.push(component);
      return { component, url: `https://moodle.org/plugins/${component}` };
    },
  };
  const collector = new ProfileCollector({ github, npm: null, moodleDirectory, log: { step() {}, detail() {}, warn() {} } });

  const data = await collector.collect(["didactika"]);

  assert.deepEqual(data.repos[0].moodleLines.map((line) => [line.branch, line.supported, line.release]), [
    ["main", [503, 503], "5.3.1"],
    ["MOODLE_400_STABLE", [400, 502], "4.0.1"],
  ]);
  assert.equal(data.repos[0].phpBadge, "8.3+", "the PHP requirement is the one the README states");
  assert.deepEqual(asked, ["local_demo"], "the component comes from the repository name when version.php does not say it");
  assert.equal(data.repos[0].moodleDirectory.url, "https://moodle.org/plugins/local_demo");
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

const pluginRepo = (name) => ({
  name,
  full_name: `didactika/${name}`,
  html_url: `https://github.com/didactika/${name}`,
  owner: { login: "didactika" },
  default_branch: "main",
  private: false,
  archived: false,
  fork: false,
  stargazers_count: 0,
  custom_properties: { "project-type": "moodle-plugin" },
});

/** A GitHub that has these plugins, each with the version.php and the README it is given. */
function githubWith(plugins) {
  return {
    async get(path) {
      if (path === "/orgs/didactika") return { login: "didactika", name: "Didactika", avatar_url: "", html_url: "", blog: "" };
      if (path.startsWith("/orgs/didactika/repos")) return plugins.map((plugin) => plugin.repo);
      const repo = plugins.find((plugin) => path.startsWith(`/repos/${plugin.repo.full_name}/`));
      if (path.endsWith("/branches?per_page=100")) return [{ name: "main" }];
      if (path.includes("/contents/version.php")) return encoded(repo.version);
      if (path.endsWith("/readme")) return repo.readme === undefined ? null : encoded(repo.readme);
      if (path.endsWith("/contents/package.json")) return null;
      if (path.endsWith("/releases/latest")) return null;
      if (path.endsWith("/languages")) return {};
      if (path.endsWith("/contributors?per_page=100")) return [];
      if (path.endsWith("/stats/commit_activity")) return [];
      if (path.endsWith("/releases?per_page=100")) return [];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };
}

const quiet = { step() {}, detail() {}, warn() {} };

test("a plugin the Moodle directory does not have is left without a directory entry, and a README without a PHP badge without PHP", async () => {
  const moodleDirectory = { async publishedPlugin(component) { return component === "local_listed" ? { component, url: "https://moodle.org/plugins/local_listed" } : null; } };
  const github = githubWith([
    { repo: pluginRepo("moodle-local_listed"), version: "<?php $plugin->component = 'local_listed'; $plugin->supported = [405, 503];", readme: "# Listed" },
    { repo: pluginRepo("moodle-local_unlisted"), version: "<?php $plugin->component = 'local_unlisted'; $plugin->supported = [405, 503];" },
  ]);

  const data = await new ProfileCollector({ github, npm: null, moodleDirectory, log: quiet }).collect(["didactika"]);
  const [listed, unlisted] = data.repos;

  assert.equal(listed.moodleDirectory.url, "https://moodle.org/plugins/local_listed");
  assert.equal(listed.phpBadge, undefined);
  assert.equal(unlisted.moodleDirectory, undefined);
  assert.equal(unlisted.phpBadge, undefined);
});

test("the unfilled template is not asked about in the Moodle directory", async () => {
  const asked = [];
  const moodleDirectory = { async publishedPlugin(component) { asked.push(component); return null; } };
  const github = githubWith([
    { repo: pluginRepo("moodle-local_fresh"), version: "<?php $plugin->component = 'PLUGINTYPE_PLUGINNAME'; $plugin->supported = [405, 503];" },
  ]);

  const data = await new ProfileCollector({ github, npm: null, moodleDirectory, log: quiet }).collect(["didactika"]);

  assert.deepEqual(asked, []);
  assert.equal(data.repos[0].moodleDirectory, undefined);
});

test("a README as GitHub sends it, wrapped in lines of base64, is read whole", async () => {
  // GitHub breaks the base64 of a file into lines, and a real README is long and full of the letter s.
  const readme = `# Sessions\n\n${"Some sessions of seven students. ".repeat(60)}\n\n[![PHP](https://img.shields.io/badge/PHP-8.1+-777bb4?style=flat-square)](https://www.php.net)\n`;
  const wrapped = Buffer.from(readme).toString("base64").replace(/(.{60})/g, "$1\n");
  const github = githubWith([{
    repo: pluginRepo("moodle-local_long"),
    version: "<?php $plugin->component = 'local_long'; $plugin->supported = [405, 503];",
    readme: undefined,
  }]);
  const get = github.get.bind(github);
  github.get = async (path) => (path.endsWith("/readme") ? { encoding: "base64", content: wrapped } : get(path));

  const data = await new ProfileCollector({ github, npm: null, log: quiet }).collect(["didactika"]);

  assert.equal(data.repos[0].phpBadge, "8.1+");
});
