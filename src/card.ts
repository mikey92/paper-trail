// The printed card. Plain HTML, one page, black ink: checkboxes to tick, a box to sketch in,
// lines for notes, and every source named at the bottom.

import type { Card, Entry } from "./build.ts";
import type { Group } from "./select.ts";
import type { Caution } from "./wiki.ts";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** "18:41" → "6:41 pm" for Fahrenheit (US) cards, unchanged for Celsius ones. */
export function clock(hhmm: string, unit: "F" | "C"): string {
  if (unit === "C") return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "18:41" minus 75 minutes → "17:26" (never before midnight). */
export function minus(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function monthName(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
}

const HEADINGS: Record<Group, string> = {
  bird: "Birds",
  plant: "Plants",
  fungus: "Fungi",
  insect: "Insects and spiders",
  other: "Other animals",
};

const CAUTION: Record<Caution, string> = {
  touch: "Can irritate skin: don’t touch",
  eat: "Toxic: don’t taste",
  "touch-eat": "Toxic and irritates skin: don’t touch or taste",
  bite: "Venomous: keep your distance",
};

function weatherLine(card: Card): string {
  const w = card.weather;
  if (!w) return `<p class="weather">No forecast yet for this date (forecasts reach 16 days ahead).</p>`;
  const parts = [`High ${w.high}°${w.unit}, low ${w.low}°${w.unit}`];
  if (w.rain != null) parts.push(`${w.rain}% chance of rain`);
  parts.push(`sunrise ${clock(w.sunrise, w.unit)}`, `sunset ${clock(w.sunset, w.unit)}`);
  const start = minus(w.sunset, card.minutes + 15);
  const startLine =
    start > w.sunrise ? ` To finish a ${card.minutes}-minute walk in daylight, start by <b>${clock(start, w.unit)}</b>.` : "";
  return `<p class="weather">${esc(parts.join(" · "))}.${startLine}</p>`;
}

function entryHtml(e: Entry): string {
  const s = e.sighting;
  const quoted = e.by === "wikipedia";
  const tip = quoted ? `“${esc(e.tip)}”` : esc(e.tip);
  const caution = e.caution ? ` <span class="caution">⚠ ${esc(CAUTION[e.caution])}</span>` : "";
  const state = e.by === "pending" ? ` pending` : "";
  return (
    `<li class="entry${state}" data-by="${e.by}">` +
    `<span class="box" aria-hidden="true"></span>` +
    `<div><p class="name"><b>${esc(s.common)}</b> <i>${esc(s.scientific)}</i>${caution}</p>` +
    `<p class="tip">${tip}</p>` +
    `<p class="seen">${s.count} sighting${s.count === 1 ? "" : "s"}</p></div></li>`
  );
}

export interface Footer {
  modelLabel: string | null;
  /** Seconds from "Make my card" to the last tip. */
  seconds: number | null;
}

export function renderCard(card: Card, footer: Footer): string {
  const [title, ...rest] = card.where.label.split(", ");
  const groups = (["bird", "plant", "fungus", "insect", "other"] as Group[])
    .map((g) => ({ g, entries: card.entries.filter((e) => e.sighting.group === g) }))
    .filter((x) => x.entries.length > 0);
  const month = monthName(card.date);
  const lists = groups
    .map(({ g, entries }) => {
      const note = g === "fungus" ? `<p class="note">Never eat a wild mushroom because of this card.</p>` : "";
      const items = entries.map(entryHtml).join("");
      return `<section class="group"><h3>${HEADINGS[g]}</h3>${note}<ul>${items}</ul></section>`;
    })
    .join("");
  const quoted = card.entries.filter((e) => e.by === "wikipedia").length;
  const by = footer.modelLabel
    ? `Tips written by ${esc(footer.modelLabel)} in your browser, each checked word by word against the Wikipedia sentences it was given` +
      (quoted ? `; the ${quoted} in quotation marks are those sentences, because the written tip did not pass.` : ".")
    : "Tips are quoted from Wikipedia.";
  const time = footer.seconds != null ? ` This card took ${footer.seconds} seconds of screen time. Now go outside.` : "";
  return (
    // A short list leaves room on the page: give it to the sketch box.
    `<article class="card${card.entries.length <= 12 ? " roomy" : ""}">` +
    `<header><p class="brand">Paper Trail</p>` +
    `<h2 class="title">${esc(title)}</h2>` +
    (rest.length ? `<p class="region">${esc(rest.join(", "))}</p>` : "") +
    `<p class="when">${esc(longDate(card.date))} · ${card.minutes}-minute walk</p>` +
    weatherLine(card) +
    `</header>` +
    `<p class="lead">${card.entries.length} of the ${card.pool} species people reported within ${card.radiusKm} km in past ${esc(month)}s, ` +
    `most-seen first. Tick what you find.</p>` +
    `<div class="lists">${lists}</div>` +
    `<section class="extras"><div class="sketch"><span>Sketch something that isn’t on this card</span></div>` +
    `<div class="notes"><span>Notes</span><i></i><i></i><i></i><i></i></div></section>` +
    `<footer><p>${by}${time}</p>` +
    `<p>Sightings: research-grade observations from iNaturalist (inaturalist.org). Descriptions: English Wikipedia, CC BY-SA 4.0. ` +
    `Weather: Open-Meteo.com, CC BY 4.0. Made with Paper Trail, github.com/mikey92/paper-trail.</p></footer>` +
    `</article>`
  );
}
