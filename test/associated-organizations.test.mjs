import assert from "node:assert/strict";
import test from "node:test";

import { Content } from "../lib/content.mjs";
import { ReadmePage } from "../lib/pages/readme.mjs";
import { ProfileCollector } from "../lib/sources/collector.mjs";

function repository(fullName, extra = {}) {
  const [owner, name] = fullName.split("/");
  return {
    name,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    owner: { login: owner },
    private: false,
    archived: false,
    fork: false,
    stargazers_count: 1,
    license: { spdx_id: "MIT" },
    ...extra,
  };
}

test("aggregates repositories from associated organizations", async () => {
  const primary = repository("didactika/prisma-entity");
  const associated = repository("resilientmq/core");
  const calls = [];
  const github = {
    async get(path) {
      calls.push(path);
      if (path.startsWith("/orgs/didactika/")) return [primary];
      if (path.startsWith("/orgs/resilientmq/")) return [associated];
      if (path.endsWith("/branches?per_page=100")) return [{ name: "main" }];
      if (path.endsWith("/languages")) return { TypeScript: 100 };
      if (path.endsWith("/contributors?per_page=100")) {
        return [{ login: "hector-ae21", type: "User", contributions: 10, avatar_url: "avatar", html_url: "profile" }];
      }
      if (path.endsWith("/stats/commit_activity")) {
        return [{ week: 1, total: 10, days: [0, 2, 2, 2, 2, 2, 0] }];
      }
      if (path.endsWith("/releases?per_page=100")) return [{}];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };

  const collector = new ProfileCollector({
    github,
    log: { step() {}, detail() {} },
  });
  const data = await collector.collect(["didactika", "resilientmq"]);

  assert.equal(data.repos.length, 2);
  assert.equal(data.stars, 2);
  assert.equal(data.releases, 2);
  assert.equal(data.contributors[0].contributions, 20);
  assert.deepEqual(data.perRepo, [
    { name: "prisma-entity", value: 10 },
    { name: "resilientmq/core", value: 10 },
  ]);
  assert.ok(calls.includes("/repos/resilientmq/core/stats/commit_activity"));
});

test("resolves short primary ids and qualified associated ids", () => {
  const content = new Content({
    org: { login: "didactika", associatedOrganizations: ["resilientmq", { login: "another-org" }] },
    projects: [],
  });
  const repos = [repository("didactika/core"), repository("resilientmq/core")];

  assert.deepEqual(content.metricOrganizations, ["didactika", "resilientmq", "another-org"]);
  assert.equal(content.repositoryFor(repos, "core").full_name, "didactika/core");
  assert.equal(content.repositoryFor(repos, "resilientmq/core").full_name, "resilientmq/core");
});

test("discovers typed projects across organizations and preserves editorial overrides", () => {
  const content = new Content({
    org: { login: "didactika" },
    groups: [{ id: "npm", projectTypes: ["npm-package"] }],
    projects: [
      {
        repo: "prisma-entity", group: "npm", name: "Curated name",
        desc: { en: "Curated description", es: "Descripción editorial" },
      },
      {
        repo: "future-package", group: "npm", name: "Future package",
        desc: { en: "Not public yet", es: "Todavía no es público" },
      },
    ],
  });
  const repos = [
    repository("didactika/prisma-entity", {
      description: "Repository description",
      custom_properties: { "project-type": "npm-package" },
    }),
    repository("resilientmq/core", {
      description: "Reliable RabbitMQ processing",
      homepage: "https://www.npmjs.com/package/%40resilientmq%2Fcore",
      custom_properties: { "project-type": "npm-package" },
    }),
    repository("didactika/service", {
      description: "Not an npm package",
      custom_properties: { "project-type": "service" },
    }),
  ];

  const projects = content.projectsIn("npm", repos);

  assert.deepEqual(projects.map((project) => project.repo), [
    "prisma-entity", "resilientmq/core", "future-package",
  ]);
  assert.equal(projects[0].desc.en, "Curated description");
  assert.equal(projects[1].name, "@resilientmq/core");
  assert.equal(projects[1].npm, "@resilientmq/core");
  assert.equal(projects[1].desc.es, "Reliable RabbitMQ processing");
});

test("an explicit project group prevents dynamic reassignment", () => {
  const content = new Content({
    org: { login: "resilientmq" },
    groups: [
      { id: "runtime", projectTypes: ["npm-package"] },
      { id: "types" },
    ],
    projects: [{
      repo: "types__core", group: "types", name: "Types",
      desc: { en: "Types", es: "Tipos" },
    }],
  });
  const repos = [repository("resilientmq/types__core", {
    custom_properties: { "project-type": "npm-package" },
  })];

  assert.deepEqual(content.projectsIn("runtime", repos), []);
  assert.equal(content.projectsIn("types", repos).length, 1);
});

test("renders a parent organization and a single founder without requiring a website", () => {
  const localized = (value) => ({ en: value, es: value });
  const content = new Content({
    org: {
      login: "resilientmq",
      name: "ResilientMQ",
      tagline: localized("Reliable messaging"),
      parent: { name: "Didactika", url: "https://github.com/didactika", label: localized("Part of") },
    },
    copy: {
      about: { heading: localized("About"), body: { en: [], es: [] }, quote: localized("Quote") },
      projects: { heading: localized("Projects") },
      metrics: {
        heading: localized("Metrics"), languages: localized("Languages"), licenses: localized("Licenses"),
        weekday: localized("Weekdays"), perRepo: localized("Repositories"), activity: localized("Activity"),
      },
      contributors: { heading: localized("Contributors") },
      contributing: { heading: localized("Contributing"), steps: { en: [], es: [] } },
      founders: { heading: localized("Founder"), intro: localized("Intro"), role: localized("Founder") },
      footer: localized("Footer"),
    },
    groups: [],
    projects: [],
    founders: [{
      name: "Hector", github: "hector-ae21", linkedin: "https://example.com",
      bio: localized("Bio"),
    }],
  });
  const links = {
    profileEn: "https://github.com/resilientmq",
    profileEs: "https://example.com/es",
    tabBar: () => "",
    picture: () => "",
    chartGrid: () => "",
  };

  const output = new ReadmePage({
    content,
    data: { repos: [], contributors: [] },
    links,
    locale: "en",
    stamp: "2026-08-12",
  }).render();

  assert.match(output, /<sub>Part of<\/sub><br>\s*<strong><a href="https:\/\/github\.com\/didactika">Didactika<\/a>/);
  assert.match(output, /<td width="100%"/);
  assert.doesNotMatch(output, /href="undefined"/);
});

test("renders only sections enabled by profile data", () => {
  const localized = (value) => ({ en: value, es: value });
  const content = new Content({
    org: { login: "minimal", name: "Minimal", tagline: localized("Tagline") },
    sections: {
      about: { enabled: false }, projects: { enabled: false }, metrics: { enabled: false },
      contributors: { enabled: false }, contributing: { enabled: false }, founders: { enabled: false },
    },
    copy: { footer: localized("Footer") },
    groups: [], projects: [], founders: [],
  });
  const links = {
    profileEn: "https://github.com/minimal", profileEs: "https://example.com/es",
    tabBar: () => "", picture: () => { throw new Error("disabled metrics must not render pictures"); },
  };

  const output = new ReadmePage({
    content, data: { repos: [], contributors: [] }, links, locale: "en", stamp: "2026-08-12",
  }).render();

  assert.match(output, /<h1 align="center">Minimal<\/h1>/);
  assert.doesNotMatch(output, /^## /m);
});

test("renders project groups as separate full-width rows", () => {
  const localized = (value) => ({ en: value, es: value });
  const content = new Content({
    org: { login: "didactika", name: "Didactika", tagline: localized("Tagline") },
    sections: {
      about: { enabled: false }, metrics: { enabled: false }, contributors: { enabled: false },
      contributing: { enabled: false }, founders: { enabled: false }, projects: { enabled: true, showPending: false },
    },
    copy: {
      projects: {
        heading: localized("Projects"), count: localized("published"), viewAll: localized("Browse"),
        soonHeading: localized("Soon"),
      },
      footer: localized("Footer"),
    },
    groups: [
      { id: "npm", label: localized("Packages"), blurb: localized("Libraries") },
      { id: "moodle", label: localized("Moodle"), blurb: localized("Plugins") },
    ],
    projects: [], founders: [],
  });
  const links = {
    profileEn: "https://github.com/didactika", profileEs: "https://example.com/es",
    tabBar: () => "", projectPage: (id) => `https://example.com/${id}`,
  };
  const output = new ReadmePage({
    content, data: { repos: [], contributors: [] }, links, locale: "en", stamp: "2026-08-12",
  }).render();

  assert.equal((output.match(/<tr><td width="100%"/g) || []).length, 2);
  assert.doesNotMatch(output, /width="50%"/);
  assert.doesNotMatch(output, /in development/i);
});
