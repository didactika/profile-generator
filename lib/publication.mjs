/**
 * Whether a project is published where people look for it: a Moodle plugin in the Moodle plugins directory, a package
 * on npm. What is not is still listed, in a section of its own, because it can be used from its repository.
 */

/** A group whose versions are Moodle releases is a plugin group; any other is a group of packages. */
export function groupKind(group) {
  return group?.supportedBranches?.style === "moodle" ? "moodle" : "npm";
}

/** @param kind "moodle" or "npm" @param repo the repository as the collector returned it */
export function isPublished(kind, repo) {
  return kind === "moodle" ? Boolean(repo?.moodleDirectory) : Boolean(repo?.packages?.npm);
}
