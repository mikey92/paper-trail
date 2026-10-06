// The page: ask where and when, gather the species, let Gemma write the tips, print.
// Everything here is meant to be over quickly; the card is the product, not the screen.

import { gather, writeTips, type Card } from "./build.ts";
import { renderCard } from "./card.ts";
import { here, searchPlaces, type Where } from "./data.ts";
import { MODELS, type ChatMessage, type Generate, type ModelKey } from "./llm.ts";
import type { Device, Dtype, FromWorker, ToWorker } from "./worker.ts";
import "./styles.css";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const form = $<HTMLFormElement>("#plan");
const placeInput = $<HTMLInputElement>("#place");
const dateInput = $<HTMLInputElement>("#date");
const minutesInput = $<HTMLSelectElement>("#minutes");
const modelInput = $<HTMLSelectElement>("#model");
const status = $<HTMLParagraphElement>("#status");
const bar = $<HTMLProgressElement>("#bar");
const others = $<HTMLDivElement>("#others");
const output = $<HTMLDivElement>("#output");
const actions = $<HTMLDivElement>("#actions");
const makeButton = $<HTMLButtonElement>("#make");

// ---------- small conveniences kept in this browser only ----------

const PREFS = "paper-trail:prefs";
function loadPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? "{}");
  } catch {
    return {};
  }
}
function savePrefs() {
  try {
    const unit = (form.elements.namedItem("unit") as RadioNodeList).value;
    localStorage.setItem(PREFS, JSON.stringify({ place: placeInput.value, minutes: minutesInput.value, model: modelInput.value, unit }));
  } catch {
    /* private mode: nothing to remember */
  }
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- where Gemma runs ----------

async function pickDevice(): Promise<{ device: Device; dtype: Dtype }> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) return { device: "webgpu", dtype: adapter.features.has("shader-f16") ? "q4f16" : "q4" };
    } catch {
      /* fall through to the CPU */
    }
  }
  return { device: "wasm", dtype: "q4" };
}

let worker: Worker | null = null;
let loaded: string | null = null;
let nextId = 0;
const waiting = new Map<number, { resolve: (text: string) => void; reject: (err: Error) => void }>();
let onLoad: { resolve: (seconds: number) => void; reject: (err: Error) => void } | null = null;
let onProgress: ((loaded: number, total: number) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<FromWorker>) => {
    const msg = event.data;
    if (msg.type === "progress") onProgress?.(msg.loaded, msg.total);
    else if (msg.type === "ready") onLoad?.resolve(msg.seconds);
    else if (msg.type === "generated") {
      waiting.get(msg.id)?.resolve(msg.text);
      waiting.delete(msg.id);
    } else if (msg.type === "error") {
      const err = new Error(msg.message);
      if (msg.id != null) {
        waiting.get(msg.id)?.reject(err);
        waiting.delete(msg.id);
      } else onLoad?.reject(err);
    }
  };
  return worker;
}

function send(message: ToWorker) {
  getWorker().postMessage(message);
}

async function loadModel(model: ModelKey, progress: (loaded: number, total: number) => void): Promise<{ seconds: number; device: Device }> {
  const { device, dtype } = await pickDevice();
  const key = `${model}/${device}/${dtype}`;
  if (loaded === key) return { seconds: 0, device };
  onProgress = progress;
  const seconds = await new Promise<number>((resolve, reject) => {
    onLoad = { resolve, reject };
    send({ type: "load", model, device, dtype });
  });
  loaded = key;
  return { seconds, device };
}

const generate: Generate = (messages: ChatMessage[], maxNewTokens: number) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    send({ type: "generate", id, messages, maxNewTokens });
  });

// ---------- the run ----------

function say(text: string) {
  status.textContent = text;
}

function where(): Promise<Where> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share a location. Type a place instead."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(here(pos.coords.latitude, pos.coords.longitude)),
      () => reject(new Error("No location permission. Type a place instead.")),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  });
}

let useLocation = false;
let running = false;

async function run(chosen?: Where) {
  if (running) return;
  running = true;
  makeButton.disabled = true;
  actions.hidden = true;
  const started = performance.now();
  let downloading = 0;
  try {
    const modelKey = modelInput.value === "none" ? null : (modelInput.value as ModelKey);
    const minutes = Number(minutesInput.value);
    const unit = (form.elements.namedItem("unit") as RadioNodeList).value as "F" | "C";
    const date = dateInput.value || isoDate(new Date());
    savePrefs();

    // Start the model while the data comes in; on a second visit it loads from the cache.
    const model = modelKey
      ? loadModel(modelKey, (got, total) => {
          bar.hidden = false;
          bar.max = total;
          bar.value = got;
        })
      : null;
    model?.catch(() => {}); // handled below

    let place = chosen;
    if (!place) {
      if (useLocation) {
        say("Finding where you are…");
        place = await where();
      } else {
        const query = placeInput.value.trim();
        if (!query) throw new Error("Type a park, preserve or town, or use your location.");
        say(`Looking up “${query}”…`);
        const found = await searchPlaces(query);
        if (!found.length) throw new Error(`iNaturalist knows no place called “${query}”. Try the park's full name or a nearby town.`);
        place = found[0];
        showOthers(found.slice(1));
      }
    }

    say(`Finding what people saw near ${place.label.split(", ")[0]}…`);
    const { card } = await gather(place, date, minutes, unit);
    if (!card.entries.length) throw new Error("Nobody has reported species with Wikipedia articles near here yet. Try a bigger park nearby.");
    show(card, modelKey ? MODELS[modelKey].label : null, null);

    let problem = "";
    if (model && modelKey) {
      const label = MODELS[modelKey].label;
      try {
        say(`Loading ${label}… (the first time, this downloads it once)`);
        const loadStarted = performance.now();
        const { device } = await model;
        downloading = (performance.now() - loadStarted) / 1000;
        bar.hidden = true;
        card.model = label;
        let done = 0;
        say(`${label} is writing tips on the ${device === "webgpu" ? "GPU" : "CPU"}: 0 of ${card.entries.length}…`);
        await writeTips(card, generate, () => {
          done++;
          say(`${label} is writing tips on the ${device === "webgpu" ? "GPU" : "CPU"}: ${done} of ${card.entries.length}…`);
          show(card, label, null);
        });
      } catch (err) {
        bar.hidden = true;
        problem = ` ${label} could not run here (${err instanceof Error ? err.message : String(err)}), so the tips are quoted from Wikipedia.`;
      }
    }
    // Whatever Gemma did not write is quoted.
    for (const e of card.entries) if (e.by === "pending") e.by = "wikipedia";

    const total = (performance.now() - started) / 1000;
    const screen = Math.round(downloading > 5 ? total - downloading : total);
    show(card, card.entries.some((e) => e.by !== "wikipedia") ? card.model : null, screen);
    const note = downloading > 5 ? ` (plus ${Math.round(downloading)} s downloading the model, once)` : "";
    say(`Done in ${screen} seconds${note}.${problem} Print it and put the phone away.`);
    actions.hidden = false;
    $<HTMLButtonElement>("#print").focus();
  } catch (err) {
    bar.hidden = true;
    say(err instanceof Error ? err.message : String(err));
  } finally {
    running = false;
    makeButton.disabled = false;
  }
}

function show(card: Card, modelLabel: string | null, seconds: number | null) {
  output.innerHTML = renderCard(card, { modelLabel, seconds });
}

function showOthers(list: Where[]) {
  others.replaceChildren();
  if (!list.length) return;
  const label = document.createElement("span");
  label.textContent = "Not the right place? ";
  others.append(label);
  for (const place of list.slice(0, 4)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link";
    b.textContent = place.label;
    b.addEventListener("click", () => {
      placeInput.value = place.label;
      others.replaceChildren();
      void run(place);
    });
    others.append(b);
  }
}

// ---------- wiring ----------

const today = new Date();
dateInput.value = isoDate(today);
dateInput.min = isoDate(today);
dateInput.max = isoDate(new Date(today.getTime() + 15 * 86_400_000));

const prefs = loadPrefs();
if (prefs.place) placeInput.value = prefs.place;
if (prefs.minutes) minutesInput.value = prefs.minutes;
if (prefs.model && [...modelInput.options].some((o) => o.value === prefs.model)) modelInput.value = prefs.model;
const unit = prefs.unit ?? (/-(US|LR|MM)$/i.test(navigator.language) ? "F" : "C");
(form.querySelector(`input[name=unit][value=${unit}]`) as HTMLInputElement | null)?.click();

void pickDevice().then(({ device }) => {
  // Without WebGPU, Gemma runs on one CPU thread: minutes per card. Quoting Wikipedia is the
  // honest default there, and the models stay one click away.
  if (device === "wasm" && !prefs.model) modelInput.value = "none";
  $<HTMLSpanElement>("#device").textContent =
    device === "webgpu"
      ? "This browser has WebGPU, so Gemma runs on your own graphics chip."
      : "This browser has no WebGPU, so Gemma would run slowly on the CPU. The card will quote Wikipedia unless you pick a model.";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  useLocation = false;
  others.replaceChildren();
  void run();
});

$<HTMLButtonElement>("#locate").addEventListener("click", () => {
  useLocation = true;
  others.replaceChildren();
  void run();
});

$<HTMLButtonElement>("#print").addEventListener("click", () => window.print());

// A card made earlier by the eval (eval/run.ts), so a first look costs no download.
$<HTMLButtonElement>("#example").addEventListener("click", async () => {
  try {
    const res = await fetch("/sample-card.json");
    if (!res.ok) throw new Error(`no example yet (${res.status})`);
    const sample = (await res.json()) as { card: Card; modelLabel: string; seconds: number | null };
    show(sample.card, sample.modelLabel, sample.seconds);
    say(`An example: ${sample.card.where.label.split(", ")[0]}, written by ${sample.modelLabel}. Make your own above.`);
    actions.hidden = false;
    output.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    say(`Could not load the example: ${err instanceof Error ? err.message : String(err)}`);
  }
});
