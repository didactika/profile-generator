/**
 * The organisation profile page itself: github.com/<org> renders the English
 * version, and the language switcher at the top links to the Spanish one.
 */

import { escapeXml } from "../text.mjs";
import { GENERATOR_URL } from "../config.mjs";
import { STRINGS } from "../strings.mjs";

export class ReadmePage {
  constructor({ content, data, links, locale, stamp }) {
    this.content = content;
    this.data = data;
    this.links = links;
    this.locale = locale;
    this.stamp = stamp;
  }

  get filename() {
    return this.locale === "es" ? "README.es.md" : "README.md";
  }

  render() {
    const org = this.content.org;
    const c = this.content.copy;
    const locale = this.locale;
    const other = locale === "en" ? "es" : "en";
    const otherUrl = other === "es" ? this.links.profileEs : this.links.profileEn;

    const grid = this.links.chartGrid(locale, [
      [{ base: "languages", alt: c.metrics.languages[locale] },
       { base: "licenses", alt: c.metrics.licenses[locale] }],
      [{ base: "weekday", alt: c.metrics.weekday[locale] },
       { base: "perrepo", alt: c.metrics.perRepo[locale] }],
    ]);

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator, on a schedule. Edit the JSON, not this.
  Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.profileEn, this.links.profileEs)}

<h1 align="center">${escapeXml(org.name)}</h1>

<p align="center"><strong>${escapeXml(org.tagline[locale])}</strong></p>

${this.#parentOrganization(org, locale)}

<p align="center">
  ${org.website ? `<a href="${org.website}">${org.website.replace("https://", "")}</a> ·\n  ` : ""}<a href="${this.links.profileEn}">GitHub</a> ·
  <a href="${otherUrl}">${other.toUpperCase()}</a>
</p>

${this.links.picture(`stats-${locale}`, "Organisation statistics")}

## ${c.about.heading[locale]}

${c.about.body[locale].join("\n\n")}

> ${c.about.quote[locale]}

## ${c.projects.heading[locale]}

${this.#projectIndex(locale)}

## ${c.metrics.heading[locale]}

${grid}

${this.links.picture(`activity-${locale}`, c.metrics.activity[locale])}

## ${c.contributors.heading[locale]}

${this.#contributors()}

## ${c.contributing.heading[locale]}

${c.contributing.steps[locale].map((s, i) => `${i + 1}. ${s}`).join("\n")}
${this.#contributingDocs(c.contributing, locale)}

## ${c.founders.heading[locale]}

${c.founders.intro[locale]}

${this.#founders(locale)}

---

${this.#footer(org, c)}
`;
  }

  /** Compact category cards on the profile — one row per project group,
   *  linking out to its own page. Keeps the profile short; the detail lives
   *  on the page. */
  #projectIndex(locale) {
    const c = this.content.copy.projects;

    const cells = this.content.groups.map((g) => {
      const projects = this.content.projectsIn(g.id);
      const published = projects.filter((p) => this.content.repositoryFor(this.data.repos, p.repo));
      const pending = projects.filter((p) => !this.content.repositoryFor(this.data.repos, p.repo));
      const href = this.links.projectPage(g.id, locale);
      const counts = [`<b>${published.length}</b> ${c.count[locale]}`];
      if (pending.length) counts.push(`<b>${pending.length}</b> ${c.soonHeading[locale].toLowerCase()}`);
      return `<td width="50%" valign="top">
<h3><a href="${href}">${g.label[locale]}</a></h3>
<p><sub>${g.blurb[locale]}</sub></p>
<p><sub>${counts.join(" · ")}</sub></p>
<p><a href="${href}"><b>${c.viewAll[locale]} →</b></a></p>
</td>`;
    }).join("\n");

    return `<table>\n<tr>\n${cells}\n</tr>\n</table>`;
  }

  /** The org-wide documents a contributor actually needs, linked rather than
   *  summarised. They live in the .github repository and every repository
   *  without its own copy inherits them, so the profile is the one place a
   *  reader is guaranteed to find them from. Optional: a content.json with no
   *  `docs` block renders nothing rather than an empty heading. */
  #contributingDocs(contributing, locale) {
    if (!contributing.docs?.length) return "";
    const links = contributing.docs
      .map((d) => `<a href="${d.url}">${escapeXml(d.label[locale])}</a>`)
      .join(" · ");
    const intro = contributing.docsIntro?.[locale];
    return `\n${intro ? `${intro}\n\n` : ""}<sub>${links}</sub>\n`;
  }

  #contributors() {
    if (!this.data.contributors.length) return `_${STRINGS[this.locale].noData}_`;
    // Separated with non-breaking spaces: GitHub strips style attributes, so
    // this is the only horizontal spacing that survives sanitisation.
    const avatars = this.data.contributors.map((c) =>
      `<a href="${c.url}" title="${escapeXml(c.login)} · ${c.contributions} commits"><img src="${c.avatar}&s=96" width="64" height="64" alt="${escapeXml(c.login)}"></a>`
    ).join("&nbsp;&nbsp;&nbsp;&nbsp;");
    return `<p>${avatars}</p>`;
  }

  #founders(locale) {
    const role = this.content.copy.founders.role[locale];
    const width = 100 / Math.max(this.content.founders.length, 1);
    const cells = this.content.founders.map((f) => `<td width="${width}%" valign="top">
<b><a href="${f.linkedin}">${escapeXml(f.name)}</a></b> · <a href="https://github.com/${f.github}"><code>@${escapeXml(f.github)}</code></a><br>
<sub>${role}</sub>
<p><sub>${escapeXml(f.bio[locale])}</sub></p>
</td>`).join("\n");
    return `<table>\n<tr>\n${cells}\n</tr>\n</table>`;
  }

  #parentOrganization(org, locale) {
    if (!org.parent) return "";
    return `<p align="center"><sub>${escapeXml(org.parent.label[locale])} <strong><a href="${org.parent.url}">${escapeXml(org.parent.name)}</a></strong></sub></p>`;
  }

  #footer(org, c) {
    const locale = this.locale;
    return `<p align="center">
  <em>${c.footer[locale]}</em><br>
  ${org.website ? `<a href="${org.website}">${org.website.replace("https://", "")}</a><br>\n  ` : ""}<sub>Updated ${this.stamp} · generated by <a href="${GENERATOR_URL}">profile-generator</a></sub>
</p>`;
  }
}
