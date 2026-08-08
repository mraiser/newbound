// scenetokens.js — the scene facet's material token table (scene-facet-design
// §2.3). Pure data: token name → per-theme material spec. The 3D world themes
// with the rest of the bench — controls name tokens, never colors, so a theme
// flip (or a future palette change) re-skins every scene.
//
// Spec fields: color "#rrggbb" · opacity (0–1, omit = opaque) · flat (bool,
// flat-shaded) · emissive (bool, unlit — labels/glows). scenestage maps these
// onto real materials; nothing else interprets them.

export const TOKENS = {
  light: {
    surface: { color: "#9aa1a9", flat: true },
    paper:   { color: "#e8e4dc", flat: true },
    ink:     { color: "#33383d", flat: true },
    accent:  { color: "#62BD8C", flat: true },            // the 3d facet hue
    good:    { color: "#4FAE6E", flat: true },
    danger:  { color: "#C15A5A", flat: true },
    agent:   { color: "#D96BA0", flat: true },            // commands magenta
    human:   { color: "#56A3D9", flat: true },            // css sky
    wire:    { color: "#7d8aa0", emissive: true },
    glass:   { color: "#8fb8c9", opacity: 0.18 },
  },
  dark: {
    surface: { color: "#6f757d", flat: true },
    paper:   { color: "#2e2b26", flat: true },
    ink:     { color: "#d5d9dd", flat: true },
    accent:  { color: "#62BD8C", flat: true },
    good:    { color: "#4FAE6E", flat: true },
    danger:  { color: "#C15A5A", flat: true },
    agent:   { color: "#D96BA0", flat: true },
    human:   { color: "#56A3D9", flat: true },
    wire:    { color: "#93a1b8", emissive: true },
    glass:   { color: "#6d95a6", opacity: 0.22 },
  },
};

export const TOKEN_NAMES = Object.keys(TOKENS.light);

/** Resolve a node's material spec: token (theme-resolved) overlaid with any
    literal fields ({color, opacity} escape hatch — scene-facet-design §2.2).
    Unknown token → the `surface` spec (SD-4 warned at validate time). */
export function resolveMaterial(material, theme = "light") {
  const table = TOKENS[theme] || TOKENS.light;
  const base = material && material.token
    ? (table[material.token] || table.surface)
    : table.surface;
  const out = { ...base };
  if (material) {
    if (typeof material.color === "string") out.color = material.color;
    if (typeof material.opacity === "number") out.opacity = material.opacity;
  }
  return out;
}
