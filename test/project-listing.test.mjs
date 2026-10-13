import assert from "node:assert/strict";
import test from "node:test";

import { Badges } from "../lib/pages/badges.mjs";
import { anchorFor, compatibilityMatrix, indexTable, rangeText, shortDescription } from "../lib/pages/listing.mjs";
import { moodleSupport } from "../lib/moodle-plugin.mjs";

const repo = (overrides = {}) => ({
  full_name: "didactika/moodle-local_demo",
  html_url: "https://github.com/didactika/moodle-local_demo",
  default_branch: "main",
  license: { spdx_id: "GPL-3.0" },
  ...overrides,
});

test("a plugin gets the license, Moodle and PHP badges that its README has", () => {
  const support = moodleSupport([{ supported: [405, 503] }]);
  const html = Badges.for({}, repo(), {}, { kind: "moodle", support });

  assert.match(html, /<a href="https:\/\/github\.com\/didactika\/moodle-local_demo\/blob\/main\/LICENSE"><img alt="License GPL v3" src="https:\/\/img\.shields\.io\/badge\/License-GPL_v3-blue\?style=flat-square"><\/a>/);
  assert.match(html, /<a href="https:\/\/moodle\.org"><img alt="Moodle 4\.5\+" src="https:\/\/img\.shields\.io\/badge\/Moodle-4\.5\+-f98012\?style=flat-square&logo=moodle&logoColor=white"><\/a>/);
  assert.match(html, /<a href="https:\/\/www\.php\.net"><img alt="PHP 8\.1\+" src="https:\/\/img\.shields\.io\/badge\/PHP-8\.1\+-777bb4\?style=flat-square&logo=php&logoColor=white"><\/a>/);
});

test("a plugin whose version.php could not be read has no Moodle or PHP badge, and does not invent one", () => {
  const html = Badges.for({}, repo(), {}, { kind: "moodle", support: null });

  assert.doesNotMatch(html, /Moodle-/);
  assert.doesNotMatch(html, /PHP-/);
  assert.match(html, /License-GPL_v3/);
});

test("another license keeps the live badge of GitHub", () => {
  const html = Badges.for({}, repo({ license: { spdx_id: "MIT" } }), {}, { kind: "moodle", support: null });

  assert.match(html, /img\.shields\.io\/github\/license\/didactika\/moodle-local_demo/);
  assert.doesNotMatch(html, /GPL_v3/);
});

test("a package keeps its npm badges and the language", () => {
  const html = Badges.for({ npm: "@didactika/demo" }, repo({ language: "TypeScript", license: { spdx_id: "MIT" } }));

  assert.match(html, /npm\/v\/@didactika\/demo/);
  assert.match(html, /npm\/dm\/@didactika\/demo/);
  assert.match(html, /alt="TypeScript"/);
  assert.doesNotMatch(html, /Moodle-/);
});

test("anchors follow the way GitHub names the id of a heading", () => {
  assert.equal(anchorFor("local_servicemanager"), "local_servicemanager");
  assert.equal(anchorFor("@didactika/prisma-entity"), "didactikaprisma-entity");
  assert.equal(anchorFor("Two Words"), "two-words");
});

test("a description is cut to its first sentence and to a word", () => {
  assert.equal(shortDescription("Does one thing. And then another."), "Does one thing");
  assert.equal(shortDescription(`${"word ".repeat(40)}end.`, 30), "word word word word word word…");
  assert.equal(shortDescription(""), "");
});

test("the index has a row for each plugin with its Moodle range, PHP and latest release", () => {
  const rows = [{
    name: "local_demo",
    anchor: "local_demo",
    description: "Does a thing | with a pipe.",
    support: moodleSupport([{ supported: [400, 502] }]),
    latest: { tag: "v1.2.0", url: "https://example.test/r" },
    lines: [],
    install: null,
  }, {
    name: "local_other", anchor: "local_other", description: "Other", support: null, latest: null, lines: [], install: null,
  }];
  const table = indexTable("moodle", rows, "en").split("\n");

  assert.equal(table[0], "| Plugin | What it does | Moodle | PHP | Latest |");
  assert.match(table[2], /<a href="#local_demo"><b>local_demo<\/b><\/a> \| Does a thing &#124; with a pipe \| 4\.0 – 5\.2 \| 7\.4\+ \| <a href="https:\/\/example\.test\/r">v1\.2\.0<\/a> \|/);
  assert.match(table[3], /\| — \| — \| — \|$/);
});

test("the index of packages shows the install command and the maintained lines", () => {
  const rows = [{
    name: "@didactika/demo", anchor: "didactikademo", description: "A package", support: null,
    latest: { tag: "v3.0.0", url: "https://example.test/n" }, lines: ["3.x", "2.x"], install: "npm install @didactika/demo",
  }];
  const table = indexTable("npm", rows, "es").split("\n");

  assert.equal(table[0], "| Paquete | Qué hace | Última | Mantenidas | Instalar |");
  assert.match(table[2], /<code>3\.x<\/code> <code>2\.x<\/code> \| <code>npm install @didactika\/demo<\/code> \|$/);
});

test("the matrix marks each Moodle release a plugin supports", () => {
  const a = moodleSupport([{ supported: [405, 502] }]);
  const b = moodleSupport([{ supported: [400, 405] }]);
  const table = compatibilityMatrix([400, 405, 500, 502], [
    { name: "a", anchor: "a", support: a },
    { name: "b", anchor: "b", support: b },
    { name: "c", anchor: "c", support: null },
  ], "Plugin").split("\n");

  assert.equal(table[0], "| Plugin | 4.0 | 4.5 | 5.0 | 5.2 |");
  assert.equal(table[2], '| <a href="#a">a</a> | · | ✅ | ✅ | ✅ |');
  assert.equal(table[3], '| <a href="#b">b</a> | ✅ | ✅ | · | · |');
  assert.equal(table[4], '| <a href="#c">c</a> | · | · | · | · |');
  assert.equal(compatibilityMatrix([], [], "Plugin"), "");
});

test("a range of one release is written as that release", () => {
  assert.equal(rangeText(moodleSupport([{ supported: [503, 503] }])), "5.3");
  assert.equal(rangeText(null), null);
});
