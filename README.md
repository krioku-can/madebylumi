# Made by Lumi — Website

Source for **https://madebylumi.com**. Custom websites and Lumi Voice for small businesses. Chris Nelloms, Made by Lumi, LLC.

**Live:** https://madebylumi.com
**Deploy:** Vercel project `madebylumi` → production alias `madebylumi.com`

The pages in this repo match the site that was deployed to that project. `offerings.html`, `site.js`, `styles.css`, and `images/` are leftovers from an earlier design. Nothing current links to them. `/offerings.html` redirects to `/websites.html`.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Home |
| `websites.html` | Custom websites |
| `lumi-voice.html` | Lumi Voice |
| `our-work.html` | Ivy & Rose Floral Co. and M. Consulting |
| `about.html` | About Chris |
| `start-a-project.html` | Project brief form |
| `style.css`, `app.js` | Shared styling and page behavior |
| `assets/` | Logo and work photography |
| `api/inquiry.mjs` | Sends a brief to chris@madebylumi.com |

## Start a Project

Submitting the brief `POST`s JSON to `/api/inquiry`. The function checks the fields, then asks [Resend](https://resend.com) to email **chris@madebylumi.com**. The visitor’s address is the reply-to. No mail library is installed; the function uses `fetch`.

That keeps the API key on the server. This repository is public, so the key cannot live in the page or in git. A client-side form host would put a key in the HTML. Resend’s free tier works on Vercel Hobby. The from-address has to be on a domain verified in Resend, which is a one-time DNS step.

Spam controls: a hidden `hp_field` honeypot, and 5 posts per 10 minutes per IP. The limit is stored in memory on that function instance. Hobby has no shared store, so a burst spread across instances can exceed it. The honeypot still applies.

### Environment variables

Add these in **Vercel → project `madebylumi` → Settings → Environment Variables**, for **Production** and **Preview**. Do not put them in git. `RESEND_API_KEY` should be type **Secret**.

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | API key from the Resend dashboard |
| `INQUIRY_FROM` | A verified sender on madebylumi.com, for example `Made by Lumi <inquiries@madebylumi.com>` |

The recipient is fixed in code as `chris@madebylumi.com`. Resend’s shared `onboarding@resend.dev` sender only delivers to the Resend account owner, so it will not reliably reach that inbox.

Add the variables, then deploy again. A deployment does not pick up variables that were added after it was built.

### If the variables are missing, or Resend rejects the send

Nothing is emailed. The API responds with `unavailable` (503) or `send_failed` (502). The page says it didn’t send and links **chris@madebylumi.com**. The brief stays on the page and can still be downloaded. The response does not name the missing variable.

Required fields, checked again on the server: name, email, and the brief (`message`). “I’m thinking about” and timing must be one of the options on the form.

## Content rules

Do not add claims the pages do not already make. In particular, do not promise a response time. Samples on the site that are fictional are labeled that way. Keep them labeled.

## Local check

```bash
node --test
python3 -m http.server 8000
```

The static server shows the page. Sending needs the function, which `node --test` covers with a mocked Resend call. There is no production credential in this repo.

## Deploy

Not part of the inquiry change. When the variables above are set:

```bash
npx vercel --prod --yes
```

If Vercel returns “Not authorized”, retry once, then add `--scope luminelloms-8974s-projects`.
