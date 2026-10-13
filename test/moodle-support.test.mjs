import assert from "node:assert/strict";
import test from "node:test";

import { MOODLE_RELEASES, moodleLabel, moodleSupport, parseVersionFile, releaseColumns } from "../lib/moodle-plugin.mjs";

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

test("the PHP version is the lowest one that runs the lowest supported Moodle", () => {
  assert.equal(moodleSupport([{ supported: [400, 502] }]).php, "7.4");
  assert.equal(moodleSupport([{ supported: [503, 503] }]).php, MOODLE_RELEASES[503]);
  assert.equal(moodleSupport([{ supported: [405, 503] }]).php, "8.1");
});

test("a release newer than the table is still listed, without a PHP version", () => {
  const support = moodleSupport([{ supported: [503, 600] }]);

  assert.deepEqual(support.labels, ["5.3", "6.0"]);
  assert.equal(support.php, MOODLE_RELEASES[503]);
  assert.equal(moodleSupport([{ supported: [600, 600] }]).php, null);
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
