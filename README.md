# Made by Lumi — Website

Source for **https://madebylumi.com** — the Made by Lumi, LLC site. Custom websites and Lumi Voice (a 24/7 AI receptionist).

**Live:** https://madebylumi.com
**Deploy:** Vercel project `madebylumi` → production alias `madebylumi.com`

---

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Home — hero, about, packages, work/case studies, process, contact |
| `offerings.html` | Full pricing catalog (websites, Lumi Voice plans, Presence bundle) |
| `lumi-voice.html` | Lumi Voice product page (features, plans, how-it-works) |
| `images/` | Case-study photography (florals) |
| `favicon.svg` | Site icon |
| `site.js`, `styles.css` | **Unused legacy** — referenced by no current page (all three pages are self-contained: Tailwind CDN + inline styles/scripts). Kept as history only. |

## Design (current, verified against the served HTML)

- **Dark/red theme:** background `#0a0a0a`, primary red `#8B0000` (light `#A52A2A`, bright `#DC143C`, deep `#660000`), grays `#b0b0b0` / `#2a2a2a`
- **Type:** Inter (weights 300–800) from Google Fonts — headings and body
- **Styling:** Tailwind CSS via CDN with a custom `tailwind.config` theme; page-specific CSS inline
- **Layout:** mobile-first; single column on small screens, `md:` grid breakpoints
- **Motion:** scroll-reveal via `IntersectionObserver` plus a 1500 ms safety net that force-reveals anything the observer misses. Reveal elements start **visible** and are hidden only once JS is confirmed active (`.js .reveal`) — so no-JS, print, and SEO readers always see content
- **Aesthetic:** sharp card corners + pill buttons, red glow accents, subtle grid and ambient blur in the hero

> The old Navy (#1a365d) / Cream (#faf9f6) / Playfair Display description was obsolete — the site was redesigned to the dark/red system above.

## Content rules (enforced — do not regress)

This site is held to a strict sourcing standard. The following were **deliberate removals of unsupported marketing claims**; do not reintroduce them:

- No "unlimited revisions" — scoped revisions only (see the Process section)
- No "48h turnaround" claims
- No invented statistics or puff numbers
- Case studies describe **what was actually shipped**, never fabricated results

Client work currently shown: **Ivy & Rose Floral Co.** (site, gallery, custom order form, campaign page) and **EyeWill Training** (booking site with Cal.com, links to the live site).

## Pricing (mirrors `offerings.html` — keep in sync)

**Websites**
- Site Launch — **$750** — custom multi-section site, mobile-first, working contact path
- Site + Infrastructure — **$1,000** — adds domain/email help, booking, handoff docs
- Payment: **50/50** via Stripe, balance on launch

**Lumi Voice** (minutes included; `$0.13/min` overage)
- Lumi Line — **$29/mo** — 200 min
- Lumi Desk — **$49/mo** — 350 min (most chosen)
- Lumi Front Desk — **$79/mo** — 600 min, 2 numbers/routing

**Bundle**
- Presence — **$899 + $49/mo** — Site Launch + Lumi Voice Desk, first month included

## Contact

- Email: **chris@madebylumi.com**
- Phone: **+1 (213) 314-9026** — public business line. The `tel:` hrefs in the HTML are masked; if the number changes, update both the display text and the href.

## Local Development

No build step — the pages are self-contained:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly in a browser also works.

## Deploy

```bash
npx vercel --prod --yes
```

Learned the hard way:
- There is **no committed `.vercel/` link directory** (it is gitignored). Deploys still resolve to project `madebylumi`. If Vercel returns **"Not authorized"**, retry once, then add `--scope luminelloms-8974s-projects`.
- Vercel's static builder automatically **excludes `.env*` files** and `node_modules/`. There is no `.env` here and no page reads environment variables — keep it that way.
- **Verify after deploying:** compare the served HTML against local `index.html` (checksum match).

## Notes

- `~/madebylumi-pr1` and `~/madebylumi-url-fix` (locally) are old Vercel preview projects, not the live site.
- A stale iCloud-synced clone directory was removed on 2026-09-20: it was a zero-byte ghost (most git objects empty, `HEAD`/`config` empty — git could not read it). Its recoverable contents, including a 56KB **earlier version of `index.html`** found nowhere else, were archived locally before deletion. Prefer `git clone` into a fresh path over recreating a clone in place.

## Changelog

`git log` is authoritative. Recent commits:

- `49b7259` fix: home scroll-reveal leaves sections invisible (JS-gated animation + safety net)
- `6e48d6e` feat: add public contact phone
- `5a34744` fix: one look sitewide, add EyeWill, drop puff stats
- `ca8adbd` fix: align home to catalog and drop unsourced claims
