/**
 * Every URL the generated markdown emits, and the picture element that carries
 * a light and a dark drawing behind one <img>.
 *
 * The profile lives in the special `.github` repository, at
 * github.com/<org> for English and github.com/<org>/.github/blob/<branch>/…
 * for everything reached by a link rather than shown at the root — Spanish,
 * and every project detail page.
 */

import { escapeXml } from "../text.mjs";

export class Links {
  constructor(login, branch) {
    this.login = login;
    this.branch = branch;
  }

  /** Raw asset URLs, absolute and branch-pinned: the profile is read from
   *  github.com/<org>, where a relative path resolves to nothing useful. */
  get assets() {
    return `https://raw.githubusercontent.com/${this.login}/.github/${this.branch}/profile/assets`;
  }

  blob(path) {
    return `https://github.com/${this.login}/.github/blob/${this.branch}/profile/${path}`;
  }

  get profileEn() {
    return `https://github.com/${this.login}`;
  }

  get profileEs() {
    return this.blob("README.es.md");
  }

  /** The detail page for one project group, in one language. */
  projectPage(groupId, locale) {
    return this.blob(`projects/${groupId}${locale === "es" ? ".es" : ""}.md`);
  }

  picture(base, alt, width = "100%") {
    return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${this.assets}/${base}-dark.svg">
  <img alt="${escapeXml(alt)}" src="${this.assets}/${base}-light.svg" width="${width}">
</picture>`;
  }

  /** Two half-width charts per row. Plain images rather than a table: GitHub
   *  draws a border around every table, which would box each chart in a frame.
   *
   *  Left-aligned, not centred: centring splits the leftover width into two side
   *  margins, which pushes the tiles' titles out of line with the full-width
   *  chart below them by an amount that changes with viewport width. */
  chartGrid(locale, pairs) {
    return pairs.map(([a, b]) => `<p>
${this.picture(`${a.base}-${locale}`, a.alt, "48%")}
${this.picture(`${b.base}-${locale}`, b.alt, "48%")}
</p>`).join("\n\n");
  }

  /** One line, no whitespace between the anchors, so the two flags butt
   *  together into a single bar instead of being spaced apart.
   *
   *  @param enHref/esHref where each flag points — the sibling of *this*
   *  page in the other language, not always the org README. A project page's
   *  switcher has to stay on that project; only the README's switches between
   *  README.md and README.es.md. */
  tabBar(locale, enHref, esHref) {
    const img = (name, alt) =>
      `<picture><source media="(prefers-color-scheme: dark)" srcset="${this.assets}/${name}-dark.svg"><img alt="${alt}" src="${this.assets}/${name}-light.svg" height="32"></picture>`;
    const en = locale === "en" ? "tab-en-on" : "tab-en-off";
    const es = locale === "es" ? "tab-es-on" : "tab-es-off";
    return `<a href="${enHref}">${img(en, "EN")}</a><a href="${esHref}">${img(es, "ES")}</a>`;
  }
}
