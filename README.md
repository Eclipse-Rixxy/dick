# CloudSINT — OSINT Intelligence Platform

A polished, full-featured OSINT platform built with Next.js 14. Deploy to Vercel in minutes.

## Features

| Module | What it does |
|--------|-------------|
| **Username** | Scans 50+ platforms simultaneously (GitHub, Twitter, Reddit, TikTok, Steam, etc.) |
| **Email** | Validates format, checks MX/SPF/DMARC/DKIM, detects disposable addresses, pattern analysis |
| **Phone** | Country code decode, carrier lookup links (Truecaller, WhoCalledUs), social reverse lookup |
| **IP Address** | Live geolocation, ASN/ISP, reverse DNS, proxy/VPN detection, Shodan link |
| **Domain / DNS** | Full DNS enumeration (A, AAAA, MX, NS, TXT, CNAME, CAA), email security posture, server geo |
| **Discord** | Snowflake decode (account creation date), profile links, avatar CDN |
| **AI Analyst** | Claude-powered OSINT analyst — synthesizes findings, suggests recon vectors |

All results export to **JSON, CSV, or TXT**.

## Deploy to Vercel (5 minutes)

### Option A — Deploy from GitHub

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
4. Click Deploy

### Option B — Deploy with Vercel CLI

```bash
npm install -g vercel
cd cloudsint
vercel
# follow prompts, then:
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local and add your Anthropic API key

# 3. Run dev server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI Analyst only | Get from console.anthropic.com |

The username, email, IP, phone, domain, and Discord modules work without any API keys. They use:
- **Google DNS-over-HTTPS** (`dns.google`) for DNS lookups
- **ipapi.co** for IP geolocation (free tier, no key needed)
- **CORS HEAD requests** for username platform scanning

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Pure CSS (zero dependencies)
- **APIs**: Google DNS-over-HTTPS, ipapi.co, Anthropic Claude
- **Deployment**: Vercel (Edge Runtime for AI route)

## Legal Notice

This tool is for educational and ethical security research purposes only. Only investigate targets you are authorized to examine, or public information about yourself. The developers assume no liability for misuse.
