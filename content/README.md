# content/

Everything the site says lives here. Edit these files directly, or through `/admin`.

| file | drives |
|---|---|
| `profile.json` | identity, contact, availability, principles |
| `projects.json` | `/work` and every case study |
| `decisions.json` | `/decisions` — architecture decision records |
| `timeline.json` | `/resume` and `/about` |
| `skills.json` | the technology nodes in `/graph` |
| `routine.json` | the live dial on `/day` |
| `craft.json` | titles and blurbs for the `/craft` simulations |
| `deltas.json` | `/growth` — written automatically by résumé ingest |

The `/ask` corpus and the `/graph` entities are both derived from these at request
time, so they can never fall out of sync. Adding a project makes it searchable and
puts it on the graph immediately.

## Fields worth your attention

**`projects[].wentWrong`** — empty on every project. The section only renders when it
has content, and it is the single highest-value thing you can add. A list of successes
tells someone what you finished; the failures show how you reason. Pick one real
misjudgement per project and name it specifically.

**`projects[].tradeoffs`** — seeded from the résumé. The cost you accepted, not the win
you got. Already the most quoted part of a case study in an interview.

**`decisions[].alternatives`** — the options you rejected and why. Your résumé says you
document these; this is where they live.

**`routine.json`** — blocks are declared, free time is derived. Any minute no block
covers renders as an unclaimed gap on the dial. Don't add filler blocks to hide gaps;
the honesty is the point. `24:00` is a legal end time and means midnight.
