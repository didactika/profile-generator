/**
 * content.json wrapped: the single source of truth for every word on the
 * profile, in both languages. Pages read it through this class rather than
 * the raw object so a reshaping of the JSON only touches one file.
 */

import { readFile } from "node:fs/promises";

export class Content {
  #data;

  constructor(data) {
    this.#data = data;
  }

  static async load(path) {
    return new Content(JSON.parse(await readFile(path, "utf8")));
  }

  get login() {
    return this.#data.org.login;
  }

  get org() {
    return this.#data.org;
  }

  /** The primary organisation plus any organisations whose public projects
   *  belong to the same initiative. Entries may be logins or richer objects. */
  get metricOrganizations() {
    const associated = this.#data.org.associatedOrganizations || [];
    return [...new Set([
      this.login,
      ...associated.map((org) => typeof org === "string" ? org : org.login),
    ].filter(Boolean))];
  }

  get copy() {
    return this.#data.copy;
  }

  get groups() {
    return this.#data.groups;
  }

  get founders() {
    return this.#data.founders;
  }

  /** Projects are selected from the repository's `project-type` custom
   *  property. Entries in content.json enrich a project or announce one that
   *  is not public yet; they are not the allowlist for public repositories. */
  projectsIn(groupId, repos = []) {
    const group = this.groups.find((candidate) => candidate.id === groupId);
    const declared = this.#data.projects.filter((project) => project.group === groupId);
    if (!group?.projectTypes?.length) return declared;

    const liveDeclared = new Set();
    const discovered = repos
      .filter((repo) => group.projectTypes.includes(repo.custom_properties?.["project-type"]))
      .filter((repo) => {
        const override = this.#data.projects.find((project) => this.#matches(repo, project.repo));
        if (!override) return true;
        liveDeclared.add(override);
        return override.group === groupId;
      })
      .map((repo) => {
        const override = declared.find((project) => this.#matches(repo, project.repo));
        return { ...this.#projectFrom(repo, groupId), ...(override || {}) };
      });

    // A declaration with no public repository is still an intentional preview.
    const pending = declared.filter((project) => !liveDeclared.has(project)
      && !repos.some((repo) => this.#matches(repo, project.repo)));
    return [...discovered, ...pending];
  }

  /** Project ids stay short for the primary org and become owner-qualified for
   *  associated orgs, so equally named repositories cannot collide. */
  repositoryFor(repos, projectRepo) {
    return repos.find((repo) => this.#matches(repo, projectRepo));
  }

  #matches(repo, projectRepo) {
    return repo.full_name.toLowerCase() === projectRepo.toLowerCase()
      || (repo.owner.login.toLowerCase() === this.login.toLowerCase()
        && repo.name.toLowerCase() === projectRepo.toLowerCase());
  }

  #projectFrom(repo, groupId) {
    const homepage = repo.homepage || "";
    const npmMatch = homepage.match(/^https:\/\/(?:www\.)?npmjs\.com\/package\/(.+?)\/?$/i);
    const npm = npmMatch ? decodeURIComponent(npmMatch[1]) : undefined;
    const moodleUrl = /^https:\/\/moodle\.org\/plugins\//i.test(homepage) ? homepage : undefined;
    const description = repo.description || repo.name;

    return {
      repo: repo.owner.login.toLowerCase() === this.login.toLowerCase() ? repo.name : repo.full_name,
      group: groupId,
      name: npm || repo.name,
      ...(npm ? { npm } : {}),
      ...(moodleUrl ? { moodleUrl } : {}),
      desc: { en: description, es: description },
    };
  }
}
