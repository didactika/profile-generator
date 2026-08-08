/**
 * One half of the EN/ES language switcher.
 *
 * GitHub markdown has no tab widget and no JavaScript, so a real tab bar is two
 * linked images: the selected one underlined in the brand hue, the other muted
 * and pointing at the sibling README. Drawing them here, rather than pulling
 * badges from a third-party service, keeps the switcher on the same palette as
 * the charts and free of external requests.
 *
 * Not animated: this is a state indicator a reader glances at once, not a
 * value being revealed, and the motion budget is spent on the charts below it.
 */

import { Drawing } from "./drawing.mjs";

const W = 54, H = 32;

export class Tab extends Drawing {
  constructor(theme, label, active) {
    super(theme);
    this.label = label;
    this.active = active;
  }

  render() {
    const th = this.theme;
    return this.canvas(W, H, `${this.text(W / 2, 19, this.label, {
      size: 12, weight: 700,
      fill: this.active ? th.primary : th.muted,
      anchor: "middle",
    })}
<rect x="0" y="${H - 2}" width="${W}" height="2" fill="${this.active ? th.brand : th.grid}"/>`);
  }
}
