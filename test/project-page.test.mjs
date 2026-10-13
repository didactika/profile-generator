import assert from "node:assert/strict";
import test from "node:test";

import { Content } from "../lib/content.mjs";
import { Links } from "../lib/pages/links.mjs";
import { ProjectPage } from "../lib/pages/project-page.mjs";

const content = new Content({
  org: { login: "didactika" },
  copy: {
    projects: {
      soonHeading: { en: "In development", es: "En desarrollo" },
      soonNote: { en: "soon", es: "pronto" },
      back: { en: "Back", es: "Volver" },
    },
  },
  sections: { projects: { showPending: false } },
  groups: [
    {
      id: "moodle",
      projectTypes: ["moodle-plugin"],
      label: { en: "Moodle plugins", es: "Plugins de Moodle" },
      blurb: { en: "Plugins", es: "Plugins" },
      supportedBranches: { pattern: "^MOODLE_(\\d+)_STABLE$", style: "moodle", label: { en: "Supported Moodle", es: "Moodle compatible" } },
    },
    {
      id: "npm",
      discover: { npm: true },
      label: { en: "NPM packages", es: "Paquetes NPM" },
      blurb: { en: "Packages", es: "Paquetes" },
      supportedBranches: { pattern: "^v(\\d+)\\.x$", style: "major", label: { en: "Maintained lines", es: "Líneas mantenidas" } },
    },
  ],
  projects: [],
});

const repo = (name, overrides = {}) => ({
  name,
  full_name: `didactika/${name}`,
  html_url: `https://github.com/didactika/${name}`,
  owner: { login: "didactika" },
  default_branch: "main",
  description: `The ${name} does things. And more.`,
  license: { spdx_id: "GPL-3.0" },
  custom_properties: { "project-type": "moodle-plugin" },
  branchNames: ["main"],
  ...overrides,
});

const page = (groupId, repos, locale = "en") => new ProjectPage({
  content,
  data: { repos },
  links: new Links("didactika", "main"),
  group: content.groups.find((group) => group.id === groupId),
  locale,
  stamp: "2026-10-13",
}).render();

test("a plugin listing has the index, the matrix and a card for each plugin", () => {
  const html = page("moodle", [
    repo("moodle-local_filebank", {
      moodleLines: [
        { branch: "main", supported: [503, 503], component: "local_filebank" },
        { branch: "MOODLE_400_STABLE", supported: [400, 502], component: "local_filebank" },
      ],
      latestRelease: { tag: "v5.3.1", url: "https://example.test/v5.3.1" },
    }),
    repo("moodle-tool_demo", { moodleLines: [{ branch: "main", supported: [405, 503] }] }),
  ]);

  assert.match(html, /<p><b>2 plugins<\/b> · Moodle <code>4\.0<\/code> – <code>5\.3<\/code><\/p>/);
  assert.match(html, /## Find a plugin/);
  assert.match(html, /\| <a href="#local_filebank"><b>local_filebank<\/b><\/a> \| The moodle-local_filebank does things \| 4\.0 – 5\.3 \| 7\.4\+ \| <a href="https:\/\/example\.test\/v5\.3\.1">v5\.3\.1<\/a> \|/);
  // The component comes from the repository name when version.php does not say it.
  assert.match(html, /<a href="#tool_demo"><b>tool_demo<\/b><\/a>/);
  assert.match(html, /## What runs on my Moodle\?/);
  assert.match(html, /\| Plugin \| 4\.0 \| 4\.1 \| 4\.2 \| 4\.3 \| 4\.4 \| 4\.5 \| 5\.0 \| 5\.1 \| 5\.2 \| 5\.3 \|/);
  assert.match(html, /### local_filebank/);
  assert.match(html, /<b>Supported Moodle:<\/b> <code>4\.0<\/code> · <code>4\.1<\/code> · <code>4\.2<\/code> · <code>4\.3<\/code> · <code>4\.4<\/code> · <code>4\.5<\/code> · <code>5\.0<\/code> · <code>5\.1<\/code> · <code>5\.2<\/code> · <code>5\.3<\/code>/);
  assert.match(html, /Moodle-4\.0\+-f98012/);
  assert.match(html, /PHP-7\.4\+-777bb4/);
  assert.match(html, /License-GPL_v3-blue/);
  // The index is in alphabetical order of what is shown.
  assert.ok(html.indexOf('href="#local_filebank"') < html.indexOf('href="#tool_demo"'));
});

test("the Spanish page is the same page in Spanish", () => {
  const html = page("moodle", [repo("moodle-local_demo", { moodleLines: [{ branch: "main", supported: [503, 503] }] })], "es");

  assert.match(html, /## Encuentra un plugin/);
  assert.match(html, /## ¿Qué funciona en mi Moodle\?/);
  assert.match(html, /<b>Moodle compatible:<\/b> <code>5\.3<\/code>/);
});

test("a plugin whose version.php could not be read is listed without invented versions", () => {
  const html = page("moodle", [repo("moodle-local_unknown")]);

  assert.match(html, /\| — \| — \| — \|/);
  assert.doesNotMatch(html, /Supported Moodle/);
  assert.doesNotMatch(html, /Moodle-\d/);
  assert.doesNotMatch(html, /## What runs on my Moodle/);
});

test("a repository described only by its own name has no description", () => {
  const html = page("moodle", [repo("moodle-local_bare", { description: "moodle-local_bare" })]);

  assert.match(html, /<b>local_bare<\/b><\/a> \| — \|/);
});

test("a package listing has the index with the install command and no matrix", () => {
  const html = page("npm", [repo("prisma-entity", {
    custom_properties: { "project-type": "npm-package" },
    packages: { npm: { name: "@didactika/prisma-entity", version: "3.1.3" } },
    branchNames: ["main", "v3.x", "v2.x"],
    language: "TypeScript",
    license: { spdx_id: "MIT" },
  })]);

  assert.match(html, /## Find a package/);
  assert.match(html, /\| Package \| What it does \| Latest \| Maintained \| Install \|/);
  assert.match(html, /<code>3\.x<\/code> <code>2\.x<\/code> \| <code>npm install @didactika\/prisma-entity<\/code>/);
  assert.match(html, /<a href="https:\/\/www\.npmjs\.com\/package\/@didactika\/prisma-entity">v3\.1\.3<\/a>/);
  assert.doesNotMatch(html, /What runs on my Moodle/);
  assert.doesNotMatch(html, /Moodle-/);
});
