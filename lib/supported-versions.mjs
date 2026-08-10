/**
 * Which versions of a project are still supported, derived from its live
 * branches rather than written down anywhere.
 *
 * Both of the organisation's branching schemes encode the answer in the branch
 * name — `v3.x` for an npm major line, `MOODLE_405_STABLE` for a Moodle
 * release — and both treat a deleted branch as the definition of "no longer
 * supported". So reading the branch list is not a shortcut for a list somebody
 * would otherwise maintain: it is the only place the fact actually lives, and
 * anything written by hand would be a copy free to drift from it.
 *
 * The pattern and the style come from the group's `supportedBranches` block in
 * content.json, so adding a third scheme is an edit to the data plus, at most,
 * one formatter here.
 */

/** How a captured number becomes something a reader recognises. */
const STYLES = {
  /** `405` -> `4.5`, Moodle's own release numbering with the dot restored. */
  moodle: (captured) => {
    const digits = String(captured);
    // Moodle writes 4.5 as 405 and 5.10 would be 510: the last two digits are
    // the minor, everything before them the major.
    const major = digits.slice(0, -2);
    const minor = Number(digits.slice(-2));
    return major ? `${major}.${minor}` : digits;
  },
  /** `3` -> `3.x`, one npm major line. */
  major: (captured) => `${captured}.x`,
};

/**
 * @returns the supported versions for one repository, newest first, or an
 *   empty array when the group declares no scheme or nothing matched.
 */
export function supportedVersions(group, branchNames) {
  const scheme = group?.supportedBranches;
  if (!scheme?.pattern || !Array.isArray(branchNames)) return [];

  const format = STYLES[scheme.style];
  if (!format) return [];

  const pattern = new RegExp(scheme.pattern);
  const found = [];

  for (const name of branchNames) {
    const match = pattern.exec(name);
    // The capture is what carries the version; a pattern that matches without
    // capturing one has nothing to report, which is a mistake in the data
    // rather than something to paper over with the branch name itself.
    if (!match?.[1]) continue;
    found.push({ sort: Number(match[1]), label: format(match[1]) });
  }

  return found
    .sort((a, b) => b.sort - a.sort)
    .map((v) => v.label);
}
