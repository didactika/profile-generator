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
  #npm;

  constructor({ github, npm, log }) {
    this.#github = github;
    this.#npm = npm;
    this.#log = log;
  }

  async collect(organizations) {
    const [login] = organizations;
    this.#log.step(`Fetching ${organizations.join(", ")} …`);
    const organizationProfiles = await this.#organizationProfiles(organizations);
    const repos = await this.#repositories(organizations);
    this.#log.detail(`${repos.length} public repos`);

    const totals = await this.#walkRepositories(repos, login);
    const timeline = this.#timeline(totals.weeks);

    return {
      org: login,
      organizations: organizationProfiles,
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

  async #organizationProfiles(organizations) {
    return Promise.all(organizations.map(async (login) => {
      const org = await this.#github.get(`/orgs/${login}`);
      return {
        login: org.login,
        name: org.name || org.login,
        description: org.description || "",
        avatar: org.avatar_url,
        url: org.html_url,
        website: org.blog || "",
      };
    }));
  }

  /** Public, non-archived, non-fork repositories, minus this org's own
   *  profile infrastructure. */
  async #repositories(organizations) {
    const kept = [];
    for (const login of organizations) {
      const all = (await this.#github.get(`/orgs/${login}/repos?per_page=100&type=public`)) || [];
      kept.push(...all.filter((r) =>
        !r.private && !r.archived && !r.fork && !ProfileCollector.#INFRASTRUCTURE.has(r.name)
      ));
    }

    // Branch names are how the profile answers "which versions are supported"
    // without anybody maintaining a list: the org's branching schemes put that
    // fact in the branch name itself (vMAJOR.x, MOODLE_XXX_STABLE), so a line
    // that has gone out of support disappears from the profile the moment its
    // branch is deleted. One extra request per repository, and it is what
    // keeps the claim honest.
    for (const repo of kept) {
      const branches = (await this.#github.get(`/repos/${repo.full_name}/branches?per_page=100`)) || [];
      repo.branchNames = branches.map((b) => b.name);
    }

    await this.#discoverPublishedNpmPackages(kept);

    return kept;
  }

  /**
   * Reads each public repository's root package manifest and retains npm
   * metadata only when the package is public and points back to that repository.
   */
  async #discoverPublishedNpmPackages(repos) {
    if (!this.#npm) return;

    for (const repo of repos) {
      const file = await this.#github.get(`/repos/${repo.full_name}/contents/package.json`, {
        optional: true,
      });
      if (!file?.content || file.encoding !== "base64") continue;

      let manifest;
      try {
        const json = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
        manifest = JSON.parse(json);
      } catch (error) {
        this.#log.warn(`Invalid package.json in ${repo.full_name}: ${error.message}`);
        continue;
      }

      if (manifest.private === true || typeof manifest.name !== "string" || !manifest.name.trim()) continue;

      const published = await this.#npm.publishedPackage(manifest.name);
      if (!published) continue;
      if (!this.#belongsToRepository(published.repository, repo.full_name)) {
        this.#log.warn(
          `Ignoring npm package ${published.name}: its registry metadata does not point to ${repo.full_name}`,
        );
        continue;
      }

      repo.packages = {
        ...(repo.packages || {}),
        npm: { name: published.name, version: published.version },
      };
    }
  }

  /** Returns whether npm repository metadata identifies the expected GitHub repository. */
  #belongsToRepository(repositoryUrl, fullName) {
    const match = repositoryUrl.match(/github\.com[/:]([^/\s]+)\/([^/#\s]+?)(?:\.git)?(?:[?#].*)?$/i);
    return Boolean(match && `${match[1]}/${match[2]}`.toLowerCase() === fullName.toLowerCase());
  }

  async #walkRepositories(repos, login) {
    const languages = new Map(), licenses = new Map();
    const contributors = new Map(), weeks = new Map(), perRepo = new Map();
    const weekdays = [0, 0, 0, 0, 0, 0, 0]; // Sunday-first, as GitHub returns it
    let stars = 0, releases = 0;

    for (const repo of repos) {
      stars += repo.stargazers_count || 0;
      this.#tallyLicense(licenses, repo);
      await this.#tallyLanguages(languages, repo);
      await this.#tallyContributors(contributors, repo);

      const repoCommits = await this.#tallyActivity(weeks, weekdays, repo);
      const repoLabel = repo.owner.login.toLowerCase() === login.toLowerCase()
        ? repo.name : repo.full_name;
      if (repoCommits > 0) perRepo.set(repoLabel, repoCommits);

      releases += ((await this.#github.get(`/repos/${repo.full_name}/releases?per_page=100`)) || []).length;

      this.#log.detail(`· ${repo.full_name}`);
    }

    return { languages, licenses, contributors, weeks, perRepo, weekdays, stars, releases };
  }

  #tallyLicense(licenses, repo) {
    const lic = repo.license?.spdx_id;
    if (lic && lic !== "NOASSERTION") licenses.set(lic, (licenses.get(lic) || 0) + 1);
  }

  async #tallyLanguages(languages, repo) {
    const bytes = (await this.#github.get(`/repos/${repo.full_name}/languages`)) || {};
    for (const [name, n] of Object.entries(bytes)) {
      languages.set(name, (languages.get(name) || 0) + n);
    }
  }

  async #tallyContributors(contributors, repo) {
    const rows = (await this.#github.get(`/repos/${repo.full_name}/contributors?per_page=100`)) || [];
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
  async #tallyActivity(weeks, weekdays, repo) {
    const activity = await this.#github.get(`/repos/${repo.full_name}/stats/commit_activity`);
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
