/**
 * Minimal client of the Moodle plugins directory, used to verify that a plugin is published there before the profile
 * says so.
 *
 * It reads the list that Moodle publishes for programs, `download.moodle.org/api/1.3/pluglist.php`, which holds every
 * plugin of the directory with its component, once for the whole run. The pages of moodle.org are not used: they sit
 * behind a rate limiter and a firewall that answer a quick succession of requests, or a request from the servers of
 * GitHub Actions, with a 429 or a 403.
 */
const LIST_URL = "https://download.moodle.org/api/1.3/pluglist.php";

export class MoodleDirectoryClient {
  #fetch;
  #retries;
  #sleep;
  #userAgent;
  #components = null;

  constructor({
    fetchImpl = fetch,
    retries = 3,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    userAgent = "profile-generator",
  } = {}) {
    this.#fetch = fetchImpl;
    this.#retries = retries;
    this.#sleep = sleep;
    this.#userAgent = userAgent;
  }

  /**
   * Returns where the plugin is listed, or `null` when the directory has no plugin with that component. A directory
   * that cannot be read is an error: a plugin must not be called unpublished because the directory had a bad moment.
   */
  async publishedPlugin(component) {
    const components = await this.#list();
    return components.has(component)
      ? { component, url: `https://moodle.org/plugins/${encodeURIComponent(component)}` }
      : null;
  }

  /** The components of every plugin of the directory, asked for once. */
  #list() {
    this.#components ??= this.#download().catch((error) => {
      // A failed attempt is not remembered, so the next plugin asks again.
      this.#components = null;
      throw error;
    });
    return this.#components;
  }

  async #download() {
    let response;

    for (let attempt = 0; attempt <= this.#retries; attempt++) {
      try {
        response = await this.#fetch(LIST_URL, { headers: { "user-agent": this.#userAgent } });
      } catch (error) {
        if (attempt === this.#retries) {
          throw new Error(`Could not read the Moodle plugins directory: ${error.message}`, { cause: error });
        }
        await this.#sleep(this.#backoff(attempt));
        continue;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < this.#retries) {
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        await this.#sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : this.#backoff(attempt));
        continue;
      }
      break;
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} while reading the Moodle plugins directory`);
    }

    const list = await response.json();
    if (!Array.isArray(list?.plugins)) {
      throw new Error("The Moodle plugins directory answered with a list that has no plugins");
    }
    return new Set(list.plugins.map((plugin) => plugin.component).filter(Boolean));
  }

  /** 2 s, 4 s, 8 s … */
  #backoff(attempt) {
    return 2000 * (2 ** attempt);
  }
}
