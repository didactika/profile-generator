/**
 * The parts of a project listing that are tables: the index a reader scans to find a project, and the matrix that
 * answers "what runs on my Moodle". They are plain functions of the rows, so what they print can be tested without a
 * page around it.
 *
 * A GitHub README cannot run JavaScript or CSS, so findability is built from what markdown has: a table that says the
 * essentials of every project in one line each, anchors to jump to the detail of one, and a matrix to read across.
 */

import { escapeXml } from "../text.mjs";
import { moodleLabel } from "../moodle-plugin.mjs";

/** The words the listing adds around what content.json says, in each language. */
export const LISTING_COPY = {
  en: {
    nouns: { moodle: ["plugin", "plugins"], npm: ["package", "packages"] },
    find: { moodle: "Find a plugin", npm: "Find a package" },
    columns: {
      moodle: { name: "Plugin", what: "What it does", range: "Moodle", php: "PHP", latest: "Latest" },
      npm: { name: "Package", what: "What it does", latest: "Latest", lines: "Maintained", install: "Install" },
    },
    matrix: "What runs on my Moodle?",
    matrixNote: "A tick means that Moodle release is inside the range the plugin declares. Every release between the lowest and the highest is listed.",
    details: "Details",
    releases: "Releases",
    docs: "Docs",
    none: "—",
  },
  es: {
    nouns: { moodle: ["plugin", "plugins"], npm: ["paquete", "paquetes"] },
    find: { moodle: "Encuentra un plugin", npm: "Encuentra un paquete" },
    columns: {
      moodle: { name: "Plugin", what: "Qué hace", range: "Moodle", php: "PHP", latest: "Última" },
      npm: { name: "Paquete", what: "Qué hace", latest: "Última", lines: "Mantenidas", install: "Instalar" },
    },
    matrix: "¿Qué funciona en mi Moodle?",
    matrixNote: "Una marca indica que esa versión de Moodle está dentro del rango que declara el plugin. Se listan todas las versiones entre la mínima y la máxima.",
    details: "Detalle",
    releases: "Versiones",
    docs: "Documentación",
    none: "—",
  },
};

/** The anchor GitHub gives to a heading: lower case, punctuation gone, spaces as hyphens. */
export function anchorFor(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().replace(/ /g, "-");
}

/** The first sentence of a description, cut at a word when it is still long, for a cell that has to stay on one line. */
export function shortDescription(text, limit = 110) {
  const first = String(text || "").trim().split(/(?<=[.!?])\s+/)[0] || "";
  const sentence = first.replace(/[.]$/, "");
  if (sentence.length <= limit) return sentence;
  const cut = sentence.slice(0, limit).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

/** Text that is safe inside a markdown table cell: no HTML, no pipes, no line breaks. */
const cell = (text) => escapeXml(text).replace(/\|/g, "&#124;").replace(/\s*\n\s*/g, " ");

const header = (labels, alignments) => `| ${labels.join(" | ")} |\n|${alignments.join("|")}|`;

/** The range of Moodle releases a plugin supports, as one short text: "4.0 – 5.3", or "5.3" when there is one. */
export function rangeText(support) {
  if (!support) return null;
  return support.first === support.last
    ? moodleLabel(support.first)
    : `${moodleLabel(support.first)} – ${moodleLabel(support.last)}`;
}

/**
 * One row per project, with the facts a reader compares, and a link to its details further down the page.
 *
 * @param rows [{name, anchor, description, support, latest: {tag, url}|null, lines: string[], install}]
 */
export function indexTable(kind, rows, locale) {
  const copy = LISTING_COPY[locale];
  const columns = copy.columns[kind];
  const none = copy.none;
  const latest = (row) => (row.latest ? `<a href="${row.latest.url}">${escapeXml(row.latest.tag)}</a>` : none);

  if (kind === "moodle") {
    return [
      header([columns.name, columns.what, columns.range, columns.php, columns.latest], [":--", ":--", ":-:", ":-:", ":-:"]),
      ...rows.map((row) => `| <a href="#${row.anchor}"><b>${cell(row.name)}</b></a> | ${cell(shortDescription(row.description)) || none} | ${
        rangeText(row.support) || none} | ${row.support?.php ? `${row.support.php}+` : none} | ${latest(row)} |`),
    ].join("\n");
  }

  return [
    header([columns.name, columns.what, columns.latest, columns.lines, columns.install], [":--", ":--", ":-:", ":-:", ":--"]),
    ...rows.map((row) => `| <a href="#${row.anchor}"><b>${cell(row.name)}</b></a> | ${cell(shortDescription(row.description)) || none} | ${
      latest(row)} | ${row.lines.length ? row.lines.map((line) => `<code>${escapeXml(line)}</code>`).join(" ") : none} | ${
      row.install ? `<code>${escapeXml(row.install)}</code>` : none} |`),
  ].join("\n");
}

/**
 * Plugins down the side and every Moodle release across the top, so a reader looks along their own version.
 *
 * @param columns the Moodle release codes to show, lowest first
 * @param label the heading of the first column
 * @param rows [{name, anchor, support}]
 */
export function compatibilityMatrix(columns, rows, label = "") {
  if (!columns.length || !rows.length) return "";
  return [
    header([label, ...columns.map(moodleLabel)], [":--", ...columns.map(() => ":-:")]),
    ...rows.map((row) => `| <a href="#${row.anchor}">${cell(row.name)}</a> | ${columns.map((code) =>
      (row.support?.codes.includes(code) ? "✅" : "·")).join(" | ")} |`),
  ].join("\n");
}
