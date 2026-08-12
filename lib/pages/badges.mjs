/**
 * Per-project badges from shields.io.
 *
 * The one place a third-party service earns its keep: a detail page is where
 * someone is deciding whether to install the thing, and shields re-reads
 * GitHub and npm on every page load, so version, licence, stars and last
 * commit stay live without this repository ever committing them.
 *
 * Tested 2026-08-06 against this org: github-readme-stats returned
 * DEPLOYMENT_PAUSED, github-profile-summary-cards 500, star-history 503 and
 * contrib.rocks would not connect — so the organisation-wide aggregates stay
 * self-generated and only this per-project row is bought in.
 */

import { escapeXml } from "../text.mjs";
import { brandFor } from "../theme.mjs";

const HOST = "https://img.shields.io";

export class Badges {
  /**
   * @param project the content.json project entry
   * @param repo the matching repository as returned by the GitHub API
   */
  static for(project, repo, theme = {}) {
    const img = (url, alt) => `<img alt="${escapeXml(alt)}" src="${url}">`;
    const out = [];
    const fullName = repo.full_name;
    const brand = brandFor(theme, "light").slice(1);
    const style = `style=flat-square&color=${brand}&labelColor=1f2328`;

    if (repo.language) {
      out.push(img(`${HOST}/badge/${encodeURIComponent(repo.language)}-1f2328?style=flat-square`, repo.language));
    }
    if (project.npm) {
      out.push(img(`${HOST}/npm/v/${project.npm}?${style}&label=npm`, "npm version"));
      out.push(img(`${HOST}/npm/dm/${project.npm}?${style}&label=downloads`, "npm downloads"));
    } else {
      out.push(img(`${HOST}/github/v/release/${fullName}?${style}&label=release`, "release"));
    }
    out.push(img(`${HOST}/github/license/${fullName}?${style}&label=license`, "license"));
    out.push(img(`${HOST}/github/stars/${fullName}?${style}&label=stars`, "stars"));
    out.push(img(`${HOST}/github/last-commit/${fullName}?${style}&label=last%20commit`, "last commit"));

    return out.join(" ");
  }
}
