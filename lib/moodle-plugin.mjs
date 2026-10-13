/**
 * What a Moodle plugin says about itself in `version.php`, and what that adds up to across its branches.
 *
 * A plugin states the Moodle versions it supports as a range, `$plugin->supported = [lowest, highest]`, in integer
 * branch codes (405 is Moodle 4.5). Every maintenance line keeps its own `version.php`, so what the plugin supports
 * is the union of the ranges of `main` and of every `MOODLE_XXX_STABLE` branch, and every release between the lowest
 * and the highest is supported, whether or not it has a branch of its own.
 */

/**
 * The Moodle releases that exist, so every release between the lowest and the highest a plugin supports can be listed
 * even when it has no branch of its own. A new Moodle release is a new entry here.
 */
export const MOODLE_RELEASES = [400, 401, 402, 403, 404, 405, 500, 501, 502, 503];

/** `405` -> `4.5`: Moodle writes 4.5 as 405, the last two digits being the minor. */
export function moodleLabel(code) {
  const digits = String(code);
  const major = digits.slice(0, -2);
  const minor = Number(digits.slice(-2));
  return major ? `${major}.${minor}` : digits;
}

/** The value of one `$plugin->field = …;` line, or null. */
function field(source, name) {
  const match = new RegExp(String.raw`\$plugin->${name}\s*=\s*([^;]+);`).exec(source);
  return match ? match[1].trim() : null;
}

/**
 * Reads the facts a profile needs from the text of a `version.php`.
 *
 * @returns {{supported: number[]|null, release: string|null, maturity: string|null, component: string|null}}
 */
export function parseVersionFile(source) {
  const text = String(source || "");
  const supported = /\$plugin->supported\s*=\s*\[([^\]]*)\]/.exec(text);
  const codes = supported
    ? supported[1].split(",").map((part) => Number.parseInt(part.trim(), 10)).filter(Number.isFinite)
    : [];
  const unquote = (value) => (value === null ? null : value.replace(/^['"]|['"]$/g, ""));
  const maturity = field(text, "maturity");

  return {
    supported: codes.length ? [Math.min(...codes), Math.max(...codes)] : null,
    release: unquote(field(text, "release")),
    maturity: maturity ? maturity.replace(/^MATURITY_/, "").toLowerCase() : null,
    component: unquote(field(text, "component")),
  };
}

/**
 * What a plugin supports, from the `version.php` of each of its lines.
 *
 * @param {Array<{supported: number[]|null}>} lines one entry per branch that was read
 * @returns {{first: number, last: number, codes: number[], labels: string[]}|null} null when no line
 *   declares a range
 */
export function moodleSupport(lines) {
  const ranges = (lines || []).map((line) => line?.supported).filter((range) => Array.isArray(range) && range.length === 2);
  if (!ranges.length) return null;

  const first = Math.min(...ranges.map((range) => range[0]));
  const last = Math.max(...ranges.map((range) => range[1]));
  // Every release between the two ends, and the ends themselves in case one is newer than the table.
  const codes = [...new Set([
    first,
    last,
    ...MOODLE_RELEASES.filter((code) => code > first && code < last),
  ])].sort((a, b) => a - b);

  return {
    first,
    last,
    codes,
    labels: codes.map(moodleLabel),
  };
}

/** Every Moodle release that falls between the lowest and the highest that any of the plugins supports, for the
 *  columns of a compatibility matrix. */
export function releaseColumns(supports) {
  const known = supports.filter(Boolean);
  if (!known.length) return [];
  return [...new Set(known.flatMap((support) => support.codes))].sort((a, b) => a - b)
    .filter((code, _index, all) => code >= all[0] && code <= all[all.length - 1]);
}

/** What the template of the Moodle plugins has in `$plugin->component` until somebody fills `version.php` in. */
export const TEMPLATE_COMPONENT = "PLUGINTYPE_PLUGINNAME";

/** Whether a repository still is the unfilled template of the plugins, which is not a plugin and is never listed. */
export function isUnfilledTemplate(repo) {
  return (repo?.moodleLines || []).some((line) => String(line?.component || "").includes(TEMPLATE_COMPONENT));
}

/**
 * The component of a plugin (`local_demo`), which its `version.php` states and, where it does not, its repository
 * name gives: Moodle plugin repositories are `moodle-<component>`.
 */
export function pluginComponent(repo) {
  const declared = (repo?.moodleLines || []).find((line) => line?.component)?.component;
  if (declared) return declared;
  return /^moodle-([a-z]+_[a-z0-9_]+)$/.exec(repo?.name || "")?.[1] || null;
}

/**
 * The PHP requirement a plugin advertises in its own README, as it writes it ("8.3+"), or null when the README has no
 * PHP badge. The profile repeats what the README says rather than working it out, so the plugin is the one that
 * maintains it.
 */
export function phpBadgeOf(readme) {
  const match = /img\.shields\.io\/badge\/PHP-([^-?\s)"']+)-/i.exec(String(readme || ""));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).replace(/__/g, "_").replace(/_/g, " ").trim() || null;
  } catch {
    return null;
  }
}
