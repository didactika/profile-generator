/**
 * Turns the GitHub API into the one plain object every drawing and page reads
 * from.
 *
 * Everything here is an organisation-wide aggregate — total stars, total
 * commits, every contributor across every repository — as opposed to a
 * personal profile generator, which has to weight each repository by one
 * author's share of it. An org has no "share" to weight by: every repository
 * it owns counts in full.
 *
 * The return value stays a plain serialisable object on purpose: PROFILE_DUMP
 * writes it to disk and PROFILE_FIXTURE reads it back, so layout work can
 * happen without spending API budget.
 */

const RANK_LIMIT = 6;

export class ProfileCollector {
  #github;
  #log;

  constructor({ github, log }) {
    this.#github = github;
    this.#log = log;
  }

  async collect(login) {
    this.#log.step(`Fetching ${login} …`);
    const repos = await this.#repositories(login);
    this.#log.detail(`${repos.length} public repos`);

    const totals = await this.#walkRepositories(repos, login);
    const timeline = this.#timeline(totals.weeks);

    return {
      org: login,
      repos,
      stars: totals.stars,
      releases: totals.releases,
      timeline,
      weekdays: totals.weekdays,
      languages: this.#rank(totals.languages, RANK_LIMIT),
      licenses: this.#rank(totals.licenses, RANK_LIMIT),
      perRepo: this.#rank(totals.perRepo, RANK_LIMIT),
      contributors: [...totals.contributors.values()].sort((a, b) => b.contributions - a.contributions),
      commits12mo: timeline.reduce((s, w) => s + w.total, 0),
    };
  }

  /** Repositories that are the organisation's own tooling, not something it
   *  is showcasing — excluded from the aggregates the same way a personal
   *  profile would not count its own dotfiles repo. */
  static #INFRASTRUCTURE = new Set([".github", "profile-generator"]);

  /** Public, non-archived, non-fork repositories, minus this org's own
   *  profile infrastructure. */
  async #repositories(login) {
    const all = (await this.#github.get(`/orgs/${login}/repos?per_page=100&type=public`)) || [];
    return all.filter((r) => !r.archived && !r.fork && !ProfileCollector.#INFRASTRUCTURE.has(r.name));
  }

  async #walkRepositories(repos, login) {
    const languages = new Map(), licenses = new Map();
    const contributors = new Map(), weeks = new Map(), perRepo = new Map();
    const weekdays = [0, 0, 0, 0, 0, 0, 0]; // Sunday-first, as GitHub returns it
    let stars = 0, releases = 0;

    for (const repo of repos) {
      stars += repo.stargazers_count || 0;
      this.#tallyLicense(licenses, repo);
      await this.#tallyLanguages(languages, login, repo);
      await this.#tallyContributors(contributors, login, repo);

      const repoCommits = await this.#tallyActivity(weeks, weekdays, login, repo);
      if (repoCommits > 0) perRepo.set(repo.name, repoCommits);

      releases += ((await this.#github.get(`/repos/${login}/${repo.name}/releases?per_page=100`)) || []).length;

      this.#log.detail(`· ${repo.name}`);
    }

    return { languages, licenses, contributors, weeks, perRepo, weekdays, stars, releases };
  }

  #tallyLicense(licenses, repo) {
    const lic = repo.license?.spdx_id;
    if (lic && lic !== "NOASSERTION") licenses.set(lic, (licenses.get(lic) || 0) + 1);
  }

  async #tallyLanguages(languages, login, repo) {
    const bytes = (await this.#github.get(`/repos/${login}/${repo.name}/languages`)) || {};
    for (const [name, n] of Object.entries(bytes)) {
      languages.set(name, (languages.get(name) || 0) + n);
    }
  }

  async #tallyContributors(contributors, login, repo) {
    const rows = (await this.#github.get(`/repos/${login}/${repo.name}/contributors?per_page=100`)) || [];
    for (const p of rows) {
      if (p.type === "Bot" || /\[bot\]$/.test(p.login)) continue;
      const prev = contributors.get(p.login);
      contributors.set(p.login, {
        login: p.login, avatar: p.avatar_url, url: p.html_url,
        contributions: (prev?.contributions || 0) + (p.contributions || 0),
        repos: (prev?.repos || 0) + 1,
      });
    }
  }

  /** @returns the repository's own commit count for the 52-week window, having
   *  already folded its weeks and weekdays into the running totals. */
  async #tallyActivity(weeks, weekdays, login, repo) {
    const activity = await this.#github.get(`/repos/${login}/${repo.name}/stats/commit_activity`);
    let repoCommits = 0;
    for (const w of Array.isArray(activity) ? activity : []) {
      weeks.set(w.week, (weeks.get(w.week) || 0) + w.total);
      repoCommits += w.total;
      // days[] is Sunday-first; fold it into the same order the labels use.
      (w.days || []).forEach((n, d) => { weekdays[d] += n; });
    }
    return repoCommits;
  }

  #timeline(weeks) {
    return [...weeks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, total]) => ({ week, total }));
  }

  /** Sort a name→value map descending and fold everything past `limit` into
   *  "Other", so a long tail cannot squeeze the readable rows off the chart. */
  #rank(map, limit) {
    const all = [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (all.length <= limit) return all;
    return [
      ...all.slice(0, limit - 1),
      { name: "__other__", value: all.slice(limit - 1).reduce((s, x) => s + x.value, 0) },
    ];
  }
}
