import assert from "node:assert/strict";
import test from "node:test";

import { Content } from "../lib/content.mjs";
import { ReadmePage } from "../lib/pages/readme.mjs";
import { ProfileCollector } from "../lib/sources/collector.mjs";

function repository(fullName) {
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

  assert.match(output, /Part of <strong><a href="https:\/\/github\.com\/didactika">Didactika<\/a>/);
  assert.match(output, /<td width="100%"/);
  assert.doesNotMatch(output, /href="undefined"/);
});
