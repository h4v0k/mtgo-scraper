# Reversion Instructions

## How to Restore the Live Application

When you're ready to take down the under construction page and restore the live application, follow these steps:

### Quick Reversion (Recommended)

```bash
cd /Users/havok/ANTIGRAVITY/mtgo-scraper/client
cp index.html.backup index.html
```

That's it! The next deployment will restore the full application.

### Manual Verification

After reverting, you can verify the backup was restored:

```bash
cd /Users/havok/ANTIGRAVITY/mtgo-scraper/client
head -n 5 index.html
```

You should see the original Vite React app structure with the `<div id="root"></div>` and script tag.

### Deploy to Vercel

After reverting the file locally:

```bash
cd /Users/havok/ANTIGRAVITY/mtgo-scraper
git add client/index.html
git commit -m "Restore live application"
git push
```

Vercel will automatically deploy the restored application.

## What Was Preserved

✅ **All databases** - `mtgo.db` and remote Turso database remain untouched  
✅ **Backend server** - All server files and configurations unchanged  
✅ **API endpoints** - All API routes still functional  
✅ **Environment variables** - All `.env` files preserved  
✅ **Build configuration** - `vercel.json`, `render.yaml` unchanged  

## Files Modified

- `client/index.html` - Replaced with under construction page
- `client/index.html.backup` - Backup of original file (created)
- `REVERSION_INSTRUCTIONS.md` - This file (created)

## Notes

- The under construction page is a standalone HTML file with no dependencies
- It works without the build process (no Vite/React needed)
- All your React components, TypeScript files, and source code remain untouched in `client/src/`
- The backend continues to run normally on Render (if deployed)
