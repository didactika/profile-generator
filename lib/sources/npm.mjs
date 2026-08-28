/**
 * Minimal npm registry client used to verify that repository packages are
 * publicly available before the profile advertises them.
 */
export class NpmRegistryClient {
  #fetch;
  #retries;
  #sleep;
  #userAgent;

  constructor({
    fetchImpl = fetch,
    retries = 2,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    userAgent = "profile-generator",
  } = {}) {
    this.#fetch = fetchImpl;
    this.#retries = retries;
    this.#sleep = sleep;
    this.#userAgent = userAgent;
  }

  /**
   * Returns the current public package metadata, or `null` when npm has no
   * published package with that name.
   */
  async publishedPackage(name) {
    const encodedName = encodeURIComponent(name);
    const url = `https://registry.npmjs.org/${encodedName}/latest`;
    let response;

    for (let attempt = 0; attempt <= this.#retries; attempt++) {
      try {
        response = await this.#fetch(url, {
          headers: { "user-agent": this.#userAgent },
        });
      } catch (error) {
        if (attempt === this.#retries) {
          throw new Error(`Could not check npm package ${name}: ${error.message}`, { cause: error });
        }
        await this.#sleep(250 * (2 ** attempt));
        continue;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < this.#retries) {
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        await this.#sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 250 * (2 ** attempt));
        continue;
      }
      break;
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} while checking npm package ${name}`);
    }

    const metadata = await response.json();
    if (metadata.name !== name || typeof metadata.version !== "string") {
      throw new Error(`npm returned invalid metadata for ${name}`);
    }

    const repository = typeof metadata.repository === "string"
      ? metadata.repository
      : metadata.repository?.url;

    return {
      name: metadata.name,
      version: metadata.version,
      repository: typeof repository === "string" ? repository : "",
    };
  }
}
