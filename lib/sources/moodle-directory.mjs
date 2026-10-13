/**
 * Minimal client of the Moodle plugins directory, used to verify that a plugin is published there before the profile
 * says so. The directory answers `/plugins/<component>` with the page of the plugin, after a redirect to the
 * marketplace, and with a 404 when it has no such plugin.
 *
 * The directory sits behind a rate limiter that answers a quick succession of requests with a 429, so the requests
 * are spaced and a 429 is waited out with a growing pause before it is given up on.
 */
export class MoodleDirectoryClient {
  #fetch;
  #pace;
  #retries;
  #sleep;
  #userAgent;
  #asked = false;

  constructor({
    fetchImpl = fetch,
    pace = 1500,
    retries = 4,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    userAgent = "profile-generator",
  } = {}) {
    this.#fetch = fetchImpl;
    this.#pace = pace;
    this.#retries = retries;
    this.#sleep = sleep;
    this.#userAgent = userAgent;
  }

  /**
   * Returns where the plugin is listed, or `null` when the directory has no plugin with that component. Any other
   * answer is an error: a plugin must not be called unpublished because the directory had a bad moment.
   */
  async publishedPlugin(component) {
    const url = `https://moodle.org/plugins/${encodeURIComponent(component)}`;
    // Between one request and the next, never before the first.
    if (this.#asked) await this.#sleep(this.#pace);
    this.#asked = true;
    let response;

    for (let attempt = 0; attempt <= this.#retries; attempt++) {
      try {
        response = await this.#fetch(url, { headers: { "user-agent": this.#userAgent }, redirect: "follow" });
      } catch (error) {
        if (attempt === this.#retries) {
          throw new Error(`Could not check the Moodle plugins directory for ${component}: ${error.message}`, { cause: error });
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

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} while checking ${component} in the Moodle plugins directory`);
    }
    return { component, url };
  }

  /** 2 s, 4 s, 8 s, 16 s … */
  #backoff(attempt) {
    return 2000 * (2 ** attempt);
  }
}
