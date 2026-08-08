/** The row of headline figures across the top of the profile. */

import { Drawing, MOTION } from "./drawing.mjs";
import { formatCount } from "../text.mjs";

const W = 860;
/** H must clear the tallest glyph plus the label: the value sits on a baseline
 *  at y=50 with a 34px face and the label baseline at y=72, so anything under
 *  ~86 clips the numbers top and bottom. */
const H = 86;
const PAD = 4;

export class KpiStrip extends Drawing {
  /** @param tiles [count, label] pairs, in the order they should read. */
  constructor(theme, tiles) {
    super(theme);
    this.tiles = tiles;
  }

  render() {
    const th = this.theme;
    const cw = (W - PAD * 2) / this.tiles.length;

    const body = this.tiles.map(([count, label], i) => {
      const cx = PAD + cw * i + cw / 2;
      const divider = i === 0 ? ""
        : `<line x1="${PAD + cw * i}" y1="24" x2="${PAD + cw * i}" y2="${H - 24}" stroke="${th.grid}" stroke-width="1"/>`;
      return `${divider}
<g class="rise" style="${this.delay(i)}">
${this.text(cx, 50, formatCount(count), { size: 34, weight: 700, fill: th.primary, anchor: "middle" })}
${this.text(cx, 72, label.toUpperCase(), { size: 10, weight: 600, fill: th.muted, anchor: "middle" })}
</g>`;
    }).join("\n");

    return this.canvas(W, H, `${MOTION}\n${body}`);
  }
}
