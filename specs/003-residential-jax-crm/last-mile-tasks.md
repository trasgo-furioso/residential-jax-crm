# Last Mile: Frontend Debug Loop

**Purpose**: Properties are not showing on the deployed frontend. The backend IPNS resolution is working (index.json with query_table_cid is accessible), but the frontend renders empty. This requires an autonomous debug loop using Playwright MCP to inspect the browser, identify the failure, fix the code, rebuild, redeploy, and verify — without human intervention.

**Tools**: Playwright MCP (`@playwright/mcp`) for browser automation

**Frontend URL**: https://feature-003-residential-jax-crm.d2nys96ft16522.amplifyapp.com/
**IPNS Key**: k51qzi5uqu5dggq0h9xylfc0kr0kpw7i4zcacnfrymz9sjv7mpeze4femaujcz
**Parquet CID**: QmRttSeJW1raL6BXByxQeMswWncJM9Kp5L844s4EPvgPLD

## Acceptance Criteria (from spec US1)

1. Map centered on Jacksonville/Duval County displays residential properties
2. Properties show as clustered markers at low zoom, individual markers at high zoom
3. Click a marker → detail panel shows parcel ID, address, owner, assessed value, provenance
4. Switch to list view → same properties in sortable table

## Debug Loop Protocol

```
REPEAT (max 5 iterations):
  1. NAVIGATE to frontend URL
  2. SCREENSHOT current state
  3. CHECK browser console for errors (browser_console)
  4. EVALUATE JS to inspect DuckDB state:
     - Is DuckDB-WASM initialized?
     - Did IPNS resolution succeed?
     - Was Parquet URL resolved?
     - How many properties loaded?
     - Any fetch errors?
  5. DIAGNOSE root cause from errors/state
  6. FIX the code (read file → edit → save)
  7. BUILD locally (make build-web)
  8. TEST locally with standalone server (make serve)
  9. VERIFY locally with Playwright (navigate localhost → check properties)
  10. COMMIT + PUSH (git -C ... add/commit/push)
  11. WAIT for Amplify build (make deploy-status, poll)
  12. VERIFY deployed (navigate production URL → screenshot → check properties)
  13. IF properties visible → DONE
  14. IF still broken → LOOP
```

## Tasks

- [ ] LM-01 Configure Playwright MCP in .mcp.json (done)
- [ ] LM-02 Navigate to deployed frontend, take screenshot, capture console errors
- [ ] LM-03 Evaluate browser JS to check DuckDB init state, IPNS resolution, Parquet fetch, properties count
- [ ] LM-04 Diagnose why properties are empty (IPNS fetch fails? Parquet parse fails? GeoJSON conversion fails? Map not receiving data?)
- [ ] LM-05 Fix the root cause in code
- [ ] LM-06 Build and verify locally (make build-web && make serve → Playwright check localhost)
- [ ] LM-07 Commit, push, wait for Amplify deploy
- [ ] LM-08 Verify deployed frontend shows properties on map
- [ ] LM-09 If still broken, repeat LM-02 through LM-08 (max 5 iterations)

## Key Files to Inspect/Fix

- `apps/web/src/lib/duckdb.ts` — IPNS resolution, DuckDB-WASM init, Parquet loading, GeoJSON conversion
- `apps/web/src/app/page.tsx` — property data loading in useEffect, state management
- `apps/web/src/components/map/PropertyMap.tsx` — GeoJSON source, cluster layer, marker rendering
- `apps/web/src/components/properties/PropertyList.tsx` — property array display

## Diagnostic JS Snippets (for browser_evaluate)

```javascript
// Check if DuckDB module loaded
typeof window !== 'undefined' && document.querySelector('[data-loading]')?.textContent

// Check console errors (look for CORS, fetch, DuckDB errors)
// Use browser_console tool

// Check network requests for Parquet/IPNS
performance.getEntriesByType('resource').filter(r => r.name.includes('ipfs') || r.name.includes('ipns') || r.name.includes('parquet')).map(r => ({url: r.name, status: r.responseStatus, duration: r.duration}))

// Check React state (if exposed)
document.querySelectorAll('[class*="map"]').length
document.querySelectorAll('[class*="property"]').length
document.querySelectorAll('table tr').length
```
