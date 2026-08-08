/**
 * An output directory that knows what it wrote.
 *
 * Everything under profile/assets and profile/projects is generated, so
 * anything left there that a run did not write is output of a shape
 * content.json no longer describes: the page for a group that was removed,
 * the assets for a language that no longer exists. Nothing links to it and
 * nothing would ever notice it again, so the run sweeps it out rather than
 * leaving it to rot.
 */

import { mkdir, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export class OutputDirectory {
  #written = new Set();

  constructor(root, log) {
    this.root = root;
    this.log = log;
  }

  /** @param relative path inside this directory, with forward slashes. */
  async write(relative, contents) {
    this.#written.add(relative);
    const target = join(this.root, ...relative.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }

  async prune() {
    await mkdir(this.root, { recursive: true });
    await this.#sweep(this.root, "");
  }

  async #sweep(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.#sweep(full, relative);
        // A folder that only existed to hold deleted files goes with them.
        if ((await readdir(full)).length === 0) {
          await rmdir(full);
          this.log.removed(`removed empty ${relative}/`);
        }
        continue;
      }

      if (this.#written.has(relative)) continue;
      await unlink(full);
      this.log.removed(`removed stale ${relative}`);
    }
  }
}

/** The assets directory, which names most of its files by drawing, language
 *  and colour scheme. The tab icons do not fit that shape — they are named by
 *  which language they are a tab *for* and whether they are the active one —
 *  so those are written through the plain write() they inherit instead. */
export class AssetDirectory extends OutputDirectory {
  async writeDrawing(name, locale, mode, drawing) {
    await this.write(`${name}-${locale}-${mode}.svg`, drawing.render());
  }
}
