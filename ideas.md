# Ideas / roadmap

This is a Markdown version of `ideas.txt`, updated to reflect what is currently implemented in the codebase.

Legend:
- `[x]` completed
- `[ ] not started
- `partial` = in progress / partially implemented (not a native checkbox state; noted inline)

---

## Product / platform

- [ ] **Mobile support** *(partial)*
  - Notes:
    - UI uses responsive classes in several places (e.g. `Index.tsx` has `md:hidden` drawers and mobile layouts), but this isn’t a full “mobile-first” pass yet.

- [ ] **Make it into Electron app**
  - Notes:
    - No Electron/Tauri wrapper present.

---

## Camera details / metadata

- [ ] **More details to display about cams** *(partial)*
  - Implemented:
    - `CameraDetailModal` shows extra metadata beyond the original fields:
      - `source`, `network_key`, `access_level`
      - Copy buttons for `image_url` and `page_url`
      - Related cameras:
        - **Same network** (based on derived `network_key`)
        - Fallback **Same location** (country + rounded lat/lon)
    - Files:
      - `src/components/CameraDetailModal.tsx`
      - `src/pages/Index.tsx` (derives `source`, `network_key`, `access_level`)
      - `src/types/camera.ts`

- [x] **Search cams by name/city/country**
  - Implemented:
    - Search in main page filtering (`searchQuery`) and in the browse UI.
  - Files:
    - `src/pages/Index.tsx`
    - `src/components/CommandSearch.tsx`

- [x] **Favorites (star cams) + “favorites” filter**
  - Implemented:
    - `localStorage` persistence (`globecam:favorites`)
    - “Favorites Only” filter + star/unstar in modal.
  - Files:
    - `src/pages/Index.tsx`
    - `src/components/CameraDetailModal.tsx`

- [ ] **Share link to a cam (copy URL) + open to that cam on load** *(partial)*
  - Implemented:
    - Copy share link button in modal.
    - URL param support for opening a cam: `?cam=<id>`
  - Partial / missing:
    - On initial load, `selectedCamera` is derived from `allCameras`, but because `allCameras` loads async, the initial selection may not resolve until after load (needs a follow-up effect).
  - Files:
    - `src/pages/Index.tsx` (URL sync + initial param parsing)
    - `src/components/CameraDetailModal.tsx`

- [ ] **Show camera live/last-updated timestamp + uptime badge**
  - Notes:
    - No timestamp/uptime tracking present.

- [ ] **Show source + license/attribution per cam**
  - Notes:
    - `source` is shown, but no attribution/license mapping is implemented.

---

## Map / globe interactions

- [x] **Map clustering + progressive reveal as you zoom**
  - Implemented:
    - Clustering utilities + visualization logic.
  - Files:
    - `src/utils/clustering.ts`
    - `src/components/GlobeVisualization.tsx`

- [ ] **“Near me” button (use geolocation) + distance sorting**
  - Notes:
    - No `navigator.geolocation` usage found.

- [ ] **Quick sort (closest, newest, most popular)**
  - Notes:
    - Not implemented.

- [ ] **Save filters in URL query params (permalinkable view)** *(partial)*
  - Implemented:
    - `q`, `regions`, `mfr`, and `cam` are synced to URL via `replaceState`.
  - Notes:
    - Works, but could use more polish (e.g. syncing favorites-only, settings, etc.).
  - Files:
    - `src/pages/Index.tsx`

- [ ] **Recent history (last opened cams)** *(partial)*
  - Implemented (data layer):
    - `globecam:recents` is written when selecting a camera.
  - Missing (UI):
    - No UI panel/list to display recents.
  - Files:
    - `src/pages/Index.tsx`

- [x] **Keyboard shortcuts (search focus, next/prev cam)**
  - Implemented:
    - Key handler exists, including:
      - `F` toggles favorite (when a cam is selected)
      - `Ctrl/Cmd+Shift+C` copies share URL (when a cam is selected)
    - There may be additional search-related shortcuts in other components.
  - Files:
    - `src/pages/Index.tsx`

- [ ] **Globe double-click to zoom, smooth inertia toggle**
  - Notes:
    - Not implemented.

- [x] **Performance mode (lower globe quality, fewer points)**
  - Implemented:
    - `maxVisibleNodes` and other performance-related settings are persisted and configurable.
  - Files:
    - `src/pages/Index.tsx`
    - `src/components/SettingsPanel.tsx`
    - `src/components/CesiumGlobe.tsx`

---

## Reliability / UX

- [ ] **Offline-friendly cache for metadata (service worker)**
  - Notes:
    - No service worker detected.

- [ ] **Error states: cam unreachable placeholder + retry** *(partial)*
  - Implemented (partial):
    - Preview image `onError` fallback (“No Signal” SVG).
  - Missing:
    - Explicit retry / status UI.
  - Files:
    - `src/components/CameraDetailModal.tsx`

- [ ] **Loading skeletons for cam detail panel**

- [ ] **Screenshot/share image of current globe view**

- [ ] **Time-of-day filter (if metadata exists) / night-mode**

---

## Content / community

- [x] **Region presets (EU/NA/Asia) + custom regions**
  - Implemented:
    - Regions/continents filtering exists.
  - Notes:
    - If you intended specific *preset buttons* (EU/NA/Asia) beyond the existing continent filters, that may still be a future UI improvement.
  - Files:
    - `src/pages/Index.tsx`
    - `src/components/RegionFilters.tsx`

- [ ] **Multi-select tags (traffic, nature, city, beach, etc.)**

- [ ] **Moderation/report incorrect cam location**

- [ ] **Analytics/debug overlay (fps, points rendered)**
  - Notes:
    - `fps` state exists in `Index.tsx`, but no overlay UI implemented.

---

## More ideas (big backlog)

### Camera data / metadata pipeline

- [ ] **Normalize and dedupe camera entries** (same camera present via multiple sources)
- [ ] **Add canonical camera IDs** derived from provider IDs (not just hash of URLs)
- [ ] **Store provider-specific fields** (provider camera id, provider region, tags)
- [ ] **Add a `last_seen` timestamp** (client-side polling + cache)
- [ ] **Add an `uptime` estimate** (rolling window, per camera)
- [ ] **Add `image_format` / `refresh_interval` metadata** when known
- [ ] **Add `timezone` per camera** (derived from lat/lon)
- [ ] **Mark “static image” vs “MJPEG/stream”** (if detectible)
- [ ] **Detect duplicates by geo + perceptual hash** (pHash on thumbnails)
- [ ] **Detect moved cameras** (same provider id but changed location)

### Camera “status” and health

- [ ] **Live/Offline detection** (track fetch failures / image freshness)
- [ ] **Retry button for broken previews**
- [ ] **Backoff strategy** for repeatedly failing cameras
- [ ] **Show status reason** (timeout, 404, blocked by CORS, etc.)
- [ ] **Per-source health stats** (worldcam vs insecam vs others)
- [ ] **Global incident banner** (e.g. “Provider X is down”)

### Camera detail modal upgrades

- [ ] **Provider camera ID displayed cleanly** (separate from `network_key`)
- [ ] **Show “Related cameras” with confidence labels** (High: same provider id, Medium: same location)
- [ ] **Show distance for same-network results too**
- [ ] **Show camera address guess** via reverse geocoding (optional)
- [ ] **Open preview in a new tab** button
- [ ] **Open on map** button (switch to map mode + zoom to camera)
- [ ] **“Copy coordinates”** button
- [ ] **“Copy camera JSON”** button (for debugging)
- [ ] **Tag chips** (beach/city/traffic/etc.)
- [ ] **Notes per camera** (local-only user annotations)
- [ ] **History timeline** (last opened, last seen online)
- [ ] **Pin this camera** (keep modal open while browsing)
- [ ] **Carousel navigation** (next/prev within related list)

### Search and discovery

- [ ] **Advanced search operators** (e.g. `country:`, `source:`, `mfr:`)
- [ ] **Fuzzy search** with scoring
- [ ] **Search by coordinates** (paste `lat,lon`)
- [ ] **Search by provider ID**
- [ ] **Saved searches** (localStorage)
- [ ] **Smart suggestions** (recent countries, trending regions)
- [ ] **Autocomplete** for countries/cities
- [ ] **Search result pagination / virtualized list**
- [ ] **Random camera** button
- [ ] **“Surprise me” tour mode** (auto-jumps cameras every N seconds)

### Filters and sorting

- [ ] **Sort: closest to me**
- [ ] **Sort: closest to current view center**
- [ ] **Sort: most recently opened**
- [ ] **Sort: provider/source**
- [ ] **Filter by “online only”** (once health tracking exists)
- [ ] **Filter by “has stream” vs “static image”**
- [ ] **Filter by “verified location”**
- [ ] **Filter by time-of-day** (local daylight / nighttime)
- [ ] **Filter by climate/biome** (derived from location)
- [ ] **Filter by language/locale** (derived from country)
- [ ] **Filter by camera type** (traffic, marina, city, ski, etc.)

### “Near me” / geo features

- [ ] **Near me button** (geolocation permission + fallback manual location)
- [ ] **Distance sorting + radius slider**
- [ ] **Draw a circle / polygon filter** on map view
- [ ] **“Near a city”** quick entry (geocode city → coordinates)
- [ ] **Heatmap overlay** of camera density

### Globe / map interaction improvements

- [ ] **Double-click zoom** (globe and map)
- [ ] **Smooth inertia toggle**
- [ ] **Better camera picking** (bigger hit targets, selection priority)
- [ ] **Cluster expand animation** (zoom into cluster on click)
- [ ] **Hover tooltips** for markers
- [ ] **Lasso selection** (select multiple cameras)
- [ ] **Bookmark viewpoints** (save globe camera angles)
- [ ] **Mini-map / overview map**
- [ ] **“Fly to” search result** (smooth camera flight)
- [ ] **Show current view bounds** (debug)

### Performance / rendering

- [ ] **Web worker for clustering**
- [ ] **Virtualize marker updates** (avoid full rebuild on filter changes)
- [ ] **Adaptive quality** (auto lower quality when FPS drops)
- [ ] **OffscreenCanvas** experimentation
- [ ] **Texture cache for thumbnails** (avoid reloading)
- [ ] **Defer non-critical UI** (lazy load heavy panels)
- [ ] **Bundle splitting** (reduce initial JS size)

### Persistence / offline

- [ ] **Service worker caching** for camera JSON and UI shell
- [ ] **Cache thumbnails** (with eviction policy)
- [ ] **Offline mode banner**
- [ ] **Export/import settings** (JSON)
- [ ] **Sync settings across devices** (optional auth)

### UI / UX polish

- [ ] **Loading skeletons** for modal + search results
- [ ] **Empty states** everywhere (favorites empty, no results, no data)
- [ ] **Toasts** for copy actions (share link, coords, URLs)
- [ ] **Accessibility pass** (focus traps, ARIA, keyboard nav)
- [ ] **Reduced motion mode**
- [ ] **Theme switcher** (dark, darker, OLED, light)
- [ ] **Font size / UI scaling**
- [ ] **Onboarding** (first-run hints, keybind cheat sheet)
- [ ] **Changelog modal**

### Sharing / exporting

- [ ] **Screenshot globe view** (canvas capture)
- [ ] **Share image card** (camera preview + metadata + QR)
- [ ] **Share favorite list** (exportable link)
- [ ] **Share a “view preset”** (filters + viewpoint + selected cam)

### Security / privacy

- [ ] **Blur sensitive camera previews** until user clicks “reveal”
- [ ] **Age gate / content warning**
- [ ] **Per-source safety labels**
- [ ] **Blocklist sources** (user setting)
- [ ] **Blocklist countries/regions** (user setting)

### Observability / debugging

- [ ] **Debug overlay toggle** (FPS, markers rendered, memory)
- [ ] **Event log panel** (camera selected, fetch errors)
- [ ] **Provider diagnostics** (counts per source, errors per source)
- [ ] **Feature flags** (enable/disable experimental features)

### Community / moderation

- [ ] **Report incorrect location** (client collects report payload)
- [ ] **Suggest tags for camera**
- [ ] **Vote on tags** (if backend exists)
- [ ] **Flag broken camera**
- [ ] **Curated collections** (Top Beaches, Ski Resorts, City Skylines)

### Architecture / code quality

- [ ] **Centralize camera derivation logic** (dedupe id/network/location key computation)
- [ ] **Add unit tests** for clustering + parsing + key derivation
- [ ] **Type the raw camera JSON** instead of `any`
- [ ] **Introduce a data layer** (query/cache, e.g. TanStack Query)
- [ ] **Add error boundaries** around heavy components
- [ ] **Telemetry opt-in** (local only or remote)

### Desktop packaging

- [ ] **Electron wrapper** (or Tauri)
- [ ] **Auto-updater**
- [ ] **Local file cache** for camera dataset
- [ ] **Global shortcuts** (open search, next camera)

### Fun / “extra” modes

- [ ] **“Night watch” mode** (only cameras where it’s currently night)
- [ ] **“Storm chase” mode** (weather overlay + coastal cams)
- [ ] **“Plane spotter” mode** (airport cams + flight overlays)
- [ ] **“Time-lapse” mode** (sample thumbnails over time)
- [ ] **Ambient soundtrack toggle**
- [ ] **Achievement system** (visit X countries)
