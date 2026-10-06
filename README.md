# Paper Trail

A printed field card for this week's walk.

Tell it where and when. It finds the species people actually reported there in past years at this
time of year (iNaturalist), reads what each one looks like (Wikipedia), and has **Gemma 3, running
inside your browser tab**, write one line on how to recognise each. Every line is checked word by
word against the Wikipedia sentences it was written from; a line that fails is retried once with the
offending words named, and if it fails again the card quotes Wikipedia instead. You get one page with
checkboxes, a sketch box and the weather. Print it and put the phone away.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests, no network
npm run build      # static site in dist/
```

The page needs no server of its own and no API keys. Gemma's weights come from the Hugging Face Hub
the first time and then stay in the browser's cache.

## How it works

| Step | Where | Code |
|---|---|---|
| Find the place | iNaturalist places (parks and preserves, not just towns) | `src/data.ts` |
| What people saw there in this month, any year | iNaturalist species counts, research grade | `src/data.ts`, `src/select.ts` |
| What each species looks like | The Description section of its English Wikipedia article, cut to the sentences about colour, shape, sound and smell | `src/wiki.ts` |
| One line each | Gemma 3 1B (WebGPU) or 270M, via Transformers.js in a Web Worker | `src/llm.ts`, `src/worker.ts` |
| Is the line true to the source? | Every content word, number and colour–part pair must be in the sentences | `src/ground.ts` |
| Warnings | Rash, poison or venom mentioned in the article; a fixed line for every mushroom | `src/wiki.ts`, `src/card.ts` |
| The page you print | Weather, sunrise and sunset from Open-Meteo, start-by time, sketch box, sources | `src/card.ts` |

## Evaluation

`eval/run.ts` runs the same code on six places with both Gemma sizes. Results: [eval/EVAL.md](eval/EVAL.md).

## Data and licences

- Code: MIT.
- Sightings: [iNaturalist](https://www.inaturalist.org) research-grade observations, through its public API.
- Descriptions: English Wikipedia, CC BY-SA 4.0. Tips are derived from, and quotes taken from, those articles.
- Weather and place times: [Open-Meteo](https://open-meteo.com), CC BY 4.0.
- Model: [Gemma 3](https://ai.google.dev/gemma) (ONNX exports by onnx-community), under the Gemma Terms of Use.
