# Cloudflare Worker Setup Guide

## Overview
This guide will help you deploy a Cloudflare Worker to act as a CORS proxy for RSS feeds, solving the CORS errors you're experiencing.

## Prerequisites
- Cloudflare account (free tier is sufficient)
- Domain: `podcast.kaizenmadeeasy.com` (already configured)

## Step 1: Install Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Step 2: Create the Worker

1. **Create worker directory:**
   ```bash
   mkdir podcast-rss-proxy
   cd podcast-rss-proxy
   ```

2. **Initialize the worker:**
   ```bash
   wrangler init podcast-rss-proxy
   ```

3. **Create the files:**

   **`wrangler.toml`:**
   ```toml
   name = "podcast-rss-proxy"
   main = "src/index.js"
   compatibility_date = "2023-12-01"
   
   [vars]
   # Environment variables can be added here
   ```

   **`package.json`:**
   ```json
   {
     "name": "podcast-rss-proxy",
     "version": "1.0.0",
     "description": "Cloudflare Worker for RSS CORS proxy",
     "main": "src/index.js",
     "scripts": {
       "dev": "wrangler dev",
       "deploy": "wrangler deploy"
     },
     "devDependencies": {
       "wrangler": "^3.0.0"
     }
   }
   ```

   **`src/index.js`:** (Copy from the worker file I created)

## Step 3: Deploy the Worker

1. **Test locally (optional):**
   ```bash
   wrangler dev
   ```

2. **Deploy to Cloudflare:**
   ```bash
   wrangler deploy
   ```

3. **Get your worker URL:**
   After deployment, Wrangler will give you a URL like:
   ```
   https://podcast-rss-proxy.your-subdomain.workers.dev
   ```

## Step 4: Configure Custom Domain (Optional but Recommended)

1. **Add custom domain in Cloudflare Dashboard:**
   - Go to Workers & Pages → Your Worker → Triggers → Custom Domains
   - Add: `rss-proxy.podcast.kaizenmadeeasy.com`

2. **Or use a route:**
   - Go to Workers & Pages → Your Worker → Triggers → Routes
   - Add route: `*/rss-proxy/*`

## Step 5: Update Your Frontend

Replace the CORS proxy URLs in your code with your worker URL:

**Before:**
```javascript
const proxies = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors.bridged.cc/',
  'https://proxy.cors.sh/'
]
```

**After:**
```javascript
const proxies = [
  'https://your-worker-url.workers.dev/?url=',
  'https://corsproxy.io/?',  // Keep as fallback
  'https://api.allorigins.win/raw?url='  // Keep as fallback
]
```

## Step 6: Test the Worker

Test your worker with a known RSS feed:

```bash
curl "https://your-worker-url.workers.dev/?url=https://feeds.harvardbusiness.org/harvardbusiness/ideacast"
```

You should get the RSS XML content back with proper CORS headers.

## Security Features

The worker includes:
- **Origin whitelisting** - Only allows requests from your domains
- **URL validation** - Prevents malicious URL usage
- **Content type validation** - Ensures RSS/XML content
- **Rate limiting** - Cloudflare's built-in DDoS protection
- **Caching** - 5-minute cache for better performance

## Troubleshooting

### Common Issues:

1. **CORS errors persist:**
   - Check that your origin is in the `allowedOrigins` array
   - Verify the worker deployed successfully

2. **Worker returns 400 error:**
   - Ensure the `url` parameter is properly encoded
   - Check that the target URL is valid

3. **Worker returns 500 error:**
   - Check the worker logs in Cloudflare Dashboard
   - Verify the target RSS feed is accessible

### Monitoring:

- Check worker logs: `wrangler tail`
- Monitor usage in Cloudflare Dashboard
- Test with different RSS feeds to ensure compatibility

## Cost

- **Free tier:** 100,000 requests per day
- **Paid tier:** $5/month for 10 million requests
- Your podcast app with 31 podcasts syncing every 2-4 hours = ~186-372 requests per day
- **Well within free tier limits**

## Next Steps

1. Deploy the worker using this guide
2. Update your frontend code to use the worker URL
3. Test the RSS sync functionality
4. Monitor for any issues in the first few days

This will permanently solve your CORS issues with a reliable, fast proxy that you control!
