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
- An EN/ES tab bar, and one detail page per project group with badges pulled
  live from shields.io.

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

Set `org.associatedOrganizations` to a list of GitHub organisation logins when
the profile represents a wider initiative. Their public, non-archived,
non-fork repositories are included in every aggregate. Project entries for an
associated organisation use the owner-qualified form, for example
`resilientmq/core`; repositories in the primary organisation may keep their
short name.

Project groups can declare `projectTypes`, containing values from the
organization custom property `project-type`. Public repositories with one of
those values are discovered automatically across the primary and associated
organizations. A matching `projects` entry is an editorial override, not an
allowlist; repositories without one use their GitHub description, homepage and
name. An entry whose repository is not public remains an intentional “in
development” preview.

The top-level `sections` object controls the profile layout without code
changes. `about`, `relationships`, `projects`, `metrics`, `contributors`,
`contributing` and `founders` each accept `enabled: false`; omitted sections
remain enabled for backwards compatibility. `sections.projects.showPending`
controls whether declared projects without a public repository are shown, and
individual project groups accept `enabled: false` as well.

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
  sources/                     GitHubClient, ProfileCollector
  drawings/                     Drawing and its subclasses — one class per picture
  pages/                         Links, ReadmePage, ProjectPage, Badges
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
