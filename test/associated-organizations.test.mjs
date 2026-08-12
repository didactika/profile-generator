import assert from "node:assert/strict";
import test from "node:test";

import { Content } from "../lib/content.mjs";
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
