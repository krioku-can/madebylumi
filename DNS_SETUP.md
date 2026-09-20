# DNS / Domain Setup — madebylumi.com

**Status: COMPLETE (verified 2026-09-20).** Kept as a record of how the domain was wired up. No action outstanding.

| Item | Status |
|------|--------|
| Domain registered (Namecheap) | ✅ done |
| Site deployed to Vercel | ✅ done |
| Domain attached to Vercel project `madebylumi` | ✅ done |
| DNS configured | ✅ done — `https://madebylumi.com` returns 200 |
| `www` redirect | ✅ handled by Vercel |

## How it was configured (Option A — A record, the one used)

Namecheap → Domain List → Manage `madebylumi.com` → **Advanced DNS**:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` | `76.76.21.21` | Automatic |
| CNAME Record | `www` | `cname.vercel-dns.com` | Automatic |

Nameserver alternative (not used): `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.

DNS propagation takes 15–60 minutes; Vercel emails when the domain verifies.

## Live URLs

- **Production:** https://madebylumi.com (alias)
- https://madebylumi.vercel.app
- Direct deployments look like `https://madebylumi-<hash>-luminelloms-8974s-projects.vercel.app`

## Verification

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://madebylumi.com    # expect 200
curl -s https://madebylumi.com | md5                               # compare to local index.html
```

## If the domain ever breaks

1. Confirm the A record still points at `76.76.21.21` (Vercel's anycast IP) in Namecheap.
2. Check the domain is still attached: `npx vercel domains ls` and `npx vercel project inspect madebylumi`.
3. If missing, re-add under Vercel → project `madebylumi` → Settings → Domains, then follow the DNS instructions it prints.
4. Namecheap support: https://www.namecheap.com/support/ · Vercel domains docs: https://vercel.com/docs/domains
