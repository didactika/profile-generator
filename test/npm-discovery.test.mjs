import assert from "node:assert/strict";
import test from "node:test";

import { ProfileCollector } from "../lib/sources/collector.mjs";
import { NpmRegistryClient } from "../lib/sources/npm.mjs";

function repository(name) {
  return {
    name,
    full_name: `resilientmq/${name}`,
    html_url: `https://github.com/resilientmq/${name}`,
    owner: { login: "resilientmq" },
    private: false,
    archived: false,
    fork: false,
    stargazers_count: 0,
  };
}

function encodedManifest(manifest) {
  return {
    encoding: "base64",
    content: Buffer.from(JSON.stringify(manifest)).toString("base64"),
  };
}

test("reads public package metadata from the npm registry", async () => {
  const calls = [];
  const client = new NpmRegistryClient({
    userAgent: "profile-test",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            name: "@resilientmq/prisma-connector",
            version: "0.1.1",
            repository: { url: "git+https://github.com/resilientmq/prisma-connector.git" },
          };
        },
      };
    },
  });

  const result = await client.publishedPackage("@resilientmq/prisma-connector");

  assert.deepEqual(result, {
    name: "@resilientmq/prisma-connector",
    version: "0.1.1",
    repository: "git+https://github.com/resilientmq/prisma-connector.git",
  });
  assert.equal(calls[0].url, "https://registry.npmjs.org/%40resilientmq%2Fprisma-connector/latest");
  assert.equal(calls[0].options.headers["user-agent"], "profile-test");
});

test("returns null for an unpublished npm package", async () => {
  const client = new NpmRegistryClient({
    fetchImpl: async () => ({ ok: false, status: 404, statusText: "Not Found" }),
  });

  assert.equal(await client.publishedPackage("@resilientmq/not-published"), null);
});

test("retries transient npm registry failures", async () => {
  let attempts = 0;
  const waits = [];
  const client = new NpmRegistryClient({
    retries: 2,
    sleep: async (milliseconds) => { waits.push(milliseconds); },
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 503, statusText: "Service Unavailable", headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            name: "@resilientmq/core",
            version: "3.0.1",
            repository: "git+https://github.com/resilientmq/core.git",
          };
        },
      };
    },
  });

  const result = await client.publishedPackage("@resilientmq/core");

  assert.equal(attempts, 2);
  assert.deepEqual(waits, [250]);
  assert.equal(result.version, "3.0.1");
});

test("collector keeps only published packages owned by their repositories", async () => {
  const repos = [repository("published"), repository("private"), repository("mismatch")];
  const manifests = {
    published: encodedManifest({ name: "@resilientmq/published" }),
    private: encodedManifest({ name: "@resilientmq/private", private: true }),
    mismatch: encodedManifest({ name: "@resilientmq/mismatch" }),
  };
  const github = {
    async get(path) {
      if (path === "/orgs/resilientmq") {
        return {
          login: "resilientmq",
          name: "ResilientMQ",
          description: "Reliable messaging",
          avatar_url: "avatar",
          html_url: "https://github.com/resilientmq",
          blog: "",
        };
      }
      if (path.startsWith("/orgs/resilientmq/repos")) return repos;
      const content = path.match(/^\/repos\/resilientmq\/([^/]+)\/contents\/package\.json$/);
      if (content) return manifests[content[1]];
      if (path.endsWith("/branches?per_page=100")) return [];
      if (path.endsWith("/languages")) return {};
      if (path.endsWith("/contributors?per_page=100")) return [];
      if (path.endsWith("/stats/commit_activity")) return [];
      if (path.endsWith("/releases?per_page=100")) return [];
      throw new Error(`Unexpected GitHub request: ${path}`);
    },
  };
  const npm = {
    async publishedPackage(name) {
      if (name === "@resilientmq/published") {
        return {
          name,
          version: "1.0.0",
          repository: "git+https://github.com/resilientmq/published.git",
        };
      }
      return {
        name,
        version: "1.0.0",
        repository: "git+https://github.com/another-owner/mismatch.git",
      };
    },
  };
  const warnings = [];
  const collector = new ProfileCollector({
    github,
    npm,
    log: { step() {}, detail() {}, warn(message) { warnings.push(message); } },
  });

  const data = await collector.collect(["resilientmq"]);

  assert.deepEqual(data.repos[0].packages, {
    npm: { name: "@resilientmq/published", version: "1.0.0" },
  });
  assert.equal(data.repos[1].packages, undefined);
  assert.equal(data.repos[2].packages, undefined);
  assert.match(warnings[0], /does not point to resilientmq\/mismatch/);
});
