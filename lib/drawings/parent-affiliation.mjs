/**
 * A deliberately tiny parent-organization label for the profile heading.
 *
 * GitHub gives every text element nested in an <h1> much of the heading's
 * font size, even when Markdown uses <sub>. Drawing the relationship at a
 * fixed height keeps it visually subordinate and consistent across GitHub's
 * light and dark themes.
 */

import { Drawing } from "./drawing.mjs";

const FONT_SIZE = 9;
const HEIGHT = 12;
const HORIZONTAL_PADDING = 4;
const APPROXIMATE_CHARACTER_WIDTH = 5;

export class ParentAffiliation extends Drawing {
  constructor(theme, label) {
    super(theme);
    this.label = label;
  }

  render() {
    const width = Math.ceil(
      this.label.length * APPROXIMATE_CHARACTER_WIDTH + HORIZONTAL_PADDING * 2,
    );
    return this.canvas(width, HEIGHT, this.text(width / 2, 9, this.label, {
      size: FONT_SIZE,
      weight: 500,
      fill: this.theme.muted,
      anchor: "middle",
    }));
  }
}
