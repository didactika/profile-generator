import assert from "node:assert/strict";
import test from "node:test";

import {
  MOODLE_RELEASES, isUnfilledTemplate, moodleLabel, moodleSupport, parseVersionFile, phpBadgeOf, pluginComponent, releaseColumns,
} from "../lib/moodle-plugin.mjs";

test("reads what a plugin says about itself in version.php", () => {
  const parsed = parseVersionFile(`<?php
$plugin->component = 'local_iconrestyle';
$plugin->version = '2026101301.400';
$plugin->maturity = MATURITY_STABLE;
$plugin->release = '4.0.0';
$plugin->supported = [400, 502];
`);

  assert.deepEqual(parsed, { supported: [400, 502], release: "4.0.0", maturity: "stable", component: "local_iconrestyle" });
});

test("a single value is a range of one, and a missing one is no range", () => {
  assert.deepEqual(parseVersionFile("$plugin->supported = [405];").supported, [405, 405]);
  assert.equal(parseVersionFile("<?php $plugin->release = '1.0.0';").supported, null);
  assert.equal(parseVersionFile(undefined).supported, null);
});

test("Moodle writes 4.5 as 405", () => {
  assert.equal(moodleLabel(400), "4.0");
  assert.equal(moodleLabel(405), "4.5");
  assert.equal(moodleLabel(503), "5.3");
});

test("every release between the lowest and the highest is supported, intermediates included", () => {
  const support = moodleSupport([{ supported: [503, 503] }, { supported: [400, 502] }]);

  assert.equal(support.first, 400);
  assert.equal(support.last, 503);
  assert.deepEqual(support.labels, ["4.0", "4.1", "4.2", "4.3", "4.4", "4.5", "5.0", "5.1", "5.2", "5.3"]);
});

test("lines that leave a gap are still listed from the lowest to the highest", () => {
  const support = moodleSupport([{ supported: [405, 405] }, { supported: [503, 503] }]);

  assert.deepEqual(support.labels, ["4.5", "5.0", "5.1", "5.2", "5.3"]);
});

test("the support says nothing about PHP, which the README of each plugin states", () => {
  assert.equal("php" in moodleSupport([{ supported: [400, 502] }]), false);
  assert.ok(MOODLE_RELEASES.includes(503));
});

test("a release newer than the table is still listed", () => {
  const support = moodleSupport([{ supported: [503, 600] }]);

  assert.deepEqual(support.labels, ["5.3", "6.0"]);
  assert.deepEqual(moodleSupport([{ supported: [600, 600] }]).labels, ["6.0"]);
});

test("the PHP badge of a README is read as it is written, and a README without one gives none", () => {
  assert.equal(phpBadgeOf("[![PHP](https://img.shields.io/badge/PHP-8.3+-777bb4?style=flat-square)](https://php.net)"), "8.3+");
  assert.equal(phpBadgeOf("![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4)"), "8.1+");
  assert.equal(phpBadgeOf("A README that never says it."), null);
  assert.equal(phpBadgeOf(undefined), null);
});

test("the unfilled template of the plugins is recognised by its component", () => {
  assert.equal(isUnfilledTemplate({ moodleLines: [{ component: "PLUGINTYPE_PLUGINNAME" }] }), true);
  assert.equal(isUnfilledTemplate({ moodleLines: [{ component: "local_demo" }] }), false);
  assert.equal(isUnfilledTemplate({}), false);
});

test("a plugin is known by the component of its version.php or, failing that, by its repository", () => {
  assert.equal(pluginComponent({ name: "moodle-local_demo", moodleLines: [{ component: "local_other" }] }), "local_other");
  assert.equal(pluginComponent({ name: "moodle-local_demo", moodleLines: [{ component: null }] }), "local_demo");
  assert.equal(pluginComponent({ name: "something-else" }), null);
});

test("lines that declare nothing add nothing", () => {
  assert.equal(moodleSupport([{ supported: null }, {}]), null);
  assert.equal(moodleSupport([]), null);
  assert.equal(moodleSupport(undefined), null);
});

test("the columns of a matrix cover every release any plugin supports", () => {
  const a = moodleSupport([{ supported: [405, 405] }]);
  const b = moodleSupport([{ supported: [400, 502] }]);

  assert.deepEqual(releaseColumns([a, b, null]), [400, 401, 402, 403, 404, 405, 500, 501, 502]);
  assert.deepEqual(releaseColumns([null]), []);
});
