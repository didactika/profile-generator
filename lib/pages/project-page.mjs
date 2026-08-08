/**
 * The full listing for one project group, one page per language: everything a
 * reader who has stopped skimming and started deciding needs — badges, the
 * install line, the long description.
 */

import { escapeXml } from "../text.mjs";
import { STRINGS } from "../strings.mjs";
import { Badges } from "./badges.mjs";

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
    const byName = new Map(this.data.repos.map((r) => [r.name, r]));
    const projects = this.content.projectsIn(this.group.id);
    const published = projects.filter((p) => byName.has(p.repo));
    const pending = projects.filter((p) => !byName.has(p.repo));

    return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  profile-generator. Last generated: ${this.stamp}
-->

${this.links.tabBar(locale, this.links.projectPage(this.group.id, "en"), this.links.projectPage(this.group.id, "es"))}

# ${this.group.label[locale]}

${this.group.blurb[locale]}

---

${this.#cards(published, byName, locale) || `_${STRINGS[locale].noData}_`}
${this.#soon(pending, c, locale)}
<sub><a href="${locale === "es" ? this.links.profileEs : this.links.profileEn}">← ${c.back[locale]}</a></sub>
`;
  }

  #cards(published, byName, locale) {
    return published.map((p) => {
      const r = byName.get(p.repo);
      const links = [
        `<a href="${r.html_url}">GitHub</a>`,
        p.moodleUrl && `<a href="${p.moodleUrl}">Moodle.org</a>`,
        p.npm && `<a href="https://www.npmjs.com/package/${p.npm}">npm</a>`,
      ].filter(Boolean).join(" · ");
      const install = p.npm ? `\n\`\`\`bash\nnpm install ${p.npm}\n\`\`\`\n` : "";

      return `<h3><a href="${r.html_url}">${escapeXml(p.name)}</a></h3>

<p>${Badges.for(this.content.login, p, r)}</p>

${escapeXml(p.desc[locale])}
${install}
<sub>${links}</sub>

---`;
    }).join("\n\n");
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
