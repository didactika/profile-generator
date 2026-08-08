/**
 * The orchestrator: collected data in, a rendered bilingual profile on disk
 * out.
 *
 * It owns the order of operations and nothing else. What each drawing looks
 * like belongs to the drawing, what each page says belongs to the page, and
 * which figures exist belongs to the collector.
 */

import { writeFile } from "node:fs/promises";

import { BRANCH, GUTTER, LOCALES, MODES, PATHS } from "./config.mjs";
import { Theme } from "./theme.mjs";
import { STRINGS } from "./strings.mjs";
import { AssetDirectory, OutputDirectory } from "./output-directory.mjs";
import { Links } from "./pages/links.mjs";
import { ReadmePage } from "./pages/readme.mjs";
import { ProjectPage } from "./pages/project-page.mjs";
import { Tab } from "./drawings/tab.mjs";
import { KpiStrip } from "./drawings/kpi-strip.mjs";
import { BarChart } from "./drawings/bar-chart.mjs";
import { ActivityChart } from "./drawings/activity-chart.mjs";

export class ProfileGenerator {
  constructor({ content, data, log, paths = PATHS }) {
    this.content = content;
    this.data = data;
    this.log = log;
    this.paths = paths;
    this.stamp = new Date().toISOString().slice(0, 10);
    this.links = new Links(content.login, BRANCH);
    this.assets = new AssetDirectory(paths.assets, log);
    this.projects = new OutputDirectory(paths.projects, log);
  }

  async run() {
    await this.#drawAssets();
    await this.#renderPages();
    await this.assets.prune();
    await this.projects.prune();
    this.#summarise();
  }

  async #drawAssets() {
    this.log.step("Rendering assets …");
    for (const mode of MODES) {
      const theme = new Theme(mode);
      await this.#drawTabs(theme, mode);
      for (const locale of LOCALES) {
        await this.#drawCharts(theme, mode, locale);
      }
    }
  }

  /** Four tab states per mode: each language's own icon, active or not. */
  async #drawTabs(theme, mode) {
    for (const lang of LOCALES) {
      for (const active of [true, false]) {
        const drawing = new Tab(theme, lang.toUpperCase(), active);
        await this.assets.write(`tab-${lang}-${active ? "on" : "off"}-${mode}.svg`, drawing.render());
      }
    }
  }

  async #drawCharts(theme, mode, locale) {
    const strings = STRINGS[locale];
    const m = this.content.copy.metrics;
    const d = this.data;
    const days = this.#weekdayItems(locale);

    // Both tiles in a grid row are rendered at a shared height so they line up.
    const rowA = Math.max(d.languages.length, d.licenses.length);
    const rowB = Math.max(days.length, d.perRepo.length);
    // Left-column tiles pad on the right, right-column tiles pad on the left,
    // so the whole gutter lands between them and the outer edges stay flush.
    const left = { padRight: GUTTER }, right = { padLeft: GUTTER };

    await this.assets.writeDrawing("stats", locale, mode, new KpiStrip(theme, this.#tiles(strings)));
    await this.assets.writeDrawing("languages", locale, mode,
      new BarChart(theme, d.languages, strings, { ...left, title: m.languages[locale], rows: rowA }));
    await this.assets.writeDrawing("licenses", locale, mode,
      new BarChart(theme, d.licenses, strings, { ...right, unit: "count", title: m.licenses[locale], rows: rowA }));
    await this.assets.writeDrawing("weekday", locale, mode,
      new BarChart(theme, days, strings, { ...left, unit: "count", title: m.weekday[locale], rows: rowB }));
    // Repository names are long; give the label column extra room before clipping.
    await this.assets.writeDrawing("perrepo", locale, mode,
      new BarChart(theme, d.perRepo, strings, { ...right, unit: "count", title: m.perRepo[locale], rows: rowB, labelPct: 0.46 }));
    await this.assets.writeDrawing("activity", locale, mode,
      new ActivityChart(theme, d.timeline, locale, strings, m.activity[locale]));
  }

  #tiles(strings) {
    const d = this.data;
    return [
      [d.repos.length, strings.repos],
      [d.contributors.length, strings.contributors],
      [d.commits12mo, strings.commits],
      [d.stars, strings.stars],
      [d.releases, strings.releases],
    ];
  }

  /** GitHub returns weekday buckets Sunday-first; present them Monday-first,
   *  with each day named in the page's own language. */
  #weekdayItems(locale) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-07 was a Sunday, so +d lands on weekday d.
    return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
      name: fmt.format(new Date(Date.UTC(2024, 0, 7 + d))).replace(".", ""),
      value: this.data.weekdays[d] || 0,
    }));
  }

  async #renderPages() {
    this.log.step("Rendering pages …");
    for (const locale of LOCALES) {
      const shared = { content: this.content, data: this.data, links: this.links, locale, stamp: this.stamp };

      const readme = new ReadmePage(shared);
      await writeFile(this.paths.readme(locale), readme.render(), "utf8");

      for (const group of this.content.groups) {
        const page = new ProjectPage({ ...shared, group });
        await this.projects.write(page.filename, page.render());
      }
    }
  }

  #summarise() {
    const d = this.data;
    this.log.step(`\nDone. ${d.repos.length} repos · ${d.contributors.length} contributors · ${d.commits12mo} commits/12mo · ${d.stars} stars · ${d.releases} releases`);
    if (this.log.warnings.length) {
      this.log.step(`${this.log.warnings.length} warning(s) above.`);
    }
  }
}
