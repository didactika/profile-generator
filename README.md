# profile-generator

Renders a bilingual (EN/ES) GitHub organisation profile — README, per-project
detail pages, and every chart as a hand-drawn, animated SVG — from a
`content.json` file and live GitHub data. No dependencies, no build step,
Node ≥ 20.

It powers [didactika/.github](https://github.com/didactika/.github), which is
also the reference example of everything this tool expects to find.

## What it draws

- A headline strip: repositories, contributors, commits in the last 12
  months, stars, releases.
- Code by language, repositories by licence, commits by day of week, commits
  by repository — ranked horizontal bars, animated in on load.
- Fifty-two weeks of commit activity, as a line that draws itself.
- An EN/ES tab bar, and one listing page per project group, built to be scanned:
  an index with one line for each project, a compatibility matrix for the
  Moodle plugins, and a detail card for each with its badges.

Every chart animates once when the image loads — bars grow, the activity
line draws itself, tiles rise into place — and holds. It is CSS embedded in
the SVG itself, so it plays through a plain `<img>` tag with no JavaScript,
and it respects `prefers-reduced-motion`.

## Usage

This tool renders someone else's `profile/` directory; it does not carry its
own. Run it from inside the repository being rendered:

```bash
cd path/to/some-org/.github
node path/to/profile-generator/generate-profile.mjs
```

Or check it out alongside the target repository in CI — see
[didactika/.github's update-profile.yml](https://github.com/didactika/.github/blob/main/.github/workflows/update-profile.yml)
for the pattern this actually runs under.

### Expects, in the repository being rendered

```
profile/data/content.json   # every word, in both languages — see didactika/.github for the shape
profile/README.md           # written
profile/README.es.md        # written
profile/projects/*.md       # written, one per project group per language
profile/assets/*.svg        # written, light + dark
```

Set `org.memberOrganizations` to organisation logins (or objects with `login`
and an optional display `name`) when other organisations belong to the
initiative. Their public, non-archived, non-fork repositories are included in
every aggregate, and the generator can render their live GitHub avatar and
description in a final member-organisations section. Use
`org.associatedOrganizations` only for an organisation whose metrics should be
aggregated without presenting it as a member. Project entries outside the
primary organisation use the owner-qualified form, for example
`resilientmq/core`.

`org.parent` renders a small hierarchical link directly below the organisation
name. It is distinct from member organisations: a child profile points upward
with `parent`, while the parent profile presents its children in the dedicated
section.

The optional top-level `theme` object customises generated SVGs and project
badges without forking the generator. Declare `light.brand` and `dark.brand` as
six-digit hex colours; the soft chart fill is derived automatically.

Project groups can declare `projectTypes`, containing values from the
organization custom property `project-type`. Public repositories with one of
those values are discovered automatically across the primary and associated
organizations. A matching `projects` entry is an editorial override, not an
allowlist; repositories without one use their GitHub description, homepage and
name. An entry whose repository is not public remains an intentional “in
development” preview.

A group can also declare `discover.npm: true`. The generator reads the root
`package.json` of every public repository, ignores private manifests, verifies
the package against the public npm registry, and requires npm's repository
metadata to point back to the same GitHub repository. Published packages are
then included automatically; matching `projects` entries remain optional
editorial and translation overrides.

The top-level `sections` object controls the profile layout without code
changes. `parent`, `about`, `projects`, `metrics`, `contributors`,
`contributing`, `founders` and `memberOrganizations` each accept
`enabled: false`; omitted sections remain enabled for backwards compatibility.
`sections.projects.showPending` controls whether declared projects without a
public repository are shown, and individual project groups accept
`enabled: false` as well.

### The project listings

Each project group gets one page per language, made of three views of the same
data so a reader can find a project three ways:

1. **An index**, one row per project, in alphabetical order of the name shown,
   with the facts that are compared. For Moodle plugins: what it does, the
   range of Moodle versions, the PHP its README states and the latest release.
   For packages: what it does, the latest version, the maintained lines and the
   install command. Each name links to its card.
2. **A compatibility matrix** (Moodle plugins), with the plugins down the side
   and every Moodle release across the top, so a reader looks along their own
   version.
3. **A detail card** for each project: badges, the description, the supported
   versions listed one by one, and its links (GitHub, Moodle.org or npm, the
   documentation when the homepage is not one of those, and the releases).

A Moodle plugin is shown by its component (`local_demo`), which its
`version.php` states and, where it does not, its repository name
(`moodle-local_demo`) gives. A repository whose description is only its name is
shown without a description rather than repeating the name.

#### Published and unpublished

What people can find where they look for it is on one page, and what they
cannot is on another (`moodle.md` and `moodle-unpublished.md`, and the same for
the other groups and for each language), both with the same index, matrix and
cards. The unpublished page exists only when something is unpublished. On the
profile the groups are cards side by side, and their two counts are the links to
the two pages:

- a **plugin is published** when the Moodle plugins directory has its component.
  The directory is read once per run from the list Moodle publishes for programs
  (`download.moodle.org/api/1.3/pluglist.php`), not page by page: the pages of
  moodle.org answer a rapid succession of requests, or one from the servers of
  GitHub Actions, with a 429 or a 403. A directory that cannot be read stops the
  run instead of turning every plugin into an unpublished one;
- a **package is published** when the npm registry has it and its metadata
  points back to the repository.

An unpublished project has no Moodle.org or npm link and no install command; it
can be used from its repository. The published page links to the unpublished one from its count.

A repository whose `version.php` still says `PLUGINTYPE_PLUGINNAME` as its
component is the unfilled template of the plugins, not a plugin, and is not
listed at all.

#### What a Moodle plugin supports

It is read, never typed. For each plugin the collector reads `version.php` on
the default branch and on every `MOODLE_XXX_STABLE` branch and takes
`$plugin->supported = [lowest, highest]` of each. What the plugin supports is
the union of those ranges, and **every Moodle release between the lowest and the
highest is listed**, including the ones that have no branch of its own. The
releases that exist are in `lib/moodle-plugin.mjs` (`MOODLE_RELEASES`); add an
entry there when Moodle ships a new release. A plugin whose `version.php` cannot
be read is listed without versions rather than with invented ones.

#### Badges

A Moodle plugin carries the badges its own README has, in the same form:

- `License` as the static GPL v3 badge, linked to the `LICENSE` file of the
  repository (any other licence keeps the live badge of GitHub),
- `Moodle` with the lowest supported version and a plus sign (`Moodle-4.5+`),
  linked to moodle.org,
- `PHP`, **only when the README of the plugin has a PHP badge**, and with what
  that badge says (`PHP-8.3+`). The profile repeats it rather than working it
  out, so the plugin is the one that maintains it; a README without the badge
  leaves the profile without a PHP requirement for that plugin,

followed by the latest release. A package carries its language, the npm version
and downloads, and its licence.

### Environment variables

| Variable | Effect |
|---|---|
| `GITHUB_TOKEN` / `GH_TOKEN` | Authenticates the GitHub API calls. Unauthenticated runs get 60 requests/hour, which this generator will exhaust on most organisations. |
| `PROFILE_ROOT` | Render this path instead of the working directory. |
| `PROFILE_FIXTURE` | Render from a saved JSON snapshot instead of calling the API — for working on layout without spending request budget. |
| `PROFILE_DUMP` | Write the collected data to this path, to create a fixture. |
| `PROFILE_BRANCH` | Branch the asset URLs are pinned to (default `main`). |
| `PROFILE_GENERATOR_URL` | Where the credit line in the footer points (default: this repository). |

A run never renders zeros in place of real figures: if the GitHub API is
rate-limited, it throws instead of writing a page with the budget it ran out
of.

Run the dependency-free test suite with:

```bash
node --test
```

## Structure

```
generate-profile.mjs   entry point: gathers data, hands it to the generator
lib/
  config.mjs             paths, colour schemes, locales, branch
  log.mjs                 console output and the warning tally
  theme.mjs                the palette, one instance per colour scheme
  text.mjs                  escaping, number formatting
  strings.mjs                the handful of words the SVGs draw in each language
  content.mjs                 content.json wrapped
  moodle-plugin.mjs            version.php parsing and the Moodle releases that exist
  publication.mjs                 whether a plugin or a package is published where people look for it
  sources/                     GitHubClient, NpmRegistryClient, MoodleDirectoryClient, ProfileCollector
  drawings/                     Drawing and its subclasses — one class per picture
  pages/                         Links, ReadmePage, ProjectPage, Badges, listing (index and matrix)
  output-directory.mjs            writes files and sweeps whatever it did not write
  generator.mjs                    the order of operations, and nothing else
```

Each drawing is a small class extending `Drawing`, which owns the SVG
wrapper, the text primitive and the shared animation. Each page is a class
that reads `content.json` plus the collected data and renders one file.
Nothing outside `sources/` calls the GitHub API, and nothing outside
`drawings/` and `pages/` knows what markup a chart or a page produces.

## License

Proprietary — see [LICENSE](LICENSE). This is not the same licence as most
Didactika projects; read it before reusing anything here.
