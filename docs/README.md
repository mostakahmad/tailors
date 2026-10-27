# Tailars docs

These files live in the git repository. Clone the repo on any machine and start here. No chat history, Cursor plan, or local notes are required.

Read in this order:

1. [../README.md](../README.md) — how to run and deploy the static site.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — how the prototype actually works, and what must stay honest.
3. [TRACKER.md](TRACKER.md) — the only work queue. Do the first unchecked item. Update its status in the same commit as the code.

## Resume on a new machine

```bash
git clone <repository-url>
cd tailars-body-scan-demo
python3 -m http.server 8000
node --test tests/
```

Open `http://localhost:8000/`. Do not open `index.html` with `file://`. ES modules will fail.

Then open [TRACKER.md](TRACKER.md) and continue from the first item whose status is `todo`.

## Rules for anyone continuing the work

- This is a static GitHub Pages site. No backend, database, API key, or paid service.
- Keep paths relative. The site must work at `https://USERNAME.github.io/REPOSITORY-NAME/`.
- Do not commit real body photographs.
- Do not claim photograph-based tape measurements. Pose landmarks are joint points only.
- Do not push or rewrite git history unless the repository owner asks.
- When a tracker item is finished, change its status in [TRACKER.md](TRACKER.md) and note the date plus what was verified.
