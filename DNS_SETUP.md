# DNS Setup for madebylumi.com

## Status
✅ Domain registered on Namecheap
✅ Site deployed to Vercel: https://madebylumi.vercel.app
✅ Domain added to Vercel project
⏳ DNS configuration needed

## What You Need to Do

### Option A: A Record (Recommended - Easier)

1. **Log into Namecheap** → Go to Domain List → Click "Manage" next to madebylumi.com
2. Go to **Advanced DNS** tab
3. Find the **HOST RECORDS** section
4. Add these records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 76.76.21.21 | Automatic |
| CNAME Record | www | cname.vercel-dns.com | Automatic |

5. Save changes

### Option B: Nameservers (More Complex)

1. In Namecheap, go to **Domain** tab
2. Find **NAMESERVERS** section
3. Select **Custom DNS**
4. Enter Vercel nameservers:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
5. Save changes

## My Recommendation

**Use Option A (A Record)** — it's simpler and you keep control of your DNS through Namecheap.

## Timeline

- DNS changes take **15-60 minutes** to propagate
- Vercel will automatically detect the changes
- You'll get an email from Vercel when the domain is verified

## After Setup

- **madebylumi.com** → Will show your portfolio site
- **www.madebylumi.com** → Will redirect to madebylumi.com

## Current Live URLs (Before DNS)

- https://madebylumi.vercel.app (working now)
- https://madebylumi-iaejejawv-luminelloms-8974s-projects.vercel.app (direct)

## Next Steps

1. Add the A record in Namecheap (5 minutes)
2. Wait for DNS to propagate (15-60 minutes)
3. Test: Visit madebylumi.com in a browser
4. Done!

---

Need help? I can walk you through the Namecheap steps, or you can:
- Namecheap support: https://www.namecheap.com/support/
- Vercel docs: https://vercel.com/docs/concepts/projects/custom-domains
