/**
 * The palette, one instance per colour scheme.
 *
 * Every chart is single-hue: bar length and line height carry the values, row
 * labels carry the identities. Nothing is encoded in colour alone, so no
 * categorical ramp is needed and colour-vision separation is not in play.
 *
 * The default mark colour is the Didactika brand teal, stepped per mode and
 * checked against GitHub's real canvases rather than any reference surface:
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

export function brandFor(theme, mode) {
  return theme?.[mode]?.brand || PALETTES[mode].brand;
}

function translucent(hex, alpha) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`invalid theme brand colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The system stack, named rather than shipped: a webfont in an SVG would be a
 *  second request for a drawing whose whole point is being one small file. */
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export class Theme {
  constructor(mode, custom = {}) {
    if (!PALETTES[mode]) throw new Error(`unknown theme: ${mode}`);
    this.mode = mode;
    const overrides = custom[mode] || {};
    Object.assign(this, PALETTES[mode], overrides);
    if (overrides.brand && !overrides.brandSoft) {
      this.brandSoft = translucent(overrides.brand, mode === "light" ? 0.14 : 0.18);
    }
  }
}
