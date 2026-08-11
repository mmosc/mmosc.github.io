# Adding a new paper

Follow these steps whenever a paper gets accepted. The Publications page and the Timeline page both update automatically from the same information — you don't need to edit those pages by hand.

## 1. Add the paper's information

Open `_bibliography/papers.bib` and add a new entry, following the pattern of the entries already there. Fill in:

- `title` — the paper's title
- `author` — the list of authors, in order
- `booktitle` (or `journal`) — where it was published
- `year` — the year
- `month` — the month it was published or presented
- `topic` — one or more of: `recommender-systems`, `music-information-retrieval`, `multimodal-learning`, `particle-physics` (separate with commas if more than one applies)
- `venue_short` — a short name for the venue, e.g. `ACM RecSys`
- `first_author` — `true` if you are the first author, otherwise `false`
- `bibtex_show` — `true` so a "Bib" button appears on the website
- `selected` — `true` if this paper should appear in your "selected papers" highlights, otherwise `false`

A blank example to copy:

```
@inproceedings{SomeUniqueName2026,
    title = {The paper's title},
    author = {Moscati, Marta and Co-author, Name},
    booktitle = {Name of the conference or journal},
    year = {2026},
    bibtex_show = {true},
    selected = {false},
    month = {Month},
    topic = {recommender-systems},
    venue_short = {Short venue name},
    first_author = {true},
}
```

If the paper's topic isn't one of the four listed above, stop and ask for help first — a brand-new topic needs a matching color set up before the Timeline page can show it properly.

## 2. Add a picture for the paper

If you have an image for the paper (a figure, a diagram, a screenshot), put it in the folder `assets/img/publication_preview/`. Any common image format works (`.png`, `.jpg`, etc).

You don't need to connect it to the paper by hand — the next step usually does that automatically, as long as the picture's file name has something in common with the paper's title or short name (for example, `SwapRec.png` for a paper titled "SwapRec: ..."). If the file name doesn't resemble the title at all, see step 4.

## 3. Run the script

From a terminal, in the website's folder, run:

```
python3 bin/sync_bib.py
```

This checks everything and tells you what it did:

- If everything looks good, it fixes the small things automatically (like connecting your picture to the paper) and prints what it changed.
- If something is missing or unclear, it stops and tells you exactly what to fix. It never guesses — if it's not sure, it makes no changes at all.

## 4. If the script asks for help

- **"missing required field(s)"** — go back to `_bibliography/papers.bib` and fill in whatever it lists for that paper.
- **"ambiguous preview match" / "matches multiple entries"** — the picture's name is too similar to more than one paper, or vice versa. Either rename the picture to match the paper's title more closely, or add the line `preview = {your-file-name.png}` to the right paper entry yourself.
- **"has no color defined"** — this is a brand-new topic; get a color set up for it before continuing (see step 1).

## 5. Done

Once the script finishes with no complaints, the new paper will show up on both the Publications page and the Timeline page the next time the website is built.
