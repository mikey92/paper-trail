# Reading every tip

The check in `src/ground.ts` can tell when a tip uses a word, a number or a colour–part pairing its
source doesn't have. It can't tell whether a tip built from the source's own words still says
something the source doesn't. So for the runs that mattered I read every tip Gemma wrote, next to
the sentences it was written from (`python3 dump.py eval/results/<run>.json written` prints them
side by side), and sorted each one:

- **right**: every claim is in the source, attached to the right part, sex and season;
- **clumsy**: right, but jargon ("drupes", "corymbs"), a Latin name, or a detail no walker can see
  (a spore print);
- **wrong**: at least one claim is not what the source says.

Lines the card quotes from Wikipedia are not counted: they are the source.

## Prompt v3 (Gemma 3 1B): 49 written tips

**32 right, 5 clumsy, 12 wrong.** No tip invented a feature; every wrong one moved a true detail to
a neighbouring part, sex or season from the same sentence:

| Species | Tip | What the source says |
|---|---|---|
| Red-shouldered hawk (twice) | "pale bellies with reddish bars in the wings" | the reddish bars are on the belly |
| Hayfield tarweed | "lower stem leaves, covered in glandular hairs" | the flower heads carry the hairs |
| Toyon | "red berries developing in December" | they develop in August–September and ripen in December |
| Yellow-rumped warbler | "females have brown backs and black cheeks" | males have the black cheeks |
| White snakeroot | "smooth, spaced leaves" | the stems are smooth |
| Common mugwort | "purple stems and angular leaves" | the stems are angular |
| Giant puffball | "greenish-brown mature specimens" | the inside of a mature one is greenish brown |
| Sulphur tuft | "green spores" | the gills turn green as the purple-black spores develop |
| American wigeon | "a mask of green around the eyes in flight" | in flight you see the white shoulder patch |
| Fuchsia heath | "red tubes with minute teeth on thin, flat leaves" | the leaves have the teeth; the flowers are the red tubes |
| Cocoplum | "green tips on inland cocoplum fruits" | 'Green Tip' is a cultivar with green new growth |

That is what prompt v4 and the "no other colour in between" rule were written against.

## Prompt v4 (Gemma 3 1B, the version the page runs)

V4_REVIEW
