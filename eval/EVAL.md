# Paper Trail evaluation

Prompt v1 is the first version; v2 and v3 are what changed after reading every v1 and v2 tip (see the commit
messages and [REVIEW.md](REVIEW.md), which also has a hand check of every tip the final run printed).

Six places, 2026-10-11 (October), a 60-minute card each: the species, Wikipedia sentences and cautions were fetched once
(`node eval/run.ts fetch`) so every model sees exactly the same input. Tips were written by `writeTips()` from `src/build.ts`,
the code the page runs, with greedy decoding, on a Mac CPU through onnxruntime-node (q4 weights).

| Run | Tips | Passed first try | Passed after one retry | Quoted from Wikipedia | Median s per tip (CPU) | Median s per card (CPU) | Mean words | Mostly copied (≥ 80% one run of source words) |
|---|---|---|---|---|---|---|---|---|
| Gemma 3 1B, prompt v1 | 72 | 3 (4%) | 31 (43%) | 41 (57%) | 3.7 | 44 | 11.8 | 3 of 31 |
| Gemma 3 1B, prompt v2 | 72 | 47 (65%) | 50 (69%) | 22 (31%) | 2.4 | 41 | 13.5 | 0 of 50 |
| Gemma 3 1B, prompt v3 | 72 | 46 (64%) | 49 (68%) | 23 (32%) | 2.3 | 40 | 13.4 | 0 of 49 |
| Gemma 3 1B, prompt v4 | 72 | 29 (40%) | 39 (54%) | 33 (46%) | 5.3 | 51 | 13.4 | 0 of 39 |
| Gemma 3 270M, prompt v4 | 72 | 1 (1%) | 1 (1%) | 71 (99%) | 1.8 | 22 | 10.0 | 0 of 1 |

## Gemma 3 1B, prompt v1: words the check rejected most

observe (66), note (6), distinct (6), pale (5), visible (4), striking (3), coloration (3), markings (3), gray leaves (2), orange (2), pedicles (2), dark (2), fuzzy (2), body (2), buzzing (2), sound (2), foliage (2), serrated (2), bird (2), noting (2), scent (2), reddish coppery (1), yellow coppery (1), brown (1), pinkish adults (1)

### First tries that failed, and what was printed instead

- **Wild Turkey**: “Observe the reddish-yellow legs, a coppery sheen, and a red head in mature males.” → rejected (observe); final [wikipedia]: “Fully-grown wild turkeys have long, reddish-yellow to grayish-green legs.”
- **Acorn Woodpecker**: “Identify the brown-black head, white forehead, and red cap of the adult male.” → rejected (brown); final [gemma-retry]: “The bird has a dark forehead, white throat, and red cap in males.”
- **Dark-eyed Junco**: “Observe the gray head and breast, and listen for a complex trill.” → rejected (observe); final [wikipedia]: “The bill is usually pale pinkish.”
- **Golden-crowned Sparrow**: “Observe a square-tipped tail and streaks on the back.” → rejected (observe); final [wikipedia]: “Like all Zonotrichia sparrows, it has a relatively long, square-tipped tail and a slightly peaked crown.”
- **Red-shouldered Hawk**: “Observe the dark head, reddish chest, and pale belly with bars.” → rejected (observe); final [gemma-retry]: “The birds have brownish heads, reddish chests, and pale bellies with reddish bars.”
- **Coyote Brush**: “Observe the smooth, sticky leaves and the shrub’s compact growth.” → rejected (observe, compact, growth); final [wikipedia]: “The Baccharis pilularis shrub is generally smaller than 3 metres in height.”
- **California Buckeye**: “Observe the light gray bark, dark green leaves, and fragrant white flowers.” → rejected (observe); final [wikipedia]: “The bark is light gray and smooth.”
- **California Bay**: “Observe the smooth, gray-brown bark and delicate yellow flowers.” → rejected (observe, delicate); final [wikipedia]: “The thin bark is smooth and gray-brown when young, later turning reddish brown and scaly.”

## Gemma 3 1B, prompt v2: words the check rejected most

coloration (4), markings (4), foliage (3), characteristic (2), dark (2), skinned (2), pale (2), yellow cap (2), shape (2), 50 (2), 180 (2), underparts (2), atop (2), fungal (2), growth (2), black bill (2), green bill (2), hairy (1), numerous (1), dark leaves (1), green leaves (1), dark leathery (1), 2 (1), 6 (1), 5 (1)

### First tries that failed, and what was printed instead

- **Coyote Brush**: “Look for smooth, sticky leaves on prostrate stems, characteristic of the shrub.” → rejected (characteristic); final [wikipedia]: “Its leaves are smooth, without spines or hairs, and generally sticky to the touch.”
- **Low Smartweed**: “Look for hairy stems that root at lower nodes, and listen for numerous pink flowers.” → rejected (hairy, numerous); final [gemma-retry]: “Look for branching stems that root at lower nodes, and listen for pink flowers.”
- **Carrion Crow**: “Look for a black bill and dark eyes in juveniles.” → rejected (dark); final [wikipedia]: “The bill, legs, and feet are also black.”
- **Tufted Duck**: “Look for a black-skinned male with a blue-grey bill and a tuft on its head.” → rejected (skinned); final [wikipedia]: “It has a prominent tuft on its head, which gives the species its name.”
- **Grey Heron**: “Look for a white head and a black stripe on the neck, and observe the pale grey coloration.” → rejected (pale, coloration); final [wikipedia]: “The body and wings are grey above and the underparts are greyish-white, with some black on the flanks.”
- **Ivy-leaved Cyclamen**: “Look for variegated foliage, with silver-grey-green patterns, and pink flowers.” → rejected (foliage); final [wikipedia]: “The edges of the petals near the tip of the flower are curved outwards into strong auricles.”
- **Sulphur Tuft**: “Look for a smooth, sulphur yellow cap with orange-brown centres and green spores.” → rejected (yellow cap); final [wikipedia]: “It is smooth and sulphur yellow with an orange-brown centre and whitish margin.”
- **Asian Lady Beetle**: “Look for orange or red coloration, variable black spots on the pronotum, and dark, reddish-brown legs.” → rejected (coloration); final [wikipedia]: “The underside is dark with a wide reddish-brown border.”

## Gemma 3 1B, prompt v3: words the check rejected most

dark (4), rusty head (3), gray head (3), pale (3), gray trunk (2), brown trunk (2), brown fruits (2), green fruits (2), 8 (2), skinned (2), coloration (2), dark legs (2), branches (2), 50 (2), 180 (2), wing (2), markings (2), atop (2), fungal (2), growth (2), white feathers (2), green fruit (2), hairy (1), numerous (1), listen for (nothing to hear) (1)

### First tries that failed, and what was printed instead

- **California Bay**: “Look for a tall, gray-brown trunk, smooth bark turning reddish-brown, and small, green fruits.” → rejected (gray trunk, brown trunk, brown fruits, green fruits); final [wikipedia]: “The thin bark is smooth and gray-brown when young, later turning reddish brown and scaly.”
- **Great Blue Heron**: “Look for slaty flight feathers, red-brown thighs, and a rusty gray head.” → rejected (rusty head, gray head); final [wikipedia]: “Notable features of great blue herons include slaty (gray with a slight azure blue) flight feathers, red-brown thighs …”
- **Low Smartweed**: “Look for hairy stems that root at lower nodes, and listen for numerous pink flowers.” → rejected (hairy, numerous, listen for (nothing to hear)); final [wikipedia]: “The hairless, branching stems may root at lower nodes that come in contact with the substrate.”
- **Carrion Crow**: “Look for a black bill and dark eyes in juveniles.” → rejected (dark); final [wikipedia]: “The bill, legs, and feet are also black.”
- **Tufted Duck**: “Look for a black-skinned male with a blue-grey bill and a tuft on its head.” → rejected (skinned); final [wikipedia]: “It has a prominent tuft on its head, which gives the species its name.”
- **Ivy-leaved Cyclamen**: “Look for 2.5–8 cm long, variable leaf shapes resembling ivy, and pink/purple flowers.” → rejected (2.5, 8); final [wikipedia]: “The edges of the petals near the tip of the flower are curved outwards into strong auricles.”
- **Asian Lady Beetle**: “Look for orange or red coloration, white pronotum, and dark, reddish-brown legs.” → rejected (coloration); final [wikipedia]: “The underside is dark with a wide reddish-brown border.”
- **Great Blue Heron**: “Look for slaty flight feathers, red-brown thighs, and a rusty gray head.” → rejected (rusty head, gray head); final [wikipedia]: “Notable features of great blue herons include slaty (gray with a slight azure blue) flight feathers, red-brown thighs …”

## Gemma 3 1B, prompt v4: words the check rejected most

pale (6), listen for (nothing to hear) (5), yellow head (2), growth (2), growing (2), 20 (2), 30 (2), white stems (2), white immature (2), 8 (2), dark (2), gray streaks (2), markings (2), white dome (2), branches (2), coloration (2), white spots (2), streaked tail (2), brown sides (2), discern (2), leaves (2), dark streaks (1), hairy (1), numerous (1), transitioning (1)

### First tries that failed, and what was printed instead

- **Wild Turkey**: “Look for long, dark tail feathers and bronze wings, with a reddish-yellow head.” → rejected (yellow head); final [wikipedia]: “Fully-grown wild turkeys have long, reddish-yellow to grayish-green legs.”
- **Coyote Brush**: “Look for smooth, sticky leaves, and observe the shrub’s prostrate/erect growth.” → rejected (growth); final [wikipedia]: “Its leaves are smooth, without spines or hairs, and generally sticky to the touch.”
- **Western Hardwood Sulphur Shelf**: “Look for a yellow-orangish cap, growing to 20-30 cm wide, and a white spore print.” → rejected (growing, 20, 30); final [wikipedia]: “The yellow to orangish cap is 20–30 centimetres wide, becoming lobed and zonate with age.”
- **Great Blue Heron**: “Look for slaty flight feathers, a dull blackish-gray crown, and a pale gray-yellow bill.” → rejected (pale); final [wikipedia]: “Notable features of great blue herons include slaty (gray with a slight azure blue) flight feathers, red-brown thighs …”
- **Hermit Thrush**: “Look for a white-dark-white underwing pattern, and listen for reddish tails.” → rejected (listen for (nothing to hear)); final [gemma-retry]: “The hermit thrush has a white-dark-white underwing pattern, and reddish tails.”
- **White Snakeroot**: “Look for smooth, white stems spaced apart, and clean white flowers.” → rejected (white stems); final [wikipedia]: “The flowers are a clean white color and after blooming, small seeds with fluffy white tails are released …”
- **American Pokeweed**: “Look for shiny purple berries on pink pedicels, and observe green to white immature berries.” → rejected (white immature); final [wikipedia]: “A shiny, dark purple berry is held in racemose clusters on pink pedicels with a pink peduncle.”
- **Low Smartweed**: “Look for hairy stems that root at lower nodes, and listen for numerous pink flowers.” → rejected (hairy, numerous, listen for (nothing to hear)); final [wikipedia]: “The fruit is a small, smooth achene.”

## Gemma 3 270M, prompt v4: words the check rejected most

oval (60), toothed (60), bark (56), peeling (50), papery (50), bright (44), strips (44), leaves (32), white (18), back (4), face (4), yellow (4), tinged (2), dark streaks (2), faint (2), autumn (2), edge (2), distinct (2), ish (2), brown back (2), mottled back (2), white spots (2), oblong (2), underside (2), pinkish fruit (2)

### First tries that failed, and what was printed instead

- **Wild Turkey**: “Look for a dark, red-tinged legs under a gray back, and a long, dark, fan-shaped tail.” → rejected (tinged, back); final [wikipedia]: “Fully-grown wild turkeys have long, reddish-yellow to grayish-green legs.”
- **Golden-crowned Sparrow**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bright, bark, peeling, papery, oval, toothed, leaves); final [wikipedia]: “Its wings and tail are brown, and it shows two white wing bars.”
- **Red-shouldered Hawk**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bright, bark, peeling, papery, strips, oval, toothed, leaves); final [wikipedia]: “Adults have brownish heads, reddish chests, and pale bellies with reddish bars.”
- **Coyote Brush**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bright, white, bark, peeling, papery, strips, oval); final [wikipedia]: “Its leaves are smooth, without spines or hairs, and generally sticky to the touch.”
- **California Bay**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bright, white, peeling, papery, strips, oval, toothed); final [wikipedia]: “The thin bark is smooth and gray-brown when young, later turning reddish brown and scaly.”
- **Toyon**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bark, peeling, papery, strips, oval, toothed, leaves); final [wikipedia]: “The fruit is a small pome, 5–10 mm across, bright red and berry-like, produced in large quantities, developing …”
- **Ruby-crowned Kinglet**: “Look for a bright white bark peeling in papery strips, and oval toothed leaves.” → rejected (bright, bark, peeling, papery, strips, oval, toothed, leaves); final [wikipedia]: “The crown patch is rarely orange, yellow, or not present.”
- **Yellow-rumped Warbler**: “Look for a yellow-rumped Warbler' فيها dark streaks on its back, and a brown or gray cheek patch.” → rejected (dark streaks); final [wikipedia]: “Yet the color of the coronata and auduboni groups' throat patches differs and distinguishes them, as the Audubon's …”
