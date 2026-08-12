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

    const sections = [
      this.content.sectionEnabled("about") && this.#about(c, locale),
      this.content.sectionEnabled("projects") && this.#projects(c, locale),
      this.content.sectionEnabled("metrics") && this.#metrics(c, locale),
      this.content.sectionEnabled("contributors") && this.#contributorsSection(c, locale),
      this.content.sectionEnabled("contributing") && this.#contributing(c, locale),
      this.content.sectionEnabled("founders") && this.#foundersSection(c, locale),
      this.content.sectionEnabled("memberOrganizations") && this.#memberOrganizationsSection(c, locale),
    ].filter(Boolean).join("\n\n");

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator, on a schedule. Edit the JSON, not this.
  Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.profileEn, this.links.profileEs)}

<h1 align="center">${escapeXml(org.name)}${this.content.sectionEnabled("parent") ? this.#parent(locale) : ""}</h1>

<p align="center"><strong>${escapeXml(org.tagline[locale])}</strong></p>

<p align="center">
  ${org.website ? `<a href="${org.website}">${org.website.replace("https://", "")}</a> ·\n  ` : ""}<a href="${this.links.profileEn}">GitHub</a> ·
  <a href="${otherUrl}">${other.toUpperCase()}</a>
</p>

${this.content.sectionEnabled("metrics") ? this.links.picture(`stats-${locale}`, "Organisation statistics") : ""}

${sections}

---

${this.#footer(org, c)}
`;
  }

  #about(c, locale) {
    return `## ${c.about.heading[locale]}\n\n${c.about.body[locale].join("\n\n")}\n\n> ${c.about.quote[locale]}`;
  }

  #projects(c, locale) {
    return `## ${c.projects.heading[locale]}\n\n${this.#projectIndex(locale)}`;
  }

  #metrics(c, locale) {
    const grid = this.links.chartGrid(locale, [
      [{ base: "languages", alt: c.metrics.languages[locale] },
       { base: "licenses", alt: c.metrics.licenses[locale] }],
      [{ base: "weekday", alt: c.metrics.weekday[locale] },
       { base: "perrepo", alt: c.metrics.perRepo[locale] }],
    ]);
    return `## ${c.metrics.heading[locale]}\n\n${grid}\n\n${this.links.picture(`activity-${locale}`, c.metrics.activity[locale])}`;
  }

  #contributorsSection(c, locale) {
    return `## ${c.contributors.heading[locale]}\n\n${this.#contributors()}`;
  }

  #contributing(c, locale) {
    const steps = c.contributing.steps[locale].map((step, index) => `${index + 1}. ${step}`).join("\n");
    return `## ${c.contributing.heading[locale]}\n\n${steps}\n${this.#contributingDocs(c.contributing, locale)}`;
  }

  #foundersSection(c, locale) {
    return `## ${c.founders.heading[locale]}\n\n${c.founders.intro[locale]}\n\n${this.#founders(locale)}`;
  }

  #memberOrganizationsSection(c, locale) {
    const cards = this.#memberOrganizations(locale);
    if (!cards || !c.memberOrganizations?.heading?.[locale]) return "";
    return `## ${c.memberOrganizations.heading[locale]}\n\n${cards}`;
  }

  /** Compact category cards on the profile — two columns when there is room,
   *  linking out to each detail page. A final unpaired group spans the row so
   *  it never looks stranded on the left. */
  #projectIndex(locale) {
    const c = this.content.copy.projects;

    const showPending = this.content.section("projects").showPending !== false;
    const groups = this.content.groups;
    const rows = [];
    for (let index = 0; index < groups.length; index += 2) {
      const row = groups.slice(index, index + 2);
      const width = row.length === 1 ? "100%" : "50%";
      const cells = row.map((g) => {
        const projects = this.content.projectsIn(g.id, this.data.repos);
        const published = projects.filter((p) => this.content.repositoryFor(this.data.repos, p.repo));
        const pending = projects.filter((p) => !this.content.repositoryFor(this.data.repos, p.repo));
        const href = this.links.projectPage(g.id, locale);
        const counts = [`<b>${published.length}</b> ${c.count[locale]}`];
        if (showPending && pending.length) counts.push(`<b>${pending.length}</b> ${c.soonHeading[locale].toLowerCase()}`);
        return `<td width="${width}" valign="top" align="center">
<h3><a href="${href}">${g.label[locale]}</a></h3>
<p><sub>${g.blurb[locale]}</sub></p>
<p><sub>${counts.join(" · ")}</sub></p>
<p><a href="${href}"><b>${c.viewAll[locale]} →</b></a></p>
</td>`;
      }).join("\n");
      rows.push(`<tr>\n${cells}\n</tr>`);
    }

    return `<table>\n${rows.join("\n")}\n</table>`;
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
    const defaultRole = this.content.copy.founders.role?.[locale];
    const width = 100 / Math.max(this.content.founders.length, 1);
    const cells = this.content.founders.map((f) => `<td width="${width}%" valign="top">
<b><a href="${f.linkedin}">${escapeXml(f.name)}</a></b> · <a href="https://github.com/${f.github}"><code>@${escapeXml(f.github)}</code></a><br>
${this.#founderRoles(f, defaultRole, locale)}
<p><sub>${escapeXml(f.bio[locale])}</sub></p>
</td>`).join("\n");
    return `<table>\n<tr>\n${cells}\n</tr>\n</table>`;
  }

  #founderRoles(founder, defaultRole, locale) {
    const roles = founder.roles || (defaultRole ? [{ label: { [locale]: defaultRole } }] : []);
    if (!roles.length) return "";
    const lines = roles.map((role) => {
      const label = role.label?.[locale] || role.label || "";
      const name = role.url ? `<a href="${role.url}">${escapeXml(role.name)}</a>` : escapeXml(role.name || "");
      return `<b>${escapeXml(label)}</b>${name ? ` · ${name}` : ""}`;
    });
    return `<sub>${lines.join("<br>")}</sub>`;
  }

  #parent(locale) {
    const parent = this.content.parent;
    if (!parent) return "";
    return `<br><sub>${escapeXml(parent.label[locale])} · <a href="${parent.url}">${escapeXml(parent.name)}</a></sub>`;
  }

  #memberOrganizations(locale) {
    const organizations = this.content.memberOrganizations.map((member) => {
      const profile = (this.data.organizations || []).find((org) =>
        org.login.toLowerCase() === member.login.toLowerCase()
      );
      return profile && { ...profile, ...member, name: member.name || profile.name };
    }).filter(Boolean);
    if (!organizations.length) return "";

    const rows = [];
    for (let index = 0; index < organizations.length; index += 2) {
      const row = organizations.slice(index, index + 2);
      const width = row.length === 1 ? "100%" : "50%";
      const cells = row.map((org) => `<td width="${width}" valign="top" align="center">
<a href="${org.url}"><img src="${org.avatar}&s=160" width="72" height="72" alt="${escapeXml(org.name)} logo"></a><br>
<h3><a href="${org.url}">${escapeXml(org.name)}</a></h3>
${org.description ? `<p><sub>${escapeXml(org.description)}</sub></p>` : ""}
</td>`).join("\n");
      rows.push(`<tr>\n${cells}\n</tr>`);
    }
    return `<table>\n${rows.join("\n")}\n</table>`;
  }

  #footer(org, c) {
    const locale = this.locale;
    return `<p align="center">
  <em>${c.footer[locale]}</em><br>
  ${org.website ? `<a href="${org.website}">${org.website.replace("https://", "")}</a><br>\n  ` : ""}<sub>Updated ${this.stamp} · generated by <a href="${GENERATOR_URL}">profile-generator</a></sub>
</p>`;
  }
}
