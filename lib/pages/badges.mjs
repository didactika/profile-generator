/**
 * Per-project badges from shields.io.
 *
 * The one place a third-party service earns its keep: a detail page is where
 * someone is deciding whether to install the thing, and shields re-reads
 * GitHub and npm on every page load, so version, licence and downloads stay
 * live without this repository ever committing them.
 *
 * A Moodle plugin gets the three badges that its own README carries, so the
 * profile and the repository say the same thing in the same way: the lowest
 * Moodle version it supports, the PHP it runs on and its licence. The Moodle
 * version is worked out from the `version.php` of its branches and the PHP
 * is read from the badge of the plugin's README; nothing is typed here.
 *
 * Tested 2026-08-06 against this org: github-readme-stats returned
 * DEPLOYMENT_PAUSED, github-profile-summary-cards 500, star-history 503 and
 * contrib.rocks would not connect — so the organisation-wide aggregates stay
 * self-generated and only this per-project row is bought in.
 */

import { escapeXml } from "../text.mjs";
import { brandFor } from "../theme.mjs";
import { moodleLabel } from "../moodle-plugin.mjs";

const HOST = "https://img.shields.io";

/** The licences that have a badge of their own, written the way the READMEs of the plugins write them. */
const STATIC_LICENCES = [
  { test: /^GPL-3\.0/, label: "GPL_v3", alt: "GPL v3" },
];

export class Badges {
  /**
   * @param project the content.json project entry
   * @param repo the matching repository as returned by the GitHub API
   * @param theme the palette overrides of content.json
   * @param options kind is "moodle" for a plugin and anything else for a package; support is what
   *   moodleSupport() worked out for the plugin; php is what the README of the plugin says, if it says anything
   */
  static for(project, repo, theme = {}, options = {}) {
    const img = (url, alt) => `<img alt="${escapeXml(alt)}" src="${url}">`;
    const link = (href, image) => `<a href="${href}">${image}</a>`;
    const out = [];
    const fullName = repo.full_name;
    const brand = brandFor(theme, "light").slice(1);
    const style = `style=flat-square&color=${brand}&labelColor=1f2328`;

    if (options.kind === "moodle") {
      const support = options.support;
      if (support) {
        const label = moodleLabel(support.first);
        out.push(link("https://moodle.org",
          img(`${HOST}/badge/Moodle-${label}+-f98012?style=flat-square&logo=moodle&logoColor=white`, `Moodle ${label}+`)));
      }
      // The PHP badge is the one the plugin's own README carries, so a plugin whose README has none shows none.
      if (options.php) {
        const message = options.php.replace(/-/g, "--").replace(/s+/g, "_");
        out.push(link("https://www.php.net",
          img(`${HOST}/badge/PHP-${message}-777bb4?style=flat-square&logo=php&logoColor=white`, `PHP ${options.php}`)));
      }
      out.push(Badges.#licence(repo, img, link, style));
      out.push(img(`${HOST}/github/v/release/${fullName}?${style}&label=release`, "release"));
      return out.join(" ");
    }

    if (repo.language) {
      out.push(img(`${HOST}/badge/${encodeURIComponent(repo.language)}-1f2328?style=flat-square`, repo.language));
    }
    if (project.npm) {
      out.push(img(`${HOST}/npm/v/${project.npm}?${style}&label=npm`, "npm version"));
      out.push(img(`${HOST}/npm/dm/${project.npm}?${style}&label=downloads`, "npm downloads"));
    } else {
      out.push(img(`${HOST}/github/v/release/${fullName}?${style}&label=release`, "release"));
    }
    out.push(Badges.#licence(repo, img, link, style));
    return out.join(" ");
  }

  /** The static badge of the licence when it has one, linked to the LICENSE file of the repository, and the live
   *  badge of GitHub for any other licence. */
  static #licence(repo, img, link, style) {
    const spdx = repo.license?.spdx_id || "";
    const known = STATIC_LICENCES.find((candidate) => candidate.test.test(spdx));
    if (!known) {
      return img(`${HOST}/github/license/${repo.full_name}?${style}&label=license`, "license");
    }
    const file = `${repo.html_url}/blob/${repo.default_branch || "main"}/LICENSE`;
    return link(file, img(`${HOST}/badge/License-${known.label}-blue?style=flat-square`, `License ${known.alt}`));
  }
}
