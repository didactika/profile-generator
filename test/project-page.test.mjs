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
      projectTypes: ["npm-package"],
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

/** A plugin that the Moodle plugins directory has. */
const listed = (component) => ({ component, url: `https://moodle.org/plugins/${component}` });

const page = (groupId, repos, locale = "en") => new ProjectPage({
  content,
  data: { repos },
  links: new Links("didactika", "main"),
  group: content.groups.find((group) => group.id === groupId),
  locale,
  stamp: "2026-10-13",
}).render();

test("a plugin listing has the index, the matrix and a card for each published plugin", () => {
  const html = page("moodle", [
    repo("moodle-local_filebank", {
      moodleDirectory: listed("local_filebank"),
      phpBadge: "7.4+",
      moodleLines: [
        { branch: "main", supported: [503, 503], component: "local_filebank" },
        { branch: "MOODLE_400_STABLE", supported: [400, 502], component: "local_filebank" },
      ],
      latestRelease: { tag: "v5.3.1", url: "https://example.test/v5.3.1" },
    }),
    repo("moodle-tool_demo", { moodleDirectory: listed("tool_demo"), moodleLines: [{ branch: "main", supported: [405, 503] }] }),
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
  assert.match(html, /<a href="https:\/\/moodle\.org\/plugins\/local_filebank">Moodle\.org<\/a>/);
  assert.doesNotMatch(html, /Unpublished/);
  // The index is in alphabetical order of what is shown.
  assert.ok(html.indexOf('href="#local_filebank"') < html.indexOf('href="#tool_demo"'));
});

test("a card has no arrow back to the top of the page", () => {
  const html = page("moodle", [
    repo("moodle-local_demo", { moodleDirectory: listed("local_demo"), moodleLines: [{ branch: "main", supported: [503, 503] }] }),
  ]);

  assert.doesNotMatch(html, /↑/);
  assert.doesNotMatch(html, /href="#">/);
});

test("the plugins that are not in the Moodle directory have a section of their own after the published ones", () => {
  const html = page("moodle", [
    repo("moodle-local_listed", { moodleDirectory: listed("local_listed"), moodleLines: [{ branch: "main", supported: [503, 503] }] }),
    repo("moodle-local_unlisted", { moodleLines: [{ branch: "main", supported: [405, 503] }] }),
  ]);

  assert.match(html, /<p><b>2 plugins<\/b> · Moodle <code>4\.5<\/code> – <code>5\.3<\/code> · <b>1<\/b> unpublished<\/p>/);
  const published = html.indexOf("## Find a plugin");
  const unpublished = html.indexOf("## Unpublished plugins");
  assert.ok(published > -1 && unpublished > published);
  assert.match(html, /Not in the Moodle plugins directory yet\./);
  // Each plugin is in the section that is its own, and only there.
  assert.ok(html.indexOf("### local_listed") < unpublished);
  assert.ok(html.indexOf("### local_unlisted") > unpublished);
  assert.equal(html.match(/### local_unlisted/g).length, 1);
  // An unpublished plugin has no page in the directory to link to.
  assert.doesNotMatch(html.slice(unpublished), /Moodle\.org<\/a>/);
  assert.doesNotMatch(html, /---\n\n---/);
});

test("a listing with nothing published starts straight on the unpublished plugins", () => {
  const html = page("moodle", [repo("moodle-local_unlisted", { moodleLines: [{ branch: "main", supported: [503, 503] }] })]);

  assert.doesNotMatch(html, /## Find a plugin/);
  assert.match(html, /## Unpublished plugins/);
  assert.match(html, /<p><b>1 plugin<\/b> · Moodle <code>5\.3<\/code> · <b>1<\/b> unpublished<\/p>/);
  assert.doesNotMatch(html, /---\n\n---/);
});

test("the Spanish page is the same page in Spanish", () => {
  const html = page("moodle", [
    repo("moodle-local_demo", { moodleDirectory: listed("local_demo"), moodleLines: [{ branch: "main", supported: [503, 503] }] }),
    repo("moodle-local_other", { moodleLines: [{ branch: "main", supported: [503, 503] }] }),
  ], "es");

  assert.match(html, /## Encuentra un plugin/);
  assert.match(html, /## ¿Qué funciona en mi Moodle\?/);
  assert.match(html, /## Plugins sin publicar/);
  assert.match(html, /<b>1<\/b> sin publicar/);
  assert.match(html, /<b>Moodle compatible:<\/b> <code>5\.3<\/code>/);
});

test("the PHP of a plugin is what its README says, and a README that says nothing leaves it out", () => {
  const html = page("moodle", [
    repo("moodle-local_with", { moodleDirectory: listed("local_with"), phpBadge: "8.3+", moodleLines: [{ branch: "main", supported: [400, 503] }] }),
    repo("moodle-local_without", { moodleDirectory: listed("local_without"), moodleLines: [{ branch: "main", supported: [400, 503] }] }),
  ]);

  assert.match(html, /<b>local_with<\/b><\/a> \|[^\n]*\| 4\.0 – 5\.3 \| 8\.3\+ \|/);
  assert.match(html, /<b>local_without<\/b><\/a> \|[^\n]*\| 4\.0 – 5\.3 \| — \|/);
  assert.equal(html.match(/PHP-/g).length, 1, "one badge, the one the README of local_with has");
});

test("a repository that still is the template of the plugins is not listed", () => {
  const html = page("moodle", [
    repo("moodle-local_real", { moodleDirectory: listed("local_real"), moodleLines: [{ branch: "main", supported: [503, 503], component: "local_real" }] }),
    repo("moodle-local_fresh", { moodleLines: [{ branch: "main", supported: [503, 503], component: "PLUGINTYPE_PLUGINNAME" }] }),
  ]);

  assert.match(html, /<p><b>1 plugin<\/b>/);
  assert.doesNotMatch(html, /PLUGINTYPE_PLUGINNAME/);
  assert.doesNotMatch(html, /local_fresh/);
  assert.doesNotMatch(html, /Unpublished/);
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
  assert.doesNotMatch(html, /Unpublished/);
});

test("the packages that are not on npm have a section of their own, without an install command or an npm link", () => {
  const html = page("npm", [
    repo("prisma-entity", {
      custom_properties: { "project-type": "npm-package" },
      packages: { npm: { name: "@didactika/prisma-entity", version: "3.1.3" } },
      branchNames: ["main", "v3.x"],
      license: { spdx_id: "MIT" },
    }),
    repo("moodle-client", {
      custom_properties: { "project-type": "npm-package" },
      homepage: "https://www.npmjs.com/package/@didactika/moodle-client",
      license: { spdx_id: "MIT" },
    }),
  ]);

  assert.match(html, /<p><b>2 packages<\/b> · <b>1<\/b> unpublished<\/p>/);
  const unpublished = html.indexOf("## Unpublished packages");
  assert.ok(unpublished > html.indexOf("## Find a package"));
  assert.match(html, /Not on npm yet\./);
  const section = html.slice(unpublished);
  assert.match(section, /### @didactika\/moodle-client/);
  assert.doesNotMatch(section, /npm install/);
  assert.doesNotMatch(section, /npmjs\.com/);
  assert.doesNotMatch(section, /npm\/v\//);
  assert.doesNotMatch(html.slice(0, unpublished), /moodle-client/);
});
