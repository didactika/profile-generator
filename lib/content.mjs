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
}
