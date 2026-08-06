#!/usr/bin/env node
/**
 * Renders the Didactika organisation profile.
 *
 * Reads   : profile/data/content.json  (every word, both languages)
 *           the GitHub REST API        (every number)
 * Writes  : profile/README.md          (English — what github.com/didactika shows)
 *           profile/README.es.md       (Spanish)
 *           profile/assets/*.svg       (charts and language tabs, light + dark)
 *
 * Both READMEs are generated end to end — there is no hand-written prose in
 * them, so nothing is ever maintained twice. Edit content.json instead.
 *
 * GitHub profile READMEs cannot run JavaScript and GitHub publishes no official
 * statistics-image endpoint, so "live" has to mean: a scheduled job recomputes
 * these numbers and commits them. That job is .github/workflows/update-profile.yml.
 *
 * No dependencies. Node >= 20 (global fetch).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "profile", "assets");
const LOCALES = ["en", "es"];
const MODES = ["light", "dark"];

/* ── palette ────────────────────────────────────────────────────────────────
 * Every chart is single-hue: bar length and line height carry the values, row
 * labels carry the identities. Nothing is encoded in colour alone, so no
 * categorical ramp is needed and colour-vision separation is not in play.
 *
 * The one mark colour is the Didactika brand teal, stepped per mode and checked
 * against GitHub's real canvases rather than any reference surface:
 *   light  #0d9488 on #ffffff → 3.74:1  (>= 3:1)
 *   dark   #14b8a6 on #0d1117 → 7.60:1  (>= 3:1)
 */
const THEME = {
  light: {
    surface: "#ffffff", primary: "#0b0b0b", secondary: "#52514e", muted: "#898781",
    grid: "#e1e0d9", axis: "#c3c2b7", brand: "#0d9488", brandSoft: "rgba(13,148,136,0.14)",
  },
  dark: {
    surface: "#0d1117", primary: "#ffffff", secondary: "#c3c2b7", muted: "#898781",
    grid: "#21262d", axis: "#383835", brand: "#14b8a6", brandSoft: "rgba(20,184,166,0.18)",
  },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// Half the gutter between two grid tiles, in chart units. Applied only to a
// tile's inner edge, so none of it is wasted as an outer margin and the outer
// edges stay flush with the full-width charts above and below.
//
// It has to be generous: what faces across the gutter is the left tile's value
// column against the right tile's label column — text against text. Anything
// tighter and "79.7%" reads as though it belongs to "MIT".
const GUTTER = 62;

const T = {
  en: { repos: "Repositories", contributors: "Contributors", stars: "Stars",
        commits: "Commits · 12 mo", releases: "Releases", other: "Other",
        noData: "No data yet", language: "Language", share: "Share", bytes: "Bytes" },
  es: { repos: "Repositorios", contributors: "Colaboradores", stars: "Estrellas",
        commits: "Commits · 12 m", releases: "Releases", other: "Otros",
        noData: "Sin datos todavía", language: "Lenguaje", share: "Peso", bytes: "Bytes" },
};

/* ── github api ─────────────────────────────────────────────────────────── */

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const warned = [];
const warn = (m) => { warned.push(m); console.warn(`  ! ${m}`); };

async function api(path, { retries202 = 5 } = {}) {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "didactika-profile-generator",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers });
    // Statistics endpoints answer 202 while GitHub warms the cache.
    if (res.status === 202 && attempt < retries202) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    // Rate limiting is fatal, never "empty". Swallowing it would let a
    // throttled run overwrite good charts with zeros and commit them.
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0" || res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
        const mins = reset ? Math.ceil((reset - Date.now()) / 60000) : "?";
        throw new Error(
          `GitHub API rate limit exhausted (resets in ~${mins} min).\n` +
          (token ? "" : "No GITHUB_TOKEN set — unauthenticated runs get only 60 requests/hour.\n") +
          "Refusing to render: a throttled run would replace real figures with zeros."
        );
      }
      warn(`403 on ${path} (not rate limiting) — treating as empty`);
      return null;
    }
    if ([202, 404].includes(res.status)) {
      warn(`${res.status} on ${path} — treating as empty`);
      return null;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
    return (await res.json()) ?? null;
  }
}

/* ── collection ─────────────────────────────────────────────────────────── */

async function collect(org) {
  console.log(`Fetching ${org} …`);
  const all = (await api(`/orgs/${org}/repos?per_page=100&type=public`)) || [];
  const repos = all.filter((r) => !r.archived && !r.fork && r.name !== ".github");
  console.log(`  ${repos.length} public repos`);

  const languages = new Map(), licenses = new Map();
  const contributors = new Map(), weeks = new Map(), perRepo = new Map();
  const weekdays = [0, 0, 0, 0, 0, 0, 0]; // Sunday-first, as GitHub returns it
  let stars = 0, releases = 0;

  for (const repo of repos) {
    stars += repo.stargazers_count || 0;

    const lic = repo.license?.spdx_id;
    if (lic && lic !== "NOASSERTION") licenses.set(lic, (licenses.get(lic) || 0) + 1);

    for (const [name, bytes] of Object.entries(
      (await api(`/repos/${org}/${repo.name}/languages`)) || {}
    )) {
      languages.set(name, (languages.get(name) || 0) + bytes);
    }

    for (const p of (await api(`/repos/${org}/${repo.name}/contributors?per_page=100`)) || []) {
      if (p.type === "Bot" || /\[bot\]$/.test(p.login)) continue;
      const prev = contributors.get(p.login);
      contributors.set(p.login, {
        login: p.login, avatar: p.avatar_url, url: p.html_url,
        contributions: (prev?.contributions || 0) + (p.contributions || 0),
        repos: (prev?.repos || 0) + 1,
      });
    }

    const activity = await api(`/repos/${org}/${repo.name}/stats/commit_activity`);
    let repoCommits = 0;
    for (const w of Array.isArray(activity) ? activity : []) {
      weeks.set(w.week, (weeks.get(w.week) || 0) + w.total);
      repoCommits += w.total;
      // days[] is Sunday-first; fold it into the same order the labels use.
      (w.days || []).forEach((n, d) => { weekdays[d] += n; });
    }
    if (repoCommits > 0) perRepo.set(repo.name, repoCommits);

    const rels = (await api(`/repos/${org}/${repo.name}/releases?per_page=100`)) || [];
    releases += rels.length;
    repo._latest = rels.find((r) => !r.draft && !r.prerelease)?.tag_name || null;

    console.log(`  · ${repo.name}`);
  }

  const timeline = [...weeks.entries()].sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));

  return {
    org, repos, stars, releases, timeline, weekdays,
    languages: rank(languages, 6),
    licenses: rank(licenses, 6),
    perRepo: rank(perRepo, 6),
    contributors: [...contributors.values()].sort((a, b) => b.contributions - a.contributions),
    commits12mo: timeline.reduce((s, w) => s + w.total, 0),
  };
}

/** Sort a name→value map descending and fold everything past `limit` into "Other". */
function rank(map, limit) {
  const all = [...map.entries()].map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (all.length <= limit) return all;
  return [
    ...all.slice(0, limit - 1),
    { name: "__other__", value: all.slice(limit - 1).reduce((s, x) => s + x.value, 0) },
  ];
}

/* ── svg primitives ─────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmt = (n) => n >= 1000
  ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`.replace(".0k", "k")
  : String(n);

const text = (x, y, s, { size = 12, fill, weight = 400, anchor = "start" } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

const svg = (w, h, body, th) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<rect width="${w}" height="${h}" fill="${th.surface}"/>
${body}
</svg>
`;

/* ── language tabs ──────────────────────────────────────────────────────────
 * GitHub markdown has no tab widget and no JavaScript, so a real tab bar is
 * two linked images: the selected one is underlined in the brand hue, the other
 * is muted and navigates to the sibling README. Drawing them here (rather than
 * pulling badges from a third-party service) keeps the header on the same
 * palette as the charts and free of external requests.
 */
function tab(label, active, mode) {
  const th = THEME[mode];
  const W = 54, H = 32;
  return svg(W, H, `${text(W / 2, 19, label, {
    size: 12, weight: 700,
    fill: active ? th.primary : th.muted,
    anchor: "middle",
  })}
<rect x="0" y="${H - 2}" width="${W}" height="2" fill="${active ? th.brand : th.grid}"/>`, th);
}

/* ── chart: KPI strip ───────────────────────────────────────────────────── */

function kpiStrip(data, locale, mode) {
  const th = THEME[mode], t = T[locale];
  const tiles = [
    [fmt(data.repos.length), t.repos],
    [fmt(data.contributors.length), t.contributors],
    [fmt(data.commits12mo), t.commits],
    [fmt(data.stars), t.stars],
    [fmt(data.releases), t.releases],
  ];
  const W = 860, H = 96, pad = 4, cw = (W - pad * 2) / tiles.length;

  const body = tiles.map(([value, label], i) => {
    const cx = pad + cw * i + cw / 2;
    const divider = i === 0 ? ""
      : `<line x1="${pad + cw * i}" y1="24" x2="${pad + cw * i}" y2="${H - 24}" stroke="${th.grid}" stroke-width="1"/>`;
    return `${divider}
${text(cx, 50, value, { size: 34, weight: 700, fill: th.primary, anchor: "middle" })}
${text(cx, 72, label.toUpperCase(), { size: 10, weight: 600, fill: th.muted, anchor: "middle" })}`;
  }).join("\n");

  return svg(W, H, body, th);
}

/* ── chart: ranked horizontal bars ───────────────────────────────────────
 * Comparing magnitudes, not reading a part-to-whole split, so these are
 * separate bars rather than one stacked bar. That matters with the real data:
 * language shares are heavily skewed (one language near 80%, several under 1%),
 * and inside a stacked bar the small classes collapse into slivers narrower
 * than the segment gap — literally invisible. Separate rows give every class a
 * readable bar and a direct label.
 */
function barRows(items, locale, mode, { unit = "%", title = "", width = 520, labelPct = 0.26, rows = 0, padLeft = 0, padRight = 0 } = {}) {
  const th = THEME[mode], t = T[locale];
  // Proportions scale with the canvas so the same function serves both the
  // half-width grid tiles and any full-width use.
  const W = width, labelW = Math.round(W * labelPct), valueW = Math.round(W * 0.12);
  const rowH = 28, barH = 11, r = 5;
  const top = title ? 34 : 8;
  // `rows` reserves a fixed number of slots so two charts sitting side by side
  // in the grid end up the same height. Without it they are baseline-aligned by
  // the browser and the shorter one visibly sags.
  const slots = Math.max(rows, items.length);
  // Labels are clipped to what actually fits: a long repo name at 11px would
  // otherwise run straight under its own bar.
  const maxChars = Math.max(6, Math.floor((labelW - 8) / 6.1));
  const clip = (s) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s);

  const head = title
    ? text(0, 16, title, { size: 12, weight: 700, fill: th.primary })
    : "";

  if (!items.length) {
    return svg(W + padLeft + padRight, top + 40, `<g transform="translate(${padLeft},0)">${head}
${text(W / 2, top + 20, t.noData, { size: 12, fill: th.muted, anchor: "middle" })}</g>`, th);
  }

  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const trackW = W - labelW - valueW;
  const label = (i) => (i.name === "__other__" ? t.other : i.name);
  const value = (i) => unit === "%" ? `${((i.value / total) * 100).toFixed(1)}%` : String(i.value);

  const body = items.map((item, i) => {
    const y = top + i * rowH, mid = y + barH / 2;
    // Scaled against the largest value, not the total, so a small class still
    // renders as a bar you can see and compare.
    const w = Math.max(2, (item.value / max) * trackW);
    return `${text(0, mid + 4, clip(label(item)), { size: 11, weight: 600, fill: th.primary })}
<rect x="${labelW}" y="${y}" width="${trackW}" height="${barH}" rx="${r}" fill="${th.grid}"/>
<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="${r}" fill="${th.brand}"/>
${text(W, mid + 4, value(item), { size: 11, fill: th.secondary, anchor: "end" })}`;
  }).join("\n");

  // Horizontal breathing room is baked into the canvas rather than added
  // between the images in markdown: the only separator that survives GitHub's
  // sanitiser is a run of &nbsp;, whose width depends on the reader's font.
  // Padding here is measured in the chart's own units and scales with it.
  return svg(W + padLeft + padRight, top + slots * rowH + 6,
    `<g transform="translate(${padLeft},0)">\n${head}\n${body}\n</g>`, th);
}

/* ── chart: weekly commit activity ──────────────────────────────────────── */

function activityChart(timeline, locale, mode, title = "") {
  const th = THEME[mode], t = T[locale];
  const W = 1060, H = title ? 210 : 190;
  const m = { top: title ? 38 : 16, right: 8, bottom: 28, left: 40 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const head = title ? text(0, 16, title, { size: 12, weight: 700, fill: th.primary }) : "";

  if (timeline.length < 2) {
    return svg(W, m.top + 50, `<g>${head}
${text(W / 2, m.top + 24, t.noData, { size: 12, fill: th.muted, anchor: "middle" })}</g>`, th);
  }

  const max = Math.max(...timeline.map((w) => w.total), 1);
  // Even, with headroom, so the midpoint tick is whole and the peak does not
  // touch the top gridline.
  const niceMax = Math.max(2, Math.ceil((max * 1.1) / 2) * 2);
  const X = (i) => m.left + (i / (timeline.length - 1)) * iw;
  const Y = (v) => m.top + ih - (v / niceMax) * ih;

  const grid = [0, niceMax / 2, niceMax].map((v) =>
    `<line x1="${m.left}" y1="${Y(v)}" x2="${W - m.right}" y2="${Y(v)}" stroke="${th.grid}" stroke-width="1"/>
${text(m.left - 8, Y(v) + 4, String(Math.round(v)), { size: 10, fill: th.muted, anchor: "end" })}`
  ).join("\n");

  const line = timeline.map((w, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(w.total).toFixed(1)}`).join("");
  const area = `${line}L${X(timeline.length - 1).toFixed(1)},${Y(0)}L${X(0).toFixed(1)},${Y(0)}Z`;

  // Evenly spaced ticks. Labelling every month change instead drops whichever
  // months fall too close together, which reads as a bug rather than thinning.
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const ticks = 8;
  const xLabels = Array.from({ length: ticks }, (_, k) => {
    const i = Math.round((k / (ticks - 1)) * (timeline.length - 1));
    const anchor = k === 0 ? "start" : k === ticks - 1 ? "end" : "middle";
    return text(X(i), H - 8, monthFmt.format(new Date(timeline[i].week * 1000)).replace(".", ""),
      { size: 10, fill: th.muted, anchor });
  }).join("\n");

  // Flush left, matching the outer edge of the grid tiles below.
  return svg(W, H, `<g>
${head}
${grid}
<path d="${area}" fill="${th.brandSoft}"/>
<path d="${line}" fill="none" stroke="${th.brand}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
<line x1="${m.left}" y1="${Y(0)}" x2="${W - m.right}" y2="${Y(0)}" stroke="${th.axis}" stroke-width="1"/>
${xLabels}
</g>`, th);
}

/** GitHub returns weekday buckets Sunday-first; present them Monday-first. */
function weekdayItems(weekdays, locale) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-07 was a Sunday, so +d lands on weekday d.
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    name: fmt.format(new Date(Date.UTC(2024, 0, 7 + d))).replace(".", ""),
    value: weekdays[d] || 0,
  }));
}

/* ── markdown rendering ─────────────────────────────────────────────────── */

const RAW = (org) => `https://raw.githubusercontent.com/${org}/.github/main/profile/assets`;
const BLOB = (org, p) => `https://github.com/${org}/.github/blob/main/profile/${p}`;
const EN_URL = (org) => `https://github.com/${org}`;
const ES_URL = (org) => BLOB(org, "README.es.md");

const pageFile = (groupId, locale) => `projects/${groupId}${locale === "es" ? ".es" : ""}.md`;

function picture(org, base, alt, width = "100%") {
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${RAW(org)}/${base}-dark.svg">
  <img alt="${esc(alt)}" src="${RAW(org)}/${base}-light.svg" width="${width}">
</picture>`;
}

/** Two half-width charts per row. Plain images rather than a table: GitHub
 *  draws borders around every table, which would box each chart in a frame. */
function chartGrid(org, locale, pairs) {
  // Left-aligned, not centred: centring splits the leftover width into two
  // side margins, which pushes the tiles' titles out of line with the
  // full-width chart below them by a margin that changes with viewport width.
  return pairs.map(([a, b]) =>
    `<p>
${picture(org, `${a.base}-${locale}`, a.alt, "48%")}
${picture(org, `${b.base}-${locale}`, b.alt, "48%")}
</p>`).join("\n\n");
}

function tabBar(org, locale, { enHref, esHref }) {
  const img = (name, alt) =>
    `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW(org)}/${name}-dark.svg"><img alt="${alt}" src="${RAW(org)}/${name}-light.svg" height="32"></picture>`;
  // One line, no whitespace between the anchors, so the two images butt
  // together into a single bar instead of being spaced apart.
  return `<a href="${enHref}">${img(locale === "en" ? "tab-en-on" : "tab-en-off", "EN")}</a><a href="${esHref}">${img(locale === "es" ? "tab-es-on" : "tab-es-off", "ES")}</a>`;
}

/* ── per-repo badges (shields.io) ────────────────────────────────────────
 * The one place a third-party service genuinely earns its keep: shields.io
 * re-reads GitHub and npm on every page load, so release, stars, downloads and
 * last-commit are live without this repo committing anything.
 *
 * Used only for per-repo facts, because that is all it can do. Tested
 * 2026-08-06 against this org: github-readme-stats returned DEPLOYMENT_PAUSED,
 * github-profile-summary-cards 500, star-history 503 and contrib.rocks would
 * not connect — so the organisation-wide aggregates stay self-generated.
 * shields.io's dynamic-JSON badge cannot cover them either: pointed at
 * api.github.com it renders "invalid", since it calls the API unauthenticated.
 */
const SHIELD = "https://img.shields.io";
const STYLE = "style=flat-square&color=0d9488&labelColor=1f2328";

function badges(org, p, r) {
  const img = (url, alt) => `<img alt="${esc(alt)}" src="${url}">`;
  const out = [];
  if (r.language) out.push(img(`${SHIELD}/badge/${encodeURIComponent(r.language)}-1f2328?style=flat-square`, r.language));
  if (p.npm) {
    out.push(img(`${SHIELD}/npm/v/${p.npm}?${STYLE}&label=npm`, "npm version"));
    out.push(img(`${SHIELD}/npm/dm/${p.npm}?${STYLE}&label=downloads`, "npm downloads"));
  } else {
    out.push(img(`${SHIELD}/github/v/release/${org}/${r.name}?${STYLE}&label=release`, "release"));
  }
  out.push(img(`${SHIELD}/github/license/${org}/${r.name}?${STYLE}&label=license`, "license"));
  out.push(img(`${SHIELD}/github/stars/${org}/${r.name}?${STYLE}&label=stars`, "stars"));
  out.push(img(`${SHIELD}/github/last-commit/${org}/${r.name}?${STYLE}&label=last%20commit`, "last commit"));
  return out.join(" ");
}

/** Compact category cards on the profile — one row per project type, linking
 *  out to its own page. Keeps the profile short; the detail lives elsewhere. */
function projectIndex(data, content, locale) {
  const org = data.org;
  const byName = new Map(data.repos.map((r) => [r.name, r]));
  const c = content.copy.projects;

  const cells = content.groups.map((g) => {
    const published = content.projects.filter((p) => p.group === g.id && byName.has(p.repo));
    const pending = content.projects.filter((p) => p.group === g.id && !byName.has(p.repo));
    const href = BLOB(org, pageFile(g.id, locale));
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

/** The full listing, one page per project type. */
function renderProjectPage(data, content, group, locale) {
  const org = data.org;
  const byName = new Map(data.repos.map((r) => [r.name, r]));
  const c = content.copy.projects;
  const stamp = new Date().toISOString().slice(0, 10);
  const published = content.projects.filter((p) => p.group === group.id && byName.has(p.repo));
  const pending = content.projects.filter((p) => p.group === group.id && !byName.has(p.repo));

  const cards = published.map((p) => {
    const r = byName.get(p.repo);
    const links = [
      `<a href="${r.html_url}">GitHub</a>`,
      p.moodleUrl && `<a href="${p.moodleUrl}">Moodle.org</a>`,
      p.npm && `<a href="https://www.npmjs.com/package/${p.npm}">npm</a>`,
    ].filter(Boolean).join(" · ");
    const install = p.npm ? ["", "```bash", `npm install ${p.npm}`, "```", ""].join("\n") : "";
    return `<h3><a href="${r.html_url}">${esc(p.name)}</a></h3>

<p>${badges(org, p, r)}</p>

${esc(p.desc[locale])}
${install}
<sub>${links}</sub>

---`;
  }).join("\n\n");

  const soon = pending.length ? `
## ${c.soonHeading[locale]}

<sub>${c.soonNote[locale]}</sub>

${pending.map((p) => `- **${p.name}** — ${p.desc[locale]}`).join("\n")}
` : "";

  return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  scripts/generate-profile.mjs. Last generated: ${stamp}
-->

${tabBar(org, locale, {
    enHref: BLOB(org, pageFile(group.id, "en")),
    esHref: BLOB(org, pageFile(group.id, "es")),
  })}

# ${group.label[locale]}

${group.blurb[locale]}

---

${cards || `_${T[locale].noData}_`}
${soon}
<sub><a href="${locale === "es" ? ES_URL(org) : EN_URL(org)}">← ${c.back[locale]}</a></sub>
`;
}

function contributorsSection(data, locale) {
  if (!data.contributors.length) return `_${T[locale].noData}_`;
  // Separated with non-breaking spaces: GitHub strips style attributes, so this
  // is the only horizontal spacing that survives sanitisation.
  const avatars = data.contributors.map((c) =>
    `<a href="${c.url}" title="${esc(c.login)} · ${c.contributions} commits"><img src="${c.avatar}&s=96" width="64" height="64" alt="${esc(c.login)}"></a>`
  ).join("&nbsp;&nbsp;&nbsp;&nbsp;");
  return `<p>${avatars}</p>`;
}

function foundersSection(content, locale) {
  const role = content.copy.founders.role[locale];
  const cells = content.founders.map((f) => `<td width="50%" valign="top">
<b><a href="${f.linkedin}">${esc(f.name)}</a></b> · <a href="https://github.com/${f.github}"><code>@${esc(f.github)}</code></a><br>
<sub>${role}</sub>
<p><sub>${esc(f.bio[locale])}</sub></p>
</td>`).join("\n");
  return `<table>\n<tr>\n${cells}\n</tr>\n</table>`;
}

function renderReadme(data, content, locale) {
  const org = content.org.login;
  const c = content.copy;
  const stamp = new Date().toISOString().slice(0, 10);
  const other = locale === "en" ? "es" : "en";
  const otherUrl = other === "es" ? ES_URL(org) : EN_URL(org);

  const grid = chartGrid(org, locale, [
    [{ base: "languages", alt: c.metrics.languages[locale] },
     { base: "licenses", alt: c.metrics.licenses[locale] }],
    [{ base: "weekday", alt: c.metrics.weekday[locale] },
     { base: "perrepo", alt: c.metrics.perRepo[locale] }],
  ]);

  return `<!--
  GENERATED FILE — DO NOT EDIT.
  Rendered from profile/data/content.json + the GitHub API by
  scripts/generate-profile.mjs, on a schedule. Edit the JSON, not this.
  Last generated: ${stamp}
-->

${tabBar(org, locale, { enHref: EN_URL(org), esHref: ES_URL(org) })}

<h1 align="center">${content.org.name}</h1>

<p align="center"><strong>${esc(content.org.tagline[locale])}</strong></p>

<p align="center">
  <a href="${content.org.website}">${content.org.website.replace("https://", "")}</a> ·
  <a href="${EN_URL(org)}">GitHub</a> ·
  <a href="${otherUrl}">${other.toUpperCase()}</a>
</p>

${picture(org, `stats-${locale}`, "Organisation statistics")}

## ${c.about.heading[locale]}

${c.about.body[locale].join("\n\n")}

> ${c.about.quote[locale]}

## ${c.projects.heading[locale]}

${projectIndex(data, content, locale)}

## ${c.metrics.heading[locale]}

${grid}

${picture(org, `activity-${locale}`, c.metrics.activity[locale])}

## ${c.contributors.heading[locale]}

${contributorsSection(data, locale)}

## ${c.contributing.heading[locale]}

${c.contributing.steps[locale].map((s, i) => `${i + 1}. ${s}`).join("\n")}

## ${c.founders.heading[locale]}

${c.founders.intro[locale]}

${foundersSection(content, locale)}

---

<p align="center">
  <em>${c.footer[locale]}</em><br>
  <a href="${content.org.website}">${content.org.website.replace("https://", "")}</a><br>
  <sub>Updated ${stamp} · generated by <a href="https://github.com/${org}/.github/blob/main/scripts/generate-profile.mjs">generate-profile.mjs</a></sub>
</p>
`;
}

/* ── main ───────────────────────────────────────────────────────────────── */

async function main() {
  const content = JSON.parse(await readFile(join(ROOT, "profile", "data", "content.json"), "utf8"));

  // PROFILE_FIXTURE=<path> renders from a saved snapshot instead of calling the
  // API — useful for working on layout without burning the 60 req/hour that an
  // unauthenticated run gets. PROFILE_DUMP=<path> writes the snapshot back out.
  const data = process.env.PROFILE_FIXTURE
    ? JSON.parse(await readFile(process.env.PROFILE_FIXTURE, "utf8"))
    : await collect(content.org.login);
  if (process.env.PROFILE_DUMP) {
    await writeFile(process.env.PROFILE_DUMP, JSON.stringify(data, null, 2), "utf8");
  }

  await mkdir(ASSETS, { recursive: true });
  await mkdir(join(ROOT, "profile", "projects"), { recursive: true });

  console.log("Rendering assets …");
  for (const mode of MODES) {
    for (const lang of LOCALES) {
      for (const on of [true, false]) {
        await writeFile(join(ASSETS, `tab-${lang}-${on ? "on" : "off"}-${mode}.svg`),
          tab(lang.toUpperCase(), on, mode), "utf8");
      }
    }
    for (const locale of LOCALES) {
      const m = content.copy.metrics;
      const w = (n, c) => writeFile(join(ASSETS, `${n}-${locale}-${mode}.svg`), c, "utf8");
      const days = weekdayItems(data.weekdays, locale);
      // Each grid row is rendered at a shared height so the two tiles line up.
      const rowA = Math.max(data.languages.length, data.licenses.length);
      const rowB = Math.max(days.length, data.perRepo.length);

      // Left-column tiles pad on the right, right-column tiles pad on the left,
      // so the whole gutter lands between them and the outer edges stay flush.
      const L = { padRight: GUTTER }, R = { padLeft: GUTTER };

      await w("stats", kpiStrip(data, locale, mode));
      await w("languages", barRows(data.languages, locale, mode, { ...L, title: m.languages[locale], rows: rowA }));
      await w("licenses", barRows(data.licenses, locale, mode, { ...R, unit: "count", title: m.licenses[locale], rows: rowA }));
      await w("weekday", barRows(days, locale, mode, { ...L, unit: "count", title: m.weekday[locale], rows: rowB }));
      // Repo names are long; give the label column extra room before clipping.
      await w("perrepo", barRows(data.perRepo, locale, mode, { ...R, unit: "count", title: m.perRepo[locale], rows: rowB, labelPct: 0.46 }));
      await w("activity", activityChart(data.timeline, locale, mode, m.activity[locale]));
    }
  }

  console.log("Rendering pages …");
  for (const locale of LOCALES) {
    const file = locale === "es" ? "README.es.md" : "README.md";
    await writeFile(join(ROOT, "profile", file), renderReadme(data, content, locale), "utf8");
    for (const group of content.groups) {
      await writeFile(join(ROOT, "profile", pageFile(group.id, locale)),
        renderProjectPage(data, content, group, locale), "utf8");
    }
  }

  console.log(`\nDone. ${data.repos.length} repos · ${data.contributors.length} contributors · ${data.commits12mo} commits/12mo · ${data.stars} stars · ${data.releases} releases`);
  if (warned.length) console.log(`${warned.length} warning(s) above.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
