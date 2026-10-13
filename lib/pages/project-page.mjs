/**
 * The full listing for one project group, one page per language, built so a reader can find a project three ways:
 * scanning an index with one line for each, reading across a compatibility matrix for their own Moodle, or going down
 * to the detail card of one — badges, the install line, the description and where its supported versions are listed.
 */

import { escapeXml } from "../text.mjs";
import { STRINGS } from "../strings.mjs";
import { Badges } from "./badges.mjs";
import { supportedVersions } from "../supported-versions.mjs";
import { moodleLabel, moodleSupport, releaseColumns } from "../moodle-plugin.mjs";
import { LISTING_COPY, anchorFor, compatibilityMatrix, indexTable } from "./listing.mjs";

export class ProjectPage {
  constructor({ content, data, links, group, locale, stamp }) {
    this.content = content;
    this.data = data;
    this.links = links;
    this.group = group;
    this.locale = locale;
    this.stamp = stamp;
  }

  get filename() {
    return `${this.group.id}${this.locale === "es" ? ".es" : ""}.md`;
  }

  /** A group whose versions are Moodle releases is a plugin listing; any other is a list of packages. */
  get kind() {
    return this.group.supportedBranches?.style === "moodle" ? "moodle" : "npm";
  }

  render() {
    const locale = this.locale;
    const c = this.content.copy.projects;
    const projects = this.content.projectsIn(this.group.id, this.data.repos);
    const published = projects.filter((p) => this.content.repositoryFor(this.data.repos, p.repo));
    const showPending = this.content.section("projects").showPending !== false;
    const pending = showPending
      ? projects.filter((p) => !this.content.repositoryFor(this.data.repos, p.repo))
      : [];
    // By the name that is shown, so the index, the matrix and the details agree on the order a reader scans them in.
    const rows = published.map((p) => this.#row(p))
      .sort((a, b) => a.name.replace(/^@/, "").localeCompare(b.name.replace(/^@/, "")));

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator. Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.projectPage(this.group.id, "en"), this.links.projectPage(this.group.id, "es"))}

# ${this.group.label[locale]}

${this.group.blurb[locale]}

${this.#overview(rows)}${rows.length ? this.#index(rows) : `_${STRINGS[locale].noData}_\n`}${this.#matrix(rows)}${this.#details(rows)}${this.#soon(pending, c, locale)}
<sub><a href="${locale === "es" ? this.links.profileEs : this.links.profileEn}">← ${c.back[locale]}</a></sub>
`;
  }

  /** Everything the index, the matrix and the card of one project are made from. */
  #row(project) {
    const repo = this.content.repositoryFor(this.data.repos, project.repo);
    const support = this.kind === "moodle" ? moodleSupport(repo.moodleLines) : null;
    const npmVersion = repo.packages?.npm?.version;
    const latest = repo.latestRelease
      || (npmVersion && project.npm ? { tag: `v${npmVersion}`, url: `https://www.npmjs.com/package/${project.npm}` } : null);

    // A plugin is known by its component (local_demo), which its version.php states, rather than by the name of its
    // repository (moodle-local_demo), so every plugin is written the way Moodle writes it.
    // Where version.php does not say it, the repository name does: Moodle plugin repositories are moodle-<component>.
    const fromRepository = /^moodle-([a-z]+_[a-z0-9_]+)$/.exec(repo.name)?.[1];
    const component = this.kind === "moodle"
      ? repo.moodleLines?.find((line) => line.component)?.component || fromRepository
      : null;
    const name = component || project.name;
    const description = project.desc[this.locale];

    return {
      project,
      repo,
      name,
      anchor: anchorFor(name),
      // A repository with no description of its own is described by its name, which says nothing, so it says nothing.
      description: [project.name, repo.name, name].includes(description) ? "" : description,
      support,
      latest,
      lines: supportedVersions(this.group, repo.branchNames),
      install: project.npm ? `npm install ${project.npm}` : null,
    };
  }

  /** How many projects there are and, for plugins, how far the Moodle versions they cover reach. */
  #overview(rows) {
    if (!rows.length) return "";
    const copy = LISTING_COPY[this.locale];
    const [one, many] = copy.nouns[this.kind];
    const parts = [`<b>${rows.length} ${rows.length === 1 ? one : many}</b>`];
    const columns = this.kind === "moodle" ? releaseColumns(rows.map((row) => row.support)) : [];
    if (columns.length) {
      const first = columns[0];
      const last = columns[columns.length - 1];
      const label = (code) => `<code>${moodleLabel(code)}</code>`;
      parts.push(`Moodle ${label(first)} – ${label(last)}`);
    }
    return `<p>${parts.join(" · ")}</p>\n\n---\n\n`;
  }

  #index(rows) {
    const copy = LISTING_COPY[this.locale];
    return `## ${copy.find[this.kind]}\n\n${indexTable(this.kind, rows, this.locale)}\n\n`;
  }

  #matrix(rows) {
    if (this.kind !== "moodle") return "";
    const copy = LISTING_COPY[this.locale];
    const columns = releaseColumns(rows.map((row) => row.support));
    const table = compatibilityMatrix(columns, rows, copy.columns.moodle.name);
    return table ? `## ${copy.matrix}\n\n<sub>${copy.matrixNote}</sub>\n\n${table}\n\n` : "";
  }

  #details(rows) {
    if (!rows.length) return "";
    const copy = LISTING_COPY[this.locale];
    return `---\n\n## ${copy.details}\n\n${rows.map((row) => this.#card(row)).join("\n\n")}\n\n`;
  }

  #card(row) {
    const { project: p, repo: r } = row;
    const copy = LISTING_COPY[this.locale];
    const docs = p.docsUrl || (r.homepage && !/moodle\.org|npmjs\.com/i.test(r.homepage) ? r.homepage : null);
    const links = [
      `<a href="${r.html_url}">GitHub</a>`,
      p.moodleUrl && `<a href="${p.moodleUrl}">Moodle.org</a>`,
      p.npm && `<a href="https://www.npmjs.com/package/${p.npm}">npm</a>`,
      docs && `<a href="${docs}">${copy.docs}</a>`,
      `<a href="${r.html_url}/releases">${copy.releases}</a>`,
    ].filter(Boolean).join(" · ");
    const install = p.npm ? `\n\`\`\`bash\nnpm install ${p.npm}\n\`\`\`\n` : "";

    return `### ${escapeXml(row.name)}

<p>${Badges.for(p, r, this.content.theme, { kind: this.kind, support: row.support })}</p>

${row.description ? `${escapeXml(row.description)}\n` : ""}${install}${this.#supported(row)}
<sub>${links}</sub>

<sub><a href="#">↑</a></sub>

---`;
  }

  /** What a plugin supports, from the \`supported\` of the \`version.php\` of each of its lines, every release between the
   *  lowest and the highest listed; and for a package, the lines whose branches still exist. Nothing here is typed by
   *  hand, so nothing can outlive the truth. */
  #supported(row) {
    const scheme = this.group.supportedBranches;
    if (!scheme) return "";

    const labels = row.support ? row.support.labels : row.lines;
    if (!labels.length) return "";

    return `\n<p><b>${scheme.label[this.locale]}:</b> ${labels.map((v) => `<code>${escapeXml(v)}</code>`).join(" · ")}</p>\n`;
  }

  #soon(pending, c, locale) {
    if (!pending.length) return "";
    return `
## ${c.soonHeading[locale]}

<sub>${c.soonNote[locale]}</sub>

${pending.map((p) => `- **${p.name}** — ${p.desc[locale]}`).join("\n")}
`;
  }
}
