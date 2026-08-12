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

  /** Every project declared for a group, published or not — a page decides
   *  which is which once it knows what the API actually returned. */
  projectsIn(groupId) {
    return this.#data.projects.filter((p) => p.group === groupId);
  }

  /** Project ids stay short for the primary org and become owner-qualified for
   *  associated orgs, so equally named repositories cannot collide. */
  repositoryFor(repos, projectRepo) {
    return repos.find((repo) =>
      repo.full_name.toLowerCase() === projectRepo.toLowerCase()
      || (repo.owner.login.toLowerCase() === this.login.toLowerCase()
        && repo.name.toLowerCase() === projectRepo.toLowerCase())
    );
  }
}
