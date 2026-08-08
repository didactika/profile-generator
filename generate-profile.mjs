#!/usr/bin/env node
/**
 * Renders a bilingual (EN/ES) GitHub organisation profile from content.json
 * and live GitHub data.
 *
 * This tool renders someone else's `profile/` directory — it does not carry
 * its own. Run it from inside the repository being rendered (or point
 * PROFILE_ROOT at it):
 *
 *   cd path/to/some-org/.github
 *   node path/to/profile-generator/generate-profile.mjs
 *
 * Reads   : profile/data/content.json   (every word, both languages)
 *           the GitHub REST API          (every number)
 * Writes  : profile/README.md            (English — what github.com/<org> shows)
 *           profile/README.es.md         (Spanish)
 *           profile/projects/*.md        (one detail page per project group, per language)
 *           profile/assets/*.svg         (charts, stats and tab icons, light + dark)
 *
 * Nothing here is hand-written prose, so nothing is ever maintained twice.
 * Edit content.json instead.
 *
 * A GitHub profile README cannot run JavaScript, and GitHub publishes no
 * official statistics-image endpoint, so "live" has to mean: a scheduled job
 * recomputes the numbers and commits them.
 *
 * The work lives in lib/:
 *
 *   config          paths, colour schemes, locales, branch
 *   log             console output and the warning tally
 *   theme           the palette, one instance per colour scheme
 *   text            escaping, number formatting
 *   strings         the handful of words the SVGs draw in each language
 *   content         content.json wrapped
 *   sources/        GitHubClient, ProfileCollector
 *   drawings/       Drawing and its subclasses — one class per picture
 *   pages/          Links, ReadmePage, ProjectPage, Badges
 *   output-directory  writes files and sweeps whatever it did not write
 *   generator       the order of operations, and nothing else
 *
 * Three environment variables help when working on layout:
 *   PROFILE_ROOT=<path>      render this repository instead of the working directory
 *   PROFILE_FIXTURE=<path>   render from a saved snapshot, no API calls
 *   PROFILE_DUMP=<path>      write the snapshot back out
 *   PROFILE_BRANCH=<name>    branch the asset URLs point at (default: main)
 *
 * No dependencies. Node >= 20 (global fetch).
 */

import { readFile, writeFile } from "node:fs/promises";

import { PATHS } from "./lib/config.mjs";
import { log } from "./lib/log.mjs";
import { Content } from "./lib/content.mjs";
import { GitHubClient } from "./lib/sources/github.mjs";
import { ProfileCollector } from "./lib/sources/collector.mjs";
import { ProfileGenerator } from "./lib/generator.mjs";

async function gather(content) {
  if (process.env.PROFILE_FIXTURE) {
    return JSON.parse(await readFile(process.env.PROFILE_FIXTURE, "utf8"));
  }
  const collector = new ProfileCollector({
    github: new GitHubClient({
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      log,
      userAgent: `${content.login}-profile-generator`,
    }),
    log,
  });
  return collector.collect(content.login);
}

async function main() {
  const content = await Content.load(PATHS.content);
  const data = await gather(content);

  if (process.env.PROFILE_DUMP) {
    await writeFile(process.env.PROFILE_DUMP, JSON.stringify(data, null, 2), "utf8");
  }

  await new ProfileGenerator({ content, data, log }).run();
}

main().catch((e) => { console.error(e); process.exit(1); });
