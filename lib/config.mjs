/**
 * Where everything lives, and the knobs the environment can turn.
 *
 * This tool renders someone else's `profile/` directory, not its own: it is
 * meant to be checked out beside a profile repository and run from inside it.
 * Paths are therefore resolved from the working directory, not from this
 * file's location — the opposite choice from a generator that ships inside
 * the repo it renders.
 */

import { join } from "node:path";

/** PROFILE_ROOT overrides the working directory, for a caller that cannot cd
 *  into the target repository before running this. */
const ROOT = process.env.PROFILE_ROOT || process.cwd();

export const PATHS = {
  root: ROOT,
  content: join(ROOT, "profile", "data", "content.json"),
  assets: join(ROOT, "profile", "assets"),
  projects: join(ROOT, "profile", "projects"),
  readme: (locale) => join(ROOT, "profile", locale === "es" ? "README.es.md" : "README.md"),
};

/** Every drawing is rendered once per colour scheme and picked by <picture>. */
export const MODES = ["light", "dark"];

/** The profile is bilingual; every page and drawing is rendered once per locale. */
export const LOCALES = ["en", "es"];

/** Asset URLs are absolute and branch-pinned, because a profile README is read
 *  from github.com/<org> where relative paths resolve to nothing useful. */
export const BRANCH = process.env.PROFILE_BRANCH || "main";

/** Where this tool itself lives, for the credit line in what it generates.
 *  Overridable so a fork or a private mirror can point the credit at itself. */
export const GENERATOR_URL = process.env.PROFILE_GENERATOR_URL
  || "https://github.com/didactika/profile-generator/blob/main/generate-profile.mjs";

/* Half the gutter between two grid tiles, in chart units. Applied only to a
 * tile's inner edge, so none of it is wasted as an outer margin and the outer
 * edges stay flush with the full-width charts above and below.
 *
 * It has to be generous: what faces across the gutter is the left tile's value
 * column against the right tile's label column — text against text. Anything
 * tighter and "79.7%" reads as though it belongs to the neighbour's row. */
export const GUTTER = 30;
