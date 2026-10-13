/**
 * The full listing for one project group, one page per language, built so a reader can find a project three ways:
 * scanning an index with one line for each, reading across a compatibility matrix for their own Moodle, or going down
 * to the detail card of one — badges, the install line, the description and where its supported versions are listed.
 *
 * What is published where people look for it (a plugin in the Moodle plugins directory, a package on npm) is listed
 * first. What is not has a section of its own after it, with the same three views, because it can still be used from
 * its repository.
 */

import { escapeXml } from "../text.mjs";
import { STRINGS } from "../strings.mjs";
import { Badges } from "./badges.mjs";
import { supportedVersions } from "../supported-versions.mjs";
import { moodleLabel, moodleSupport, pluginComponent, releaseColumns } from "../moodle-plugin.mjs";
import { groupKind, isPublished } from "../publication.mjs";
import { LISTING_COPY, anchorFor, compatibilityMatrix, indexTable } from "./listing.mjs";

export class ProjectPage {
  /** @param view "published" for the projects people can find in the directory or on npm, "unpublished" for the rest */
  constructor({ content, data, links, group, locale, stamp, view = "published" }) {
    this.view = view;
    this.content = content;
    this.data = data;
    this.links = links;
    this.group = group;
    this.locale = locale;
    this.stamp = stamp;
  }

  get filename() {
    return `${this.group.id}${this.view === "unpublished" ? "-unpublished" : ""}${this.locale === "es" ? ".es" : ""}.md`;
  }

  /** A group whose versions are Moodle releases is a plugin listing; any other is a list of packages. */
  get kind() {
    return groupKind(this.group);
  }

  /** The unpublished page exists only when something is unpublished. */
  get hasContent() {
    return this.view === "published" || this.#rows().some((row) => !row.published);
  }

  #rows() {
    const projects = this.content.projectsIn(this.group.id, this.data.repos);
    // By the name that is shown, so the index, the matrix and the details agree on the order a reader scans them in.
    return projects.filter((p) => this.content.repositoryFor(this.data.repos, p.repo)).map((p) => this.#row(p))
      .sort((a, b) => a.name.replace(/^@/, "").localeCompare(b.name.replace(/^@/, "")));
  }

  render() {
    const locale = this.locale;
    const c = this.content.copy.projects;
    const projects = this.content.projectsIn(this.group.id, this.data.repos);
    const showPending = this.content.section("projects").showPending !== false;
    const pending = showPending
      ? projects.filter((p) => !this.content.repositoryFor(this.data.repos, p.repo))
      : [];
    const rows = this.#rows();
    const published = rows.filter((row) => row.published);
    const unpublished = rows.filter((row) => !row.published);
    const copy = LISTING_COPY[locale];
    const unpublishedView = this.view === "unpublished";
    const group = this.group;
    const heading = unpublishedView ? `${group.label[locale]} · ${copy.unpublished[this.kind]}` : group.label[locale];
    const intro = unpublishedView ? copy.unpublishedNote[this.kind] : group.blurb[locale];
    const body = unpublishedView
      ? `${this.#overview(unpublished, [])}${this.#views(unpublished)}`
      : `${this.#overview(published, unpublished)}${published.length ? this.#views(published) : `_${STRINGS[locale].noData}_\n\n`}${this.#soon(pending, c, locale)}`;
    const back = unpublishedView
      ? `<a href="${this.links.projectPage(group.id, locale)}">← ${group.label[locale]}</a>`
      : `<a href="${locale === "es" ? this.links.profileEs : this.links.profileEn}">← ${c.back[locale]}</a>`;

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator. Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.projectPage(group.id, "en", this.view), this.links.projectPage(group.id, "es", this.view))}

# ${heading}

${intro}

${body}<sub>${back}</sub>
`;
  }

  /** Everything the index, the matrix and the card of one project are made from. */
  #row(project) {
    const repo = this.content.repositoryFor(this.data.repos, project.repo);
    const support = this.kind === "moodle" ? moodleSupport(repo.moodleLines) : null;
    const published = isPublished(this.kind, repo);
    // Only a package that is on npm has an npm page and an install line.
    const npm = published ? project.npm : undefined;
    const npmVersion = repo.packages?.npm?.version;
    const latest = repo.latestRelease
      || (npmVersion && npm ? { tag: `v${npmVersion}`, url: `https://www.npmjs.com/package/${npm}` } : null);

    // A plugin is known by its component (local_demo), which its version.php states, rather than by the name of its
    // repository (moodle-local_demo), so every plugin is written the way Moodle writes it.
    const component = this.kind === "moodle" ? pluginComponent(repo) : null;
    const name = component || project.name;
    const description = project.desc[this.locale];

    return {
      project,
      repo,
      name,
      anchor: anchorFor(name),
      published,
      npm,
      moodleUrl: published ? repo.moodleDirectory?.url || project.moodleUrl : undefined,
      // The PHP the README of the plugin states, which is the plugin's to maintain; no badge there, none here.
      php: repo.phpBadge || null,
      // A repository with no description of its own is described by its name, which says nothing, so it says nothing.
      description: [project.name, repo.name, name].includes(description) ? "" : description,
      support,
      latest,
      lines: supportedVersions(this.group, repo.branchNames),
      install: npm ? `npm install ${npm}` : null,
    };
  }

  /** How many projects there are, how many of them are not published and, for plugins, how far the Moodle versions
   *  they cover reach. */
  #overview(published, unpublished) {
    const all = [...published, ...unpublished];
    if (!all.length) return "";
    const copy = LISTING_COPY[this.locale];
    const [one, many] = copy.nouns[this.kind];
    const parts = [`<b>${all.length} ${all.length === 1 ? one : many}</b>`];
    const columns = this.kind === "moodle" ? releaseColumns(all.map((row) => row.support)) : [];
    if (columns.length) {
      const first = columns[0];
      const last = columns[columns.length - 1];
      const label = (code) => `<code>${moodleLabel(code)}</code>`;
      parts.push(`Moodle ${first === last ? label(first) : `${label(first)} – ${label(last)}`}`);
    }
    if (unpublished.length) {
      parts.push(`<a href="${this.links.projectPage(this.group.id, this.locale, "unpublished")}"><b>${unpublished.length}</b> ${copy.unpublishedCount}</a>`);
    }
    return `<p>${parts.join(" · ")}</p>\n\n---\n\n`;
  }

  /** The index, the matrix and the cards of a set of projects. */
  #views(rows) {
    if (!rows.length) return "";
    const copy = LISTING_COPY[this.locale];
    return `## ${copy.find[this.kind]}\n\n${indexTable(this.kind, rows, this.locale)}\n\n${this.#matrix(rows, "##")}${this.#details(rows)}`;
  }

  /** The matrix as a heading of the page, or under a bold caption where the page already has a heading above it. */
  #matrix(rows, style) {
    if (this.kind !== "moodle") return "";
    const copy = LISTING_COPY[this.locale];
    const columns = releaseColumns(rows.map((row) => row.support));
    const table = compatibilityMatrix(columns, rows, copy.columns.moodle.name);
    if (!table) return "";
    const caption = style === "bold" ? `<p><b>${copy.matrix}</b></p>` : `${style} ${copy.matrix}`;
    return `${caption}\n\n<sub>${copy.matrixNote}</sub>\n\n${table}\n\n`;
  }

  #details(rows) {
    const copy = LISTING_COPY[this.locale];
    return `---\n\n## ${copy.details}\n\n${rows.map((row) => this.#card(row)).join("\n\n")}\n\n`;
  }

  #card(row) {
    const { project: p, repo: r } = row;
    const copy = LISTING_COPY[this.locale];
    const docs = p.docsUrl || (r.homepage && !/moodle\.org|npmjs\.com/i.test(r.homepage) ? r.homepage : null);
    const links = [
      `<a href="${r.html_url}">GitHub</a>`,
      row.moodleUrl && `<a href="${row.moodleUrl}">Moodle.org</a>`,
      row.npm && `<a href="https://www.npmjs.com/package/${row.npm}">npm</a>`,
      docs && `<a href="${docs}">${copy.docs}</a>`,
      `<a href="${r.html_url}/releases">${copy.releases}</a>`,
    ].filter(Boolean).join(" · ");
    const install = row.npm ? `\n\`\`\`bash\nnpm install ${row.npm}\n\`\`\`\n` : "";
    const badges = Badges.for({ ...p, npm: row.npm }, r, this.content.theme, {
      kind: this.kind,
      support: row.support,
      php: row.php,
    });

    return `### ${escapeXml(row.name)}

<p>${badges}</p>

${row.description ? `${escapeXml(row.description)}\n` : ""}${install}${this.#supported(row)}
<sub>${links}</sub>

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
