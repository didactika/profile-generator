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

const HOST = "https://img.shields.io";
const STYLE = "style=flat-square&color=0d9488&labelColor=1f2328";

export class Badges {
  /**
   * @param login GitHub org login
   * @param project the content.json project entry
   * @param repo the matching repository as returned by the GitHub API
   */
  static for(login, project, repo) {
    const img = (url, alt) => `<img alt="${escapeXml(alt)}" src="${url}">`;
    const out = [];

    if (repo.language) {
      out.push(img(`${HOST}/badge/${encodeURIComponent(repo.language)}-1f2328?style=flat-square`, repo.language));
    }
    if (project.npm) {
      out.push(img(`${HOST}/npm/v/${project.npm}?${STYLE}&label=npm`, "npm version"));
      out.push(img(`${HOST}/npm/dm/${project.npm}?${STYLE}&label=downloads`, "npm downloads"));
    } else {
      out.push(img(`${HOST}/github/v/release/${login}/${repo.name}?${STYLE}&label=release`, "release"));
    }
    out.push(img(`${HOST}/github/license/${login}/${repo.name}?${STYLE}&label=license`, "license"));
    out.push(img(`${HOST}/github/stars/${login}/${repo.name}?${STYLE}&label=stars`, "stars"));
    out.push(img(`${HOST}/github/last-commit/${login}/${repo.name}?${STYLE}&label=last%20commit`, "last commit"));

    return out.join(" ");
  }
}
