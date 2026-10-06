// What goes on the card: the species people actually reported near here in this month,
// most-seen first, with room kept for each kind of thing so a card is not all birds.

export type Group = "bird" | "plant" | "fungus" | "insect" | "other";

export interface Sighting {
  id: number;
  count: number;
  group: Group;
  common: string;
  scientific: string;
  wikipediaUrl: string | null;
}

export function groupOf(iconic: string | null | undefined): Group {
  switch (iconic) {
    case "Aves": return "bird";
    case "Plantae": return "plant";
    case "Fungi": return "fungus";
    case "Insecta": case "Arachnida": return "insect";
    default: return "other";
  }
}

interface CountRow {
  count: number;
  taxon: { id: number; name: string; preferred_common_name?: string | null; iconic_taxon_name?: string | null; wikipedia_url?: string | null };
}

export function fromSpeciesCounts(rows: CountRow[]): Sighting[] {
  return rows.map((r) => ({
    id: r.taxon.id,
    count: r.count,
    group: groupOf(r.taxon.iconic_taxon_name),
    common: titleCase(r.taxon.preferred_common_name || r.taxon.name),
    scientific: r.taxon.name,
    wikipediaUrl: r.taxon.wikipedia_url ?? null,
  }));
}

function titleCase(name: string): string {
  // "dark-eyed junco" → "Dark-eyed Junco": the style field guides use.
  return name.replace(/(^|\s)([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export const ORDER: Group[] = ["bird", "plant", "fungus", "insect", "other"];

/**
 * Up to n species: roughly 40% birds, 40% plants and the rest fungi and insects, each in
 * order of how often it was reported; unused room goes to the most-reported of the rest.
 */
export function pick(all: Sighting[], n: number): Sighting[] {
  const usable = all.filter((s) => s.wikipediaUrl).sort((a, b) => b.count - a.count);
  const quota: Record<Group, number> = {
    bird: Math.round(n * 0.4),
    plant: Math.round(n * 0.4),
    fungus: Math.max(1, Math.round(n * 0.1)),
    insect: Math.max(1, Math.round(n * 0.1)),
    other: 0,
  };
  const chosen: Sighting[] = [];
  for (const g of ORDER) chosen.push(...usable.filter((s) => s.group === g).slice(0, quota[g]));
  for (const s of usable) {
    if (chosen.length >= n) break;
    if (!chosen.includes(s)) chosen.push(s);
  }
  return chosen
    .slice(0, n)
    .sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || b.count - a.count);
}

/** Species for a walk of this many minutes: a short walk gets a short list. */
export function speciesFor(minutes: number): number {
  return minutes <= 30 ? 8 : minutes <= 60 ? 12 : 16;
}
