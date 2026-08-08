/**
 * The palette, one instance per colour scheme.
 *
 * Every chart is single-hue: bar length and line height carry the values, row
 * labels carry the identities. Nothing is encoded in colour alone, so no
 * categorical ramp is needed and colour-vision separation is not in play.
 *
 * The mark colour is the Didactika brand teal, stepped per mode and checked
 * against GitHub's real canvases rather than any reference surface:
 *   light  #0d9488 on #ffffff → 3.74:1  (>= 3:1)
 *   dark   #14b8a6 on #0d1117 → 7.60:1  (>= 3:1)
 */

const PALETTES = {
  light: {
    surface: "#ffffff", primary: "#0b0b0b", secondary: "#52514e", muted: "#898781",
    grid: "#e1e0d9", axis: "#c3c2b7", brand: "#0d9488", brandSoft: "rgba(13,148,136,0.14)",
  },
  dark: {
    surface: "#0d1117", primary: "#ffffff", secondary: "#c3c2b7", muted: "#898781",
    grid: "#21262d", axis: "#383835", brand: "#14b8a6", brandSoft: "rgba(20,184,166,0.18)",
  },
};

/** The system stack, named rather than shipped: a webfont in an SVG would be a
 *  second request for a drawing whose whole point is being one small file. */
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export class Theme {
  constructor(mode) {
    if (!PALETTES[mode]) throw new Error(`unknown theme: ${mode}`);
    this.mode = mode;
    Object.assign(this, PALETTES[mode]);
  }
}
