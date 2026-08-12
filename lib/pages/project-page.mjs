/**
 * The full listing for one project group, one page per language: everything a
 * reader who has stopped skimming and started deciding needs — badges, the
 * install line, the long description.
 */

import { escapeXml } from "../text.mjs";
import { STRINGS } from "../strings.mjs";
import { Badges } from "./badges.mjs";
import { supportedVersions } from "../supported-versions.mjs";

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

  render() {
    const locale = this.locale;
    const c = this.content.copy.projects;
    const projects = this.content.projectsIn(this.group.id, this.data.repos);
    const published = projects.filter((p) => this.content.repositoryFor(this.data.repos, p.repo));
    const pending = projects.filter((p) => !this.content.repositoryFor(this.data.repos, p.repo));

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator. Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.projectPage(this.group.id, "en"), this.links.projectPage(this.group.id, "es"))}

# ${this.group.label[locale]}

${this.group.blurb[locale]}

---

${this.#cards(published, locale) || `_${STRINGS[locale].noData}_`}
${this.#soon(pending, c, locale)}
<sub><a href="${locale === "es" ? this.links.profileEs : this.links.profileEn}">← ${c.back[locale]}</a></sub>
`;
  }

  #cards(published, locale) {
    return published.map((p) => {
      const r = this.content.repositoryFor(this.data.repos, p.repo);
      const links = [
        `<a href="${r.html_url}">GitHub</a>`,
        p.moodleUrl && `<a href="${p.moodleUrl}">Moodle.org</a>`,
        p.npm && `<a href="https://www.npmjs.com/package/${p.npm}">npm</a>`,
      ].filter(Boolean).join(" · ");
      const install = p.npm ? `\n\`\`\`bash\nnpm install ${p.npm}\n\`\`\`\n` : "";

      return `<h3><a href="${r.html_url}">${escapeXml(p.name)}</a></h3>

<p>${Badges.for(p, r)}</p>

${escapeXml(p.desc[locale])}
${install}${this.#supported(r, locale)}
<sub>${links}</sub>

---`;
    }).join("\n\n");
  }

  /** Derived from the repository's live branches, so a line that has gone out
   *  of support stops being advertised the moment its branch is deleted —
   *  nothing here to update by hand, and nothing that can outlive the truth. */
  #supported(repo, locale) {
    const scheme = this.group.supportedBranches;
    if (!scheme) return "";

    const versions = supportedVersions(this.group, repo.branchNames);
    if (!versions.length) return "";

    return `\n<p><sub><b>${scheme.label[locale]}:</b> ${versions.map((v) => `<code>${escapeXml(v)}</code>`).join(" · ")}</sub></p>\n`;
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
