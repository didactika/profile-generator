/**
 * The handful of words drawn *inside* the SVGs themselves — tile labels, chart
 * titles' "no data" fallback — as opposed to the markdown, which content.json
 * already carries in both languages. These are fixed vocabulary the generator
 * owns, not editorial copy, so they live here rather than in the JSON.
 */
export const STRINGS = {
  en: {
    repos: "Repositories", contributors: "Contributors", stars: "Stars",
    commits: "Commits · 12 mo", releases: "Releases",
    other: "Other", noData: "No data yet",
  },
  es: {
    repos: "Repositorios", contributors: "Colaboradores", stars: "Estrellas",
    commits: "Commits · 12 m", releases: "Releases",
    other: "Otros", noData: "Sin datos todavía",
  },
};
