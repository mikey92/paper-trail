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

### And the rejections

Of the v3 attempts the check rejected, most deserved it: *"hairy stems"* on low smartweed (Wikipedia:
"the hairless, branching stems"), *"a long, black-green bill"* on the anhinga (the bill is yellow),
*"a black-skinned male"* on the tufted duck, *"streaked tails"* on the topknot pigeon (the streaks
are on the chest), *"a rusty gray head"* on the great blue heron, sizes in centimetres. Some did not,
and those were the check's fault:

- *"The bark is light gray, leaves are dark green"* (California buckeye, v1) failed as "gray
  leaves": pairing ran past the comma. A comma now ends the search unless an adjective chain carries
  on ("gray, scaly bark").
- *"coloration"* failed against "colouration", and *"atop"* counted as a claim. Spellings are now
  folded together and prepositions are free.
- *"glossy"* where the article says "shiny", *"dark legs"* where it says "black legs": synonyms. These
  still fail, on purpose; a synonym list is a list of new ways to be wrong. A rejected true tip costs a
  quote; a passed false one costs a wrong card.

## Prompt v4 (Gemma 3 1B, the version the page runs): 39 written tips

**29 right, 5 clumsy, 5 wrong**, against v3's 32 right, 5 clumsy and 12 wrong of 49. The stricter
colour rule turns more first tries into quotes (33 of the 72 lines, up from 23), and the wrong lines
fall from 12 to 5, four of them different:

| Species | Tip | What the source says |
|---|---|---|
| Wood duck (two places) | "listen for a rising whistle from the female" | the rising whistle is the male's call; the female squeals |
| Superb lyrebird | "silvery median feathers on the female's tail" | they are in the middle of the male's tail; the female's is plainer |
| Toyon | "red fruits developing in December" | they develop in August or September and ripen in December |
| Giant puffball | "a white interior, then a greenish-brown mature specimen" | it is the inside of a mature one that is greenish brown |

Every word of each is in its source, and each colour sits next to its part. What is wrong is whose
or when: the sex from the next clause, the month from the next phrase, the part one step out. The
toyon and the puffball were wrong the same way in v3. Telling "The male's call is a rising whistle;
the females utter a drawn-out, rising squeal" apart needs to know who each clause is about, which a
word check doesn't. The lyrebird is my fault, not Gemma's: the article's "Tail feathers" section
opens with "Adult males have tails up to 70 cm (28 in) long", and that sentence was left out for its
measurement, so Gemma was never told whose tail had "two silvery median feathers". The toyon tip is
on the site's example card; I left it there.

Clumsy: hayfield tarweed ("yellowish-dark disc florets"), western sword fern ("round sori with
fringed edges": the fringe is on the sori's cover), Gymea lily and fine-leaf bush pea ("glabrous"),
little blue heron ("dark heads … during breeding, and … the red head coloration": two true sentences
run together).

### And the rejections

For the 33 species that were quoted, I read both attempts:

- **20 deserved it**: a colour on the wrong part (*"reddish-yellow head"* on the wild turkey; it's
  the legs), *"white stems"*, *"a pale gray-yellow bill"* (dull, and only on young birds), sizes,
  *"listen for the sequential opening of the flower head"* (wild teasel), and *"gray backs with dark
  streaks in males"* on the yellow-rumped warbler, which drops "during the breeding season".
- **5 ran past the eighteen-word limit**, most of them true: the red-shouldered hawk's first try was
  its source sentence plus the tail.
- **7 were true and lost on a word**: *growth*, *branches*, *appear*, *distinct* for "distinctive",
  *coloration* for "colour", *"dark dorsal scales"* where the article says "blackish", and
  *"green to white immature berries"* on pokeweed, which the article says as "Immature berries are
  green, turning white": the rule sees *green* between *immature* and *white*.
- **1 I can't call**: *"white spots on the coverts"* on the green catbird (the spots are on the
  tertiaries and secondaries, and form white wing-bars on the coverts).

The warbler was rejected for the wrong reason: *streaks* is itself a pattern word, and the pairing
can't take a pattern word as the part, so "dark streaks" fails even where the article says it. The
line it stopped was wrong anyway: it drops "during the breeding season", and the card is for October.
