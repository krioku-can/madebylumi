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
| `api/forward-inquiry.mjs` | Forwards a client site's form notifications to several inboxes |

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

## Form forwarding for client sites

Some client sites (Squarespace) can send each form's notification to only one address. `api/forward-inquiry.mjs` fans that one notification out to several inboxes.

1. The client's form sends its notification to a Resend receiving address (the account's `<id>.resend.app` address, no DNS needed).
2. Resend posts an `email.received` webhook to `https://madebylumi.com/api/forward-inquiry`.
3. The function checks the webhook signature, reads the full email from Resend, checks the sender is on the route's list and that SPF or DKIM passed, then sends one copy to every recipient on the route. Reply-to is the person who filled in the form.
4. The Resend email id is the idempotency key, so a retried webhook does not send a second copy within 24 hours.

If anything stops a copy, the function sends a short note (no client content) to `FORWARD_ALERT_TO`. Send failures return 502, so Resend retries the webhook on its own schedule. The original stays in Resend under Emails → Receiving.

Client addresses are not in this repo. They live in `FORWARD_ROUTES`:

| Name | Value |
|------|--------|
| `RESEND_WEBHOOK_SECRET` | Signing secret of the `email.received` webhook (`whsec_...`). Secret. |
| `RESEND_RECEIVING_KEY` | Resend key that can read received emails (full access). Secret. |
| `FORWARD_ROUTES` | JSON list: `[{"inbound":"client@<id>.resend.app","to":["a@client.com","b@client.com"],"from":"Client Website <inquiries@madebylumi.com>","senders":["form-submission@squarespace.info"]}]` |
| `FORWARD_ALERT_TO` | Where failure notes go, for example `chris@madebylumi.com` |

`RESEND_API_KEY` (above) sends the copies.

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
