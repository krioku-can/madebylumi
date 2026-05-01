# Made by Lumi

Professional portfolio website for Made by Lumi (madebylumi.com) — a web design studio for small businesses.

## Project Files

- `index.html` — Single-page portfolio site (HTML, CSS, JS all embedded)

## Design

- **Colors:** Navy (#1a365d) and Cream (#faf9f6)
- **Framework:** Tailwind CSS via CDN
- **Fonts:** Playfair Display (headings) + Inter (body)
- **Fully responsive** — mobile, tablet, desktop

## Sections

1. **Hero** — Branding, tagline, CTA buttons
2. **About** — Studio description + stats
3. **Services** — Website Design, Branding & Identity, Business Operations, Competitive Research
4. **Case Study** — Ivy & Rose Floral Co.
5. **Process** — Discover → Design → Deliver
6. **Contact** — Email CTA

## Local Development

Open `index.html` in any browser:

```bash
open index.html
```

Or serve with a simple HTTP server:

```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Deployment

### Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from project directory**:
   ```bash
   cd madebylumi
   vercel --prod
   ```

   Or for a new project:
   ```bash
   cd madebylumi
   vercel
   # Follow prompts to set up project
   # Then deploy production: vercel --prod
   ```

4. **Add custom domain** (madebylumi.com):
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select the project
   - Go to Settings → Domains
   - Add `madebylumi.com`
   - Follow DNS instructions to point your domain to Vercel

### Alternative: GitHub + Vercel

1. Push this folder to a GitHub repository
2. Import the repo in [Vercel](https://vercel.com/new)
3. Vercel auto-deploys on every push

### Alternative: Netlify Drop

1. Go to [Netlify Drop](https://app.netlify.com/drop)
2. Drag and drop the `madebylumi` folder
3. Site goes live instantly
4. Add custom domain in site settings

## Notes

- All assets are inline (CSS, JS, SVG icons) — no external dependencies except Tailwind CDN and Google Fonts
- Site is optimized for fast loading and easy deployment
