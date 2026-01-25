# Mapbox Token Setup Guide

## Current Issue

The geospatial map is showing an error:

```
Map error: you may have provided an invalid Mapbox access token
```

This is because the current token in the keyring is a placeholder value: `pk.PASTE_YOUR_TOKEN_HERE`

## Solution

You need to set a real Mapbox token.

### Option 1: Using Keyring (Recommended)

1. **Get a Mapbox token:**
   - Visit: https://account.mapbox.com/access-tokens/
   - Sign in or create a free account (no credit card required for basic usage)
   - Copy your default public token (starts with `pk.`)

2. **Set the token in keyring:**

   ```bash
   cd /home/cyclonite01/ShadowCheckStatic
   node scripts/keyring-cli.js set mapbox_token
   ```

   When prompted, paste your Mapbox token

3. **Restart the server:**

   ```bash
   pkill -f "node server/server.js"
   node server/server.js > server.log 2>&1 &
   ```

4. **Verify it's loaded:**

   ```bash
   curl http://localhost:3001/api/mapbox-token | jq .
   ```

   Should return:

   ```json
   {
     "token": "pk.eyJ1Ijoi...",
     "ok": true
   }
   ```

5. **Test the map:**
   - Open: http://localhost:3001/geospatial
   - Map should now load correctly

### Option 2: Using Environment Variable (Quick Test)

If you just want to test quickly:

```bash
cd /home/cyclonite01/ShadowCheckStatic
echo "MAPBOX_TOKEN=pk.YOUR_ACTUAL_TOKEN_HERE" >> .env
pkill -f "node server/server.js"
node server/server.js > server.log 2>&1 &
```

**Note:** Environment variables take precedence over keyring, so if you later want to use keyring, remove this line from `.env`.

## Mapbox Free Tier

Mapbox offers a generous free tier:

- 50,000 map loads per month
- No credit card required
- Perfect for development and small projects

## Troubleshooting

### Token still not working

1. **Check the token format:**
   - Must start with `pk.` (public token)
   - Should be ~100 characters long
   - Example: `pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJja...`

2. **Check server logs:**

   ```bash
   grep "mapbox_token" server.log
   ```

   Should show:

   ```
   [SecretsManager] ✓ mapbox_token loaded from keyring
   ```

3. **Test the API endpoint:**

   ```bash
   curl http://localhost:3001/api/mapbox-token
   ```

   Should return your actual token, not a placeholder

### Map still shows error

1. **Clear browser cache:**
   - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Or open DevTools → Application → Clear storage

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for any Mapbox-related errors
   - Verify the token being used

## Current Status

- ✅ Secrets management configured
- ✅ Keyring setup complete
- ✅ API endpoint working
- ⚠️ **Need real Mapbox token** (currently using placeholder)

Once you set a real token, the geospatial map will work correctly.
