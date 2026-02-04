import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParallaxProvider } from '@/components/ParallaxProvider';
import { CesiumGlobe, type CesiumGlobeRef } from '@/components/CesiumGlobe';
import { Header } from '@/components/Header';
import { StatsDisplay } from '@/components/StatsDisplay';
import { LiveActivityIndicator } from '@/components/LiveActivityIndicator';
import { QuickFilters } from '@/components/QuickFilters';
import { RegionFilters } from '@/components/RegionFilters';
import { CommandSearch } from '@/components/CommandSearch';
import { CameraDetailModal } from '@/components/CameraDetailModal';
import { toast } from '@/components/ui/sonner';
import { SettingsPanel } from '@/components/SettingsPanel';
import { OSINTBoard } from '@/components/OSINTBoard';
import { Cartesian2, Math as CesiumMath } from 'cesium';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  ScanLinesOverlay,
  VignetteOverlay,
  CornerDecorations
} from '@/components/VisualOverlays';
import { CameraData } from '@/types/camera';
import { Layers, Search, Sliders, X, Star, Compass } from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'globecam:favorites';
const RECENTS_STORAGE_KEY = 'globecam:recents';
const SETTINGS_STORAGE_KEY = 'globecam:settings';
const CAMERA_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CAMERA_DATA_CACHE_VERSION = 2;

const CAMERA_DATA_IDB_DB = 'globecam';
const CAMERA_DATA_IDB_STORE = 'cache';
const CAMERA_DATA_IDB_KEY = 'camera_data';

type CameraDataCacheRecord = {
  v: number;
  ts: number;
  etag: string | null;
  data: any[];
};

function openCameraCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(CAMERA_DATA_IDB_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CAMERA_DATA_IDB_STORE)) {
          db.createObjectStore(CAMERA_DATA_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function readCameraDataCache(): Promise<CameraDataCacheRecord | null> {
  try {
    const db = await openCameraCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(CAMERA_DATA_IDB_STORE, 'readonly');
      const store = tx.objectStore(CAMERA_DATA_IDB_STORE);
      const req = store.get(CAMERA_DATA_IDB_KEY);
      req.onsuccess = () => {
        const val = req.result as CameraDataCacheRecord | undefined;
        if (!val || typeof val !== 'object') return resolve(null);
        if ((val as any).v !== CAMERA_DATA_CACHE_VERSION) return resolve(null);
        if (typeof (val as any).ts !== 'number') return resolve(null);
        if (Date.now() - (val as any).ts > CAMERA_DATA_CACHE_TTL_MS) return resolve(null);
        if (!Array.isArray((val as any).data)) return resolve(null);
        resolve(val);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
      tx.onabort = () => db.close();
    });
  } catch {
    return null;
  }
}

async function writeCameraDataCache(next: CameraDataCacheRecord): Promise<void> {
  try {
    const db = await openCameraCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(CAMERA_DATA_IDB_STORE, 'readwrite');
      const store = tx.objectStore(CAMERA_DATA_IDB_STORE);
      store.put(next, CAMERA_DATA_IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

async function fetchCameraData(etag: string | null): Promise<{ status: 'ok'; data: any[]; etag: string | null } | { status: 'not_modified'; etag: string | null }> {
  const isDev = import.meta.env.DEV;
  const res = await fetch('/camera_data.min.v2.json', {
    cache: isDev ? 'no-store' : 'force-cache',
    headers: {
      Accept: 'application/json',
      ...(etag ? { 'If-None-Match': etag } : {}),
    },
  });
  if (res.status === 304) {
    return { status: 'not_modified', etag: res.headers.get('ETag') ?? etag };
  }
  if (!res.ok) {
    throw new Error(`Failed to load camera data (${res.status})`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error('Camera data JSON is not an array');
  }
  return { status: 'ok', data: json, etag: res.headers.get('ETag') };
}

function readStringArrayStorage(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed;
    return [];
  } catch {
    return [];
  }

}

function readSettingsStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeSettingsStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function writeStringArrayStorage(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => decodeURIComponent(v.trim()))
    .filter(Boolean);
}

function serializeCsvParam(values: string[]): string {
  return values.map((v) => encodeURIComponent(v)).join(',');
}

function parseBoolParam(value: string | null): boolean | null {
  if (value === null) return null;
  const v = value.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

function parseNumberParam(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Helper function to determine continent from country - EXPANDED for maximum coverage
function getContinent(country: string): string {
  if (!country) return 'Other';

  // Normalize the country name for matching
  const normalized = country.trim().toLowerCase();

  const continentMap: Record<string, string> = {
    // ==================== NORTH AMERICA ====================
    'united states': 'North America',
    'united states of america': 'North America',
    'usa': 'North America',
    'us': 'North America',
    'u.s.': 'North America',
    'u.s.a.': 'North America',
    'america': 'North America',
    'canada': 'North America',
    'mexico': 'North America',
    'méxico': 'North America',
    'guatemala': 'North America',
    'honduras': 'North America',
    'el salvador': 'North America',
    'nicaragua': 'North America',
    'costa rica': 'North America',
    'panama': 'North America',
    'panamá': 'North America',
    'belize': 'North America',
    'cuba': 'North America',
    'jamaica': 'North America',
    'haiti': 'North America',
    'haïti': 'North America',
    'dominican republic': 'North America',
    'república dominicana': 'North America',
    'bahamas': 'North America',
    'the bahamas': 'North America',
    'trinidad and tobago': 'North America',
    'barbados': 'North America',
    'grenada': 'North America',
    'saint lucia': 'North America',
    'st. lucia': 'North America',
    'st lucia': 'North America',
    'saint vincent and the grenadines': 'North America',
    'st. vincent': 'North America',
    'antigua and barbuda': 'North America',
    'dominica': 'North America',
    'saint kitts and nevis': 'North America',
    'st. kitts and nevis': 'North America',
    'puerto rico': 'North America',
    'virgin islands': 'North America',
    'u.s. virgin islands': 'North America',
    'british virgin islands': 'North America',
    'cayman islands': 'North America',
    'bermuda': 'North America',
    'turks and caicos': 'North America',
    'turks and caicos islands': 'North America',
    'aruba': 'North America',
    'curaçao': 'North America',
    'curacao': 'North America',
    'sint maarten': 'North America',
    'saint martin': 'North America',
    'st. martin': 'North America',
    'martinique': 'North America',
    'guadeloupe': 'North America',
    'greenland': 'North America',
    'anguilla': 'North America',
    'montserrat': 'North America',
    'saint barthélemy': 'North America',
    'st. barts': 'North America',
    'bonaire': 'North America',
    'saba': 'North America',
    'sint eustatius': 'North America',

    // ==================== SOUTH AMERICA ====================
    'brazil': 'South America',
    'brasil': 'South America',
    'argentina': 'South America',
    'chile': 'South America',
    'colombia': 'South America',
    'peru': 'South America',
    'perú': 'South America',
    'venezuela': 'South America',
    'ecuador': 'South America',
    'bolivia': 'South America',
    'paraguay': 'South America',
    'uruguay': 'South America',
    'guyana': 'South America',
    'suriname': 'South America',
    'french guiana': 'South America',
    'guyane': 'South America',
    'falkland islands': 'South America',
    'islas malvinas': 'South America',

    // ==================== EUROPE ====================
    'united kingdom': 'Europe',
    'uk': 'Europe',
    'u.k.': 'Europe',
    'great britain': 'Europe',
    'britain': 'Europe',
    'england': 'Europe',
    'scotland': 'Europe',
    'wales': 'Europe',
    'northern ireland': 'Europe',
    'germany': 'Europe',
    'deutschland': 'Europe',
    'france': 'Europe',
    'italy': 'Europe',
    'italia': 'Europe',
    'spain': 'Europe',
    'españa': 'Europe',
    'netherlands': 'Europe',
    'the netherlands': 'Europe',
    'holland': 'Europe',
    'belgium': 'Europe',
    'belgique': 'Europe',
    'belgië': 'Europe',
    'switzerland': 'Europe',
    'schweiz': 'Europe',
    'suisse': 'Europe',
    'svizzera': 'Europe',
    'austria': 'Europe',
    'österreich': 'Europe',
    'poland': 'Europe',
    'polska': 'Europe',
    'romania': 'Europe',
    'românia': 'Europe',
    'czech republic': 'Europe',
    'czechia': 'Europe',
    'česko': 'Europe',
    'hungary': 'Europe',
    'magyarország': 'Europe',
    'sweden': 'Europe',
    'sverige': 'Europe',
    'norway': 'Europe',
    'norge': 'Europe',
    'denmark': 'Europe',
    'danmark': 'Europe',
    'finland': 'Europe',
    'suomi': 'Europe',
    'russia': 'Europe',
    'russian federation': 'Europe',
    'россия': 'Europe',
    'ukraine': 'Europe',
    'україна': 'Europe',
    'portugal': 'Europe',
    'greece': 'Europe',
    'ελλάδα': 'Europe',
    'hellas': 'Europe',
    'ireland': 'Europe',
    'éire': 'Europe',
    'republic of ireland': 'Europe',
    'iceland': 'Europe',
    'ísland': 'Europe',
    'croatia': 'Europe',
    'hrvatska': 'Europe',
    'serbia': 'Europe',
    'србија': 'Europe',
    'bulgaria': 'Europe',
    'българия': 'Europe',
    'slovakia': 'Europe',
    'slovensko': 'Europe',
    'slovenia': 'Europe',
    'slovenija': 'Europe',
    'lithuania': 'Europe',
    'lietuva': 'Europe',
    'latvia': 'Europe',
    'latvija': 'Europe',
    'estonia': 'Europe',
    'eesti': 'Europe',
    'bosnia and herzegovina': 'Europe',
    'bosnia': 'Europe',
    'bosna i hercegovina': 'Europe',
    'albania': 'Europe',
    'shqipëri': 'Europe',
    'north macedonia': 'Europe',
    'macedonia': 'Europe',
    'северна македонија': 'Europe',
    'montenegro': 'Europe',
    'crna gora': 'Europe',
    'luxembourg': 'Europe',
    'lëtzebuerg': 'Europe',
    'malta': 'Europe',
    'cyprus': 'Europe',
    'κύπρος': 'Europe',
    'kypros': 'Europe',
    'belarus': 'Europe',
    'беларусь': 'Europe',
    'moldova': 'Europe',
    'monaco': 'Europe',
    'liechtenstein': 'Europe',
    'san marino': 'Europe',
    'vatican city': 'Europe',
    'vatican': 'Europe',
    'holy see': 'Europe',
    'andorra': 'Europe',
    'kosovo': 'Europe',
    'косово': 'Europe',
    'faroe islands': 'Europe',
    'føroyar': 'Europe',
    'gibraltar': 'Europe',
    'isle of man': 'Europe',
    'jersey': 'Europe',
    'guernsey': 'Europe',
    'åland islands': 'Europe',
    'aland': 'Europe',
    'svalbard': 'Europe',

    // ==================== ASIA ====================
    'china': 'Asia',
    'peoples republic of china': 'Asia',
    "people's republic of china": 'Asia',
    '中国': 'Asia',
    'zhongguo': 'Asia',
    'japan': 'Asia',
    '日本': 'Asia',
    'nippon': 'Asia',
    'nihon': 'Asia',
    'india': 'Asia',
    'भारत': 'Asia',
    'bharat': 'Asia',
    'south korea': 'Asia',
    'korea': 'Asia',
    'republic of korea': 'Asia',
    '대한민국': 'Asia',
    '한국': 'Asia',
    'indonesia': 'Asia',
    'thailand': 'Asia',
    'ประเทศไทย': 'Asia',
    'vietnam': 'Asia',
    'viet nam': 'Asia',
    'việt nam': 'Asia',
    'malaysia': 'Asia',
    'singapore': 'Asia',
    'philippines': 'Asia',
    'pilipinas': 'Asia',
    'taiwan': 'Asia',
    '台灣': 'Asia',
    'republic of china': 'Asia',
    'pakistan': 'Asia',
    'پاکستان': 'Asia',
    'bangladesh': 'Asia',
    'বাংলাদেশ': 'Asia',
    'myanmar': 'Asia',
    'burma': 'Asia',
    'cambodia': 'Asia',
    'kampuchea': 'Asia',
    'laos': 'Asia',
    "lao people's democratic republic": 'Asia',
    'nepal': 'Asia',
    'sri lanka': 'Asia',
    'ceylon': 'Asia',
    'afghanistan': 'Asia',
    'kazakhstan': 'Asia',
    'қазақстан': 'Asia',
    'uzbekistan': 'Asia',
    'oʻzbekiston': 'Asia',
    'turkmenistan': 'Asia',
    'kyrgyzstan': 'Asia',
    'кыргызстан': 'Asia',
    'tajikistan': 'Asia',
    'тоҷикистон': 'Asia',
    'mongolia': 'Asia',
    'монгол улс': 'Asia',
    'north korea': 'Asia',
    "democratic people's republic of korea": 'Asia',
    'dprk': 'Asia',
    'brunei': 'Asia',
    'brunei darussalam': 'Asia',
    'bhutan': 'Asia',
    'maldives': 'Asia',
    'timor-leste': 'Asia',
    'east timor': 'Asia',
    'hong kong': 'Asia',
    '香港': 'Asia',
    'macau': 'Asia',
    'macao': 'Asia',
    '澳門': 'Asia',

    // Middle East (part of Asia)
    'saudi arabia': 'Asia',
    'kingdom of saudi arabia': 'Asia',
    'ksa': 'Asia',
    'united arab emirates': 'Asia',
    'uae': 'Asia',
    'u.a.e.': 'Asia',
    'emirates': 'Asia',
    'dubai': 'Asia',
    'abu dhabi': 'Asia',
    'israel': 'Asia',
    'ישראל': 'Asia',
    'jordan': 'Asia',
    'الأردن': 'Asia',
    'lebanon': 'Asia',
    'لبنان': 'Asia',
    'syria': 'Asia',
    'syrian arab republic': 'Asia',
    'سوريا': 'Asia',
    'iraq': 'Asia',
    'العراق': 'Asia',
    'iran': 'Asia',
    'islamic republic of iran': 'Asia',
    'persia': 'Asia',
    'ایران': 'Asia',
    'turkey': 'Asia',
    'türkiye': 'Asia',
    'turkiye': 'Asia',
    'yemen': 'Asia',
    'اليمن': 'Asia',
    'oman': 'Asia',
    'عمان': 'Asia',
    'kuwait': 'Asia',
    'الكويت': 'Asia',
    'qatar': 'Asia',
    'قطر': 'Asia',
    'bahrain': 'Asia',
    'البحرين': 'Asia',
    'palestine': 'Asia',
    'palestinian territories': 'Asia',
    'state of palestine': 'Asia',
    'فلسطين': 'Asia',
    'gaza': 'Asia',
    'west bank': 'Asia',
    'armenia': 'Asia',
    'հայdelays': 'Asia',
    'hayastan': 'Asia',
    'azerbaijan': 'Asia',
    'azərbaycan': 'Asia',
    'georgia': 'Asia',
    'საქართველო': 'Asia',
    'sakartvelo': 'Asia',

    // ==================== AFRICA ====================
    'south africa': 'Africa',
    'rsa': 'Africa',
    'egypt': 'Africa',
    'مصر': 'Africa',
    'misr': 'Africa',
    'nigeria': 'Africa',
    'kenya': 'Africa',
    'ethiopia': 'Africa',
    'ኢትዮጵያ': 'Africa',
    'ghana': 'Africa',
    'tanzania': 'Africa',
    'uganda': 'Africa',
    'algeria': 'Africa',
    'الجزائر': 'Africa',
    'morocco': 'Africa',
    'المغرب': 'Africa',
    'maroc': 'Africa',
    'angola': 'Africa',
    'mozambique': 'Africa',
    'moçambique': 'Africa',
    'madagascar': 'Africa',
    'cameroon': 'Africa',
    'cameroun': 'Africa',
    'ivory coast': 'Africa',
    "côte d'ivoire": 'Africa',
    'cote divoire': 'Africa',
    'niger': 'Africa',
    'burkina faso': 'Africa',
    'mali': 'Africa',
    'malawi': 'Africa',
    'zambia': 'Africa',
    'somalia': 'Africa',
    'الصومال': 'Africa',
    'senegal': 'Africa',
    'sénégal': 'Africa',
    'chad': 'Africa',
    'tchad': 'Africa',
    'تشاد': 'Africa',
    'zimbabwe': 'Africa',
    'guinea': 'Africa',
    'guinée': 'Africa',
    'rwanda': 'Africa',
    'benin': 'Africa',
    'bénin': 'Africa',
    'tunisia': 'Africa',
    'tunisie': 'Africa',
    'تونس': 'Africa',
    'burundi': 'Africa',
    'south sudan': 'Africa',
    'togo': 'Africa',
    'sierra leone': 'Africa',
    'libya': 'Africa',
    'ليبيا': 'Africa',
    'liberia': 'Africa',
    'mauritania': 'Africa',
    'موريتانيا': 'Africa',
    'eritrea': 'Africa',
    'gambia': 'Africa',
    'the gambia': 'Africa',
    'botswana': 'Africa',
    'namibia': 'Africa',
    'gabon': 'Africa',
    'lesotho': 'Africa',
    'guinea-bissau': 'Africa',
    'guiné-bissau': 'Africa',
    'equatorial guinea': 'Africa',
    'guinea ecuatorial': 'Africa',
    'mauritius': 'Africa',
    'eswatini': 'Africa',
    'swaziland': 'Africa',
    'djibouti': 'Africa',
    'comoros': 'Africa',
    'comores': 'Africa',
    'cape verde': 'Africa',
    'cabo verde': 'Africa',
    'sao tome and principe': 'Africa',
    'são tomé and príncipe': 'Africa',
    'seychelles': 'Africa',
    'sudan': 'Africa',
    'السودان': 'Africa',
    'congo': 'Africa',
    'republic of the congo': 'Africa',
    'congo-brazzaville': 'Africa',
    'democratic republic of the congo': 'Africa',
    'drc': 'Africa',
    'dr congo': 'Africa',
    'congo-kinshasa': 'Africa',
    'zaire': 'Africa',
    'central african republic': 'Africa',
    'république centrafricaine': 'Africa',
    'car': 'Africa',
    'reunion': 'Africa',
    'réunion': 'Africa',
    'mayotte': 'Africa',
    'western sahara': 'Africa',
    'somaliland': 'Africa',

    // ==================== OCEANIA ====================
    'australia': 'Oceania',
    'new zealand': 'Oceania',
    'aotearoa': 'Oceania',
    'papua new guinea': 'Oceania',
    'png': 'Oceania',
    'fiji': 'Oceania',
    'solomon islands': 'Oceania',
    'vanuatu': 'Oceania',
    'samoa': 'Oceania',
    'western samoa': 'Oceania',
    'american samoa': 'Oceania',
    'kiribati': 'Oceania',
    'micronesia': 'Oceania',
    'federated states of micronesia': 'Oceania',
    'fsm': 'Oceania',
    'tonga': 'Oceania',
    'palau': 'Oceania',
    'marshall islands': 'Oceania',
    'nauru': 'Oceania',
    'tuvalu': 'Oceania',
    'new caledonia': 'Oceania',
    'nouvelle-calédonie': 'Oceania',
    'french polynesia': 'Oceania',
    'polynésie française': 'Oceania',
    'tahiti': 'Oceania',
    'guam': 'Oceania',
    'northern mariana islands': 'Oceania',
    'cook islands': 'Oceania',
    'niue': 'Oceania',
    'tokelau': 'Oceania',
    'wallis and futuna': 'Oceania',
    'norfolk island': 'Oceania',
    'christmas island': 'Oceania',
    'cocos islands': 'Oceania',
    'cocos (keeling) islands': 'Oceania',
    'pitcairn islands': 'Oceania',
  };

  // Try exact match first (case-insensitive)
  if (continentMap[normalized]) {
    return continentMap[normalized];
  }

  // Try matching by checking if the normalized country starts with or contains known keys
  for (const [key, continent] of Object.entries(continentMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return continent;
    }
  }

  return 'Other';
}

// Get camera statistics
function getCameraStats(cameras: CameraData[]) {
  const byContinent: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  cameras.forEach(cam => {
    byContinent[cam.continent] = (byContinent[cam.continent] || 0) + 1;
    byCountry[cam.country] = (byCountry[cam.country] || 0) + 1;
  });

  return {
    total: cameras.length,
    byContinent,
    byCountry,
    online: Math.floor(cameras.length * 0.94),
  };
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeCameraId(cam: any, index: number): string {
  const page = typeof cam?.page_url === 'string' ? cam.page_url : '';
  const image = typeof cam?.image_url === 'string' ? cam.image_url : '';
  const key = `${page}|${image}`;
  if (key !== '|') return `cam-${fnv1a32(key)}`;
  return `cam-${String(index).padStart(5, '0')}`;
}

function computeNetworkKey(cam: any): string | null {
  const page = typeof cam?.page_url === 'string' ? cam.page_url : '';
  const image = typeof cam?.image_url === 'string' ? cam.image_url : '';
  const source = typeof cam?.source === 'string' ? cam.source : '';

  const url = page || image;
  if (!url) return null;

  const src = (source || 'unknown').toLowerCase();

  const normalized = (v: string) => v.replace(/\/+$/, '');

  // Try to extract a per-camera identifier from known providers.
  // The returned key is *canonical* (based on URL host), so duplicates across sources can match.
  // This intentionally avoids grouping by hostname alone.
  const extractCanonicalKey = (u: URL): string | null => {
    const host = u.hostname.toLowerCase();

    // worldcam.eu: .../<id>-<slug>
    // Example: https://worldcam.eu/webcams/.../35075-athens-i65-hwy72
    if (host.endsWith('worldcam.eu')) {
      const m = u.pathname.match(/\/(\d{3,})-[^/]+$/);
      if (m?.[1]) return `worldcam:${m[1]}`;
      return `worldcam:${host}${normalized(u.pathname)}`;
    }

    // insecam / worldcam.pl: numeric ID often present in path or filename
    if (host.endsWith('worldcam.pl') || host.endsWith('insecam.org')) {
      const m = u.pathname.match(/\/(\d{3,})(?:\.[a-zA-Z]+)?$/);
      if (m?.[1]) return `insecam:${m[1]}`;
      return `insecam:${host}${normalized(u.pathname)}`;
    }

    // worldviewstream.com: slug-based pages are typically per-camera.
    if (host.endsWith('worldviewstream.com')) {
      const slug = u.pathname.split('/').filter(Boolean).pop();
      if (slug) return `worldviewstream:${slug}`;
      return `worldviewstream:${host}${normalized(u.pathname)}`;
    }

    return null;
  };

  // Fallback: use full host+path (stricter than host-only), stripped of query/hash.
  const hostPathKey = (u: URL) => `${u.hostname.toLowerCase()}${normalized(u.pathname)}`;

  try {
    const u = new URL(url);
    const canonical = extractCanonicalKey(u);
    if (canonical) return canonical;

    // Unknown providers: namespace by source to avoid accidental cross-provider collisions.
    return `${src}:${hostPathKey(u)}`;
  } catch {
    // If URL parsing fails, fallback to a normalized raw string.
    return `${src}:${normalized(url)}`;
  }
}

export default function Index() {
  const globeRef = useRef<CesiumGlobeRef | null>(null);
  const didInitialUrlSync = useRef(false);
  const [navState, setNavState] = useState<{ headingDegrees: number; pitchDegrees: number } | null>(null);
  const [cameraDataRaw, setCameraDataRaw] = useState<any[] | null>(null);
  const [cameraDataError, setCameraDataError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    if (typeof window === 'undefined') return;
    readCameraDataCache().then((cached) => {
      if (canceled) return;
      if (!cached?.data) return;
      setCameraDataRaw(cached.data);
    });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    let cachedEtag: string | null = null;
    if (typeof window !== 'undefined') {
      readCameraDataCache().then((cached) => {
        cachedEtag = cached?.etag ?? null;
        fetchCameraData(cachedEtag)
          .then((res) => {
            if (abort.signal.aborted) return;
            if (res.status === 'not_modified') {
              if (cachedEtag !== (res.etag ?? null)) {
                readCameraDataCache().then((existing) => {
                  if (abort.signal.aborted) return;
                  if (!existing) return;
                  writeCameraDataCache({ ...existing, etag: res.etag ?? existing.etag });
                });
              }
              return;
            }
            void writeCameraDataCache({
              v: CAMERA_DATA_CACHE_VERSION,
              ts: Date.now(),
              etag: res.etag ?? null,
              data: res.data,
            });
            setCameraDataRaw(res.data);
          })
          .catch((err) => {
            if (abort.signal.aborted) return;
            if (!cameraDataRaw) {
              setCameraDataError(err instanceof Error ? err.message : 'Failed to load camera data');
            }
          });
      });
    }

    if (typeof window === 'undefined') {
      fetchCameraData(null)
        .then((res) => {
          if (abort.signal.aborted) return;
          if (res.status === 'ok') setCameraDataRaw(res.data);
        })
        .catch((err) => {
          if (abort.signal.aborted) return;
          setCameraDataError(err instanceof Error ? err.message : 'Failed to load camera data');
        });
    }

    return () => {
      abort.abort();
    };
  }, [cameraDataRaw]);

  // Load and process cameras from JSON
  const allCameras = useMemo(() => {
    if (!cameraDataRaw) return [] as CameraData[];
    return (cameraDataRaw as any[]).map((cam: any, index: number) => ({
      id: computeCameraId(cam, index),
      latitude: cam.latitude,
      longitude: cam.longitude,
      continent: getContinent(cam.country),
      country: cam.country,
      city: cam.city,
      region: cam.region,
      manufacturer: cam.manufacturer,
      image_url: cam.image_url,
      page_url: cam.page_url
      ,
      source: typeof cam?.source === 'string' ? cam.source : undefined,
      network_key: computeNetworkKey(cam) ?? undefined,
      access_level: typeof cam?.source === 'string' && cam.source.toLowerCase() === 'insecam' ? 'restricted' : 'public'
    })) as CameraData[];
  }, [cameraDataRaw]);

  const initialQueryParams = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search);
  }, []);

  const initialSelectedRegions = useMemo(() => {
    return parseCsvParam(initialQueryParams?.get('regions') ?? null);
  }, [initialQueryParams]);

  const initialSelectedManufacturers = useMemo(() => {
    return parseCsvParam(initialQueryParams?.get('mfr') ?? null);
  }, [initialQueryParams]);

  const initialSearchQuery = useMemo(() => {
    return initialQueryParams?.get('q') ?? '';
  }, [initialQueryParams]);

  const initialSelectedCameraId = useMemo(() => {
    return initialQueryParams?.get('cam') ?? null;
  }, [initialQueryParams]);

  const initialSortMode = useMemo(() => {
    const raw = initialQueryParams?.get('sort') ?? null;
    if (raw === 'closest_me' || raw === 'closest_view' || raw === 'recent') return raw;
    return 'none';
  }, [initialQueryParams]);

  const initialNearEnabled = useMemo(() => {
    return parseBoolParam(initialQueryParams?.get('near') ?? null) ?? false;
  }, [initialQueryParams]);

  const initialNearRadiusKm = useMemo(() => {
    const v = parseNumberParam(initialQueryParams?.get('radius') ?? null);
    return typeof v === 'number' ? Math.max(1, Math.min(20000, v)) : 250;
  }, [initialQueryParams]);

  const stats = useMemo(() => getCameraStats(allCameras), [allCameras]);
  const maxVisibleNodesMax = Math.max(500, Math.min(5000, allCameras.length));

  const persistedSettings = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readSettingsStorage<any>(SETTINGS_STORAGE_KEY, null);
  }, []);

  const [selectedRegions, setSelectedRegions] = useState<string[]>(initialSelectedRegions);
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(() => {
    if (!initialSelectedCameraId) return null;
    return allCameras.find((c) => c.id === initialSelectedCameraId) ?? null;
  });
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(initialSelectedManufacturers);
  const [currentRotation, setCurrentRotation] = useState<[number, number] | null>(null);
  const [viewCenterLonLat, setViewCenterLonLat] = useState<[number, number] | null>(null);
  const [currentProgress, setCurrentProgress] = useState(100);
  const [fps, setFps] = useState(60);
  const [isConnected, setIsConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => persistedSettings?.autoRotateEnabled ?? true);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(() => persistedSettings?.autoRotateSpeed ?? 1.25);
  const [maxVisibleNodes, setMaxVisibleNodes] = useState(() => {
    const raw = persistedSettings?.maxVisibleNodes;
    const fallback = Math.min(1200, maxVisibleNodesMax);
    return typeof raw === 'number' ? Math.max(0, Math.min(maxVisibleNodesMax, raw)) : fallback;
  });
  const [mapVariant, setMapVariant] = useState<'outline' | 'openstreetmap'>(() => persistedSettings?.mapVariant ?? 'outline');
  const [showOsmTiles, setShowOsmTiles] = useState(() => persistedSettings?.showOsmTiles ?? true);
  const [markerSize, setMarkerSize] = useState(() => persistedSettings?.markerSize ?? 1);
  const [showClusterLabels, setShowClusterLabels] = useState(() => persistedSettings?.showClusterLabels ?? true);
  const [glowIntensity, setGlowIntensity] = useState(() => persistedSettings?.glowIntensity ?? 1);
  const [cloudsEnabled, setCloudsEnabled] = useState(() => persistedSettings?.cloudsEnabled ?? true);
  const [cloudsOpacity, setCloudsOpacity] = useState(() => {
    const raw = persistedSettings?.cloudsOpacity;
    return typeof raw === 'number' ? Math.max(0, Math.min(1, raw)) : 0.55;
  });
  const [showCountryBorders, setShowCountryBorders] = useState(() => persistedSettings?.showCountryBorders ?? false);
  const [showNavigationControls, setShowNavigationControls] = useState(() => persistedSettings?.showNavigationControls ?? false);
  const [showHudLeftFilters, setShowHudLeftFilters] = useState(() => persistedSettings?.showHudLeftFilters ?? true);
  const [showHudLeftGeo, setShowHudLeftGeo] = useState(() => persistedSettings?.showHudLeftGeo ?? true);
  const [showHudRightViewToggle, setShowHudRightViewToggle] = useState(() => persistedSettings?.showHudRightViewToggle ?? true);
  const [showHudRightNavControls, setShowHudRightNavControls] = useState(() => persistedSettings?.showHudRightNavControls ?? true);
  const [showHudFooter, setShowHudFooter] = useState(() => persistedSettings?.showHudFooter ?? true);
  const [viewMode, setViewMode] = useState<'globe' | 'map'>(() => persistedSettings?.viewMode ?? 'globe');
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isOSINTMode, setIsOSINTMode] = useState(false);

  const [sortMode, setSortMode] = useState<'none' | 'closest_me' | 'closest_view' | 'recent'>(
    initialSortMode as any
  );
  const [nearMeEnabled, setNearMeEnabled] = useState<boolean>(initialNearEnabled);
  const [nearRadiusKm, setNearRadiusKm] = useState<number>(initialNearRadiusKm);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!initialSelectedCameraId) return;
    if (selectedCamera?.id === initialSelectedCameraId) return;
    const cam = allCameras.find((c) => c.id === initialSelectedCameraId) ?? null;
    if (cam) setSelectedCamera(cam);
  }, [allCameras, initialSelectedCameraId, selectedCamera?.id]);

  useEffect(() => {
    if (!nearMeEnabled) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast.error('Geolocation is not supported in this browser');
      setNearMeEnabled(false);
      return;
    }

    let canceled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (canceled) return;
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        if (canceled) return;
        setUserLocation(null);
        toast.error('Unable to access your location');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );

    return () => {
      canceled = true;
    };
  }, [nearMeEnabled]);

  useEffect(() => {
    if (!showNavigationControls) {
      setNavState(null);
      return;
    }

    let raf = 0;
    let lastUpdate = 0;
    let lastSerialized: string | null = null;
    const tick = () => {
      const t = performance.now();
      const minIntervalMs = window.matchMedia?.('(pointer: coarse)')?.matches ? 120 : 50;
      if (t - lastUpdate >= minIntervalMs) {
        lastUpdate = t;
        const next = globeRef.current?.getNavigationState() ?? null;
        const serialized = next ? JSON.stringify(next) : null;
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          setNavState(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showNavigationControls]);

  useEffect(() => {
    if (viewMode !== 'globe') {
      setViewCenterLonLat(null);
      return;
    }

    let raf = 0;
    let lastUpdate = 0;
    let last: [number, number] | null = null;
    const tick = () => {
      try {
        const viewer = globeRef.current?.getViewer?.();
        if (!viewer) return;
        if ((viewer as any).isDestroyed?.()) return;
        const scene = viewer.scene;
        const canvas = scene.canvas;
        const center = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
        const p = viewer.camera.pickEllipsoid(center, scene.globe.ellipsoid);

        if (p) {
          const carto = scene.globe.ellipsoid.cartesianToCartographic(p);
          const lon = CesiumMath.toDegrees(carto.longitude);
          const lat = CesiumMath.toDegrees(carto.latitude);
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            const t = performance.now();
            const minIntervalMs = window.matchMedia?.('(pointer: coarse)')?.matches ? 200 : 80;
            if (t - lastUpdate >= minIntervalMs) {
              lastUpdate = t;
              const next: [number, number] = [lon, lat];
              if (!last || Math.abs(last[0] - next[0]) > 1e-4 || Math.abs(last[1] - next[1]) > 1e-4) {
                last = next;
                setViewCenterLonLat(next);
              }
            }
          }
        }
      } catch {
        // ignore
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewMode]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return readStringArrayStorage(FAVORITES_STORAGE_KEY);
  });

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return readStringArrayStorage(RECENTS_STORAGE_KEY);
  });

  const isSelectedFavorite = useMemo(() => {
    if (!selectedCamera?.id) return false;
    return favoriteIds.includes(selectedCamera.id);
  }, [favoriteIds, selectedCamera?.id]);

  const toggleFavoriteSelected = useCallback(() => {
    const id = selectedCamera?.id;
    if (!id) return;
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeStringArrayStorage(FAVORITES_STORAGE_KEY, next);
      return next;
    });
  }, [selectedCamera?.id]);

  // Sync selected camera + filters to URL for shareable links.
  // We do this in a minimal way (replaceState) to avoid full page reloads.
  const syncUrl = useCallback(
    (next: {
      camId: string | null;
      q: string;
      regions: string[];
      mfr: string[];
      sort: 'none' | 'closest_me' | 'closest_view' | 'recent';
      near: boolean;
      radiusKm: number;
    }) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);

      if (next.camId) params.set('cam', next.camId);
      else params.delete('cam');

      if (next.q.trim()) params.set('q', next.q.trim());
      else params.delete('q');

      if (next.regions.length > 0) params.set('regions', serializeCsvParam(next.regions));
      else params.delete('regions');

      if (next.mfr.length > 0) params.set('mfr', serializeCsvParam(next.mfr));
      else params.delete('mfr');

      if (next.sort !== 'none') params.set('sort', next.sort);
      else params.delete('sort');

      if (next.near) params.set('near', '1');
      else params.delete('near');

      if (next.near) params.set('radius', String(Math.round(next.radiusKm)));
      else params.delete('radius');

      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    },
    []
  );

  // Get unique manufacturers
  const manufacturers = useMemo(() => {
    const uniqueMfr = new Set(allCameras.map(cam => cam.manufacturer).filter(m => m && m !== 'N/A'));
    return Array.from(uniqueMfr).sort();
  }, [allCameras]);

  // Filter cameras by selected regions and manufacturers
  const filteredCameras = useMemo(() => {
    let filtered = allCameras;

    if (favoritesOnly) {
      const favSet = new Set(favoriteIds);
      filtered = filtered.filter((cam) => !!cam.id && favSet.has(cam.id));
    }

    if (selectedRegions.length > 0) {
      filtered = filtered.filter(cam => selectedRegions.includes(cam.continent));
    }

    if (selectedManufacturers.length > 0) {
      filtered = filtered.filter(cam => selectedManufacturers.includes(cam.manufacturer));
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length > 0) {
      filtered = filtered.filter(cam => {
        const haystack = [
          cam.id,
          cam.city,
          cam.country,
          cam.region,
          cam.continent,
          cam.manufacturer,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    const viewCenter = viewCenterLonLat
      ? { lat: viewCenterLonLat[1], lon: viewCenterLonLat[0] }
      : { lat: 0, lon: 0 };

    if (nearMeEnabled && userLocation) {
      filtered = filtered.filter((cam) => {
        const d = haversineKm(userLocation, { lat: cam.latitude, lon: cam.longitude });
        return d <= nearRadiusKm;
      });
    }

    if (sortMode !== 'none') {
      const recentIndex = new Map<string, number>();
      recentIds.forEach((id, idx) => recentIndex.set(id, idx));

      filtered = [...filtered].sort((a, b) => {
        if (sortMode === 'closest_me') {
          if (!userLocation) return 0;
          const da = haversineKm(userLocation, { lat: a.latitude, lon: a.longitude });
          const db = haversineKm(userLocation, { lat: b.latitude, lon: b.longitude });
          return da - db;
        }
        if (sortMode === 'closest_view') {
          if (!viewCenterLonLat) return 0;
          const da = haversineKm(viewCenter, { lat: a.latitude, lon: a.longitude });
          const db = haversineKm(viewCenter, { lat: b.latitude, lon: b.longitude });
          return da - db;
        }
        if (sortMode === 'recent') {
          const ra = a.id ? (recentIndex.get(a.id) ?? 999999) : 999999;
          const rb = b.id ? (recentIndex.get(b.id) ?? 999999) : 999999;
          return ra - rb;
        }
        return 0;
      });
    }

    return filtered;
  }, [
    allCameras,
    currentRotation,
    favoriteIds,
    favoritesOnly,
    nearMeEnabled,
    nearRadiusKm,
    recentIds,
    searchQuery,
    selectedManufacturers,
    selectedRegions,
    sortMode,
    userLocation,
  ]);

  const handleCopyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Share link copied');
    } catch {
      // ignore
      toast.error('Failed to copy link');
    }
  }, []);

  // Get regions for filter
  const regions = useMemo(() => {
    return Object.entries(stats.byContinent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const handleRegionToggle = useCallback((region: string) => {
    setSelectedRegions((prev) => {
      const next = prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region];
      syncUrl({
        camId: selectedCamera?.id ?? null,
        q: searchQuery,
        regions: next,
        mfr: selectedManufacturers,
        sort: sortMode,
        near: nearMeEnabled,
        radiusKm: nearRadiusKm,
      });
      return next;
    });
  }, [nearMeEnabled, nearRadiusKm, searchQuery, selectedCamera?.id, selectedManufacturers, sortMode, syncUrl]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    syncUrl({
      camId: selectedCamera?.id ?? null,
      q: query,
      regions: selectedRegions,
      mfr: selectedManufacturers,
      sort: sortMode,
      near: nearMeEnabled,
      radiusKm: nearRadiusKm,
    });
  }, [nearMeEnabled, nearRadiusKm, selectedCamera?.id, selectedManufacturers, selectedRegions, sortMode, syncUrl]);

  const handleCameraSelect = useCallback((camera: CameraData | null) => {
    setSelectedCamera(camera);
    const id = camera?.id ?? null;
    if (id) {
      setRecentIds((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
        writeStringArrayStorage(RECENTS_STORAGE_KEY, next);
        return next;
      });
    }
    syncUrl({
      camId: id,
      q: searchQuery,
      regions: selectedRegions,
      mfr: selectedManufacturers,
      sort: sortMode,
      near: nearMeEnabled,
      radiusKm: nearRadiusKm,
    });
  }, [nearMeEnabled, nearRadiusKm, searchQuery, selectedManufacturers, selectedRegions, sortMode, syncUrl]);

  const handleCloseModal = useCallback(() => {
    setSelectedCamera(null);
    syncUrl({
      camId: null,
      q: searchQuery,
      regions: selectedRegions,
      mfr: selectedManufacturers,
      sort: sortMode,
      near: nearMeEnabled,
      radiusKm: nearRadiusKm,
    });
  }, [nearMeEnabled, nearRadiusKm, searchQuery, selectedManufacturers, selectedRegions, sortMode, syncUrl]);

  const handleManufacturerToggleWithUrl = useCallback((manufacturer: string) => {
    setSelectedManufacturers((prev) => {
      const next = prev.includes(manufacturer) ? prev.filter((m) => m !== manufacturer) : [...prev, manufacturer];
      syncUrl({
        camId: selectedCamera?.id ?? null,
        q: searchQuery,
        regions: selectedRegions,
        mfr: next,
        sort: sortMode,
        near: nearMeEnabled,
        radiusKm: nearRadiusKm,
      });
      return next;
    });
  }, [nearMeEnabled, nearRadiusKm, searchQuery, selectedCamera?.id, selectedRegions, sortMode, syncUrl]);



  const handleSearchOpen = useCallback(() => {
    setIsHudOpen(false);
    setIsSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSettingsOpen = useCallback(() => {
    setIsHudOpen(false);
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOSINTToggle = useCallback(() => {
    setIsOSINTMode((prev) => !prev);
  }, []);

  const handleSearchRegion = useCallback((region: string) => {
    setSearchQuery(region);
    syncUrl({
      camId: selectedCamera?.id ?? null,
      q: region,
      regions: selectedRegions,
      mfr: selectedManufacturers,
      sort: sortMode,
      near: nearMeEnabled,
      radiusKm: nearRadiusKm,
    });
  }, [nearMeEnabled, nearRadiusKm, selectedCamera?.id, selectedManufacturers, selectedRegions, sortMode, syncUrl]);

  // Convenience shortcuts (when a camera is selected):
  // - Ctrl/Cmd+Shift+C copies the current URL (share link)
  // - F toggles favorite
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!selectedCamera?.id) return;

      const isCopyShare = (e.key === 'C' || e.key === 'c') && (e.ctrlKey || e.metaKey) && e.shiftKey;
      if (isCopyShare) {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch {
          // ignore
        }
        return;
      }

      if ((e.key === 'F' || e.key === 'f') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFavoriteSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCamera?.id, toggleFavoriteSelected]);

  useEffect(() => {
    if (!didInitialUrlSync.current) {
      didInitialUrlSync.current = true;
      return;
    }
    syncUrl({
      camId: selectedCamera?.id ?? null,
      q: searchQuery,
      regions: selectedRegions,
      mfr: selectedManufacturers,
      sort: sortMode,
      near: nearMeEnabled,
      radiusKm: nearRadiusKm,
    });
  }, [nearMeEnabled, nearRadiusKm, searchQuery, selectedCamera?.id, selectedManufacturers, selectedRegions, sortMode, syncUrl]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeSettingsStorage(SETTINGS_STORAGE_KEY, {
      autoRotateEnabled,
      autoRotateSpeed,
      maxVisibleNodes,
      mapVariant,
      showOsmTiles,
      markerSize,
      showClusterLabels,
      glowIntensity,
      cloudsEnabled,
      cloudsOpacity,
      showCountryBorders,
      showNavigationControls,
      showHudLeftFilters,
      showHudLeftGeo,
      showHudRightViewToggle,
      showHudRightNavControls,
      showHudFooter,
      viewMode,
    });
  }, [
    autoRotateEnabled,
    autoRotateSpeed,
    maxVisibleNodes,
    mapVariant,
    showOsmTiles,
    markerSize,
    showClusterLabels,
    glowIntensity,
    cloudsEnabled,
    cloudsOpacity,
    showCountryBorders,
    showNavigationControls,
    showHudLeftFilters,
    showHudLeftGeo,
    showHudRightViewToggle,
    showHudRightNavControls,
    showHudFooter,
    viewMode,
  ]);

  if (cameraDataError) {
    return (
      <ParallaxProvider>
        <div className="relative w-screen h-screen bg-background overflow-hidden">
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="hud-panel corner-accents max-w-[520px]">
              <div className="border-b border-panel-border px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-widest text-white/80">
                  Data Load Error
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs text-white/70 break-words">{cameraDataError}</div>
              </div>
            </div>
          </div>
        </div>
      </ParallaxProvider>
    );
  }

  return (
    <ParallaxProvider>
      <div className="relative w-screen h-screen bg-background overflow-hidden">

        {/* Header */}
        <Header
          onLogoClick={handleOSINTToggle}
          isOSINTMode={isOSINTMode}
          rightSlot={
            <AnimatePresence mode="wait">
              {!isOSINTMode && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute right-6 top-6 flex flex-col items-end gap-3"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSearchOpen}
                      className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      Browse
                    </button>
                    <button
                      type="button"
                      onClick={handleSettingsOpen}
                      className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <Sliders className="w-4 h-4" />
                      Settings
                    </button>
                  </div>

                  <div className="hidden md:block w-[320px]">
                    <LiveActivityIndicator online={stats.online} total={stats.total} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          }
        />

        {/* OSINT Board - appears when active */}
        <OSINTBoard
          isOpen={isOSINTMode}
          cameras={allCameras}
          stats={stats}
          onClose={() => setIsOSINTMode(false)}
        />

        {/* Main globe container - full screen normally, 16:9 mini-map in OSINT mode */}
        <motion.div
          className="absolute flex items-center justify-center"
          initial={false}
          animate={{
            top: isOSINTMode ? '72.5px' : '0px',
            right: isOSINTMode ? '17.5px' : '0px',
            bottom: isOSINTMode ? 'auto' : '0px',
            left: isOSINTMode ? 'auto' : '0px',
            width: isOSINTMode ? '420px' : 'auto',
            height: isOSINTMode ? '236px' : 'auto', // 16:9 aspect ratio
            borderRadius: isOSINTMode ? '12px' : '0px',
            zIndex: isOSINTMode ? 50 : 10,
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            overflow: 'hidden',
            boxShadow: isOSINTMode
              ? '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)'
              : 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full"
          >
            <CesiumGlobe
              ref={globeRef}
              cameras={filteredCameras}
              onCameraSelect={handleCameraSelect}
              selectedCameraId={selectedCamera?.id ?? null}
              autoRotateEnabled={autoRotateEnabled}
              autoRotateSpeed={isOSINTMode ? autoRotateSpeed * 0.5 : autoRotateSpeed}
              markerSize={isOSINTMode ? markerSize * 0.7 : markerSize}
              cloudsEnabled={cloudsEnabled}
              cloudsOpacity={cloudsOpacity}
              showCountryBorders={showCountryBorders}
              showNavigationControls={!isOSINTMode && showNavigationControls}
              viewMode={viewMode}
              onReadyChange={setIsSceneReady}
            />
          </motion.div>

          {/* Globe mini-view overlay when in OSINT mode */}
          <AnimatePresence>
            {isOSINTMode && (
              <>
                {/* Top gradient overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"
                />

                {/* Header label */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none"
                >
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/80">
                      Live View
                    </span>
                  </div>
                  <div className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded-sm">
                    <span className="font-mono text-[9px] text-emerald-400">
                      {filteredCameras.length.toLocaleString()}
                    </span>
                  </div>
                </motion.div>

                {/* Bottom gradient overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {!isSceneReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
              <div className="text-center">
                <div className="font-mono text-xs uppercase tracking-wider text-white/90">
                  Loading...
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/50">
                  Initializing globe
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HUD Panels - hidden when OSINT mode is active */}
        <AnimatePresence>
          {!isOSINTMode && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="pointer-events-auto hidden md:block absolute top-24 left-6 bottom-28 z-20 w-[320px]">
                <div className="space-y-3 h-full overflow-y-auto">
                  {showHudLeftFilters && (
                    <div className="hud-panel corner-accents">
                      <div className="border-b border-panel-border px-4 py-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-white/80 flex items-center gap-2">
                          <Star className="w-3 h-3" />
                          Favorites
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                          {favoriteIds.length.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3">
                        <button
                          type="button"
                          onClick={() => setFavoritesOnly((v) => !v)}
                          className={`w-full hud-panel corner-accents flex items-center justify-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${favoritesOnly ? 'text-foreground hover:bg-secondary/50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                        >
                          <Star className={`w-4 h-4 ${favoritesOnly ? 'text-yellow-400' : ''}`} />
                          Favorites Only
                        </button>
                      </div>
                    </div>
                  )}

                  {showHudLeftFilters && (
                    <>
                      <RegionFilters
                        regions={regions}
                        selectedRegions={selectedRegions}
                        onRegionToggle={handleRegionToggle}
                      />

                      <QuickFilters
                        manufacturers={manufacturers}
                        selectedManufacturers={selectedManufacturers}
                        onManufacturerToggle={handleManufacturerToggleWithUrl}
                      />
                    </>
                  )}

                  {showHudLeftGeo && (
                    <div className="hud-panel corner-accents">
                      <div className="border-b border-panel-border px-4 py-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
                          Geo
                        </span>
                      </div>
                      <div className="p-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => setNearMeEnabled((v) => !v)}
                          className={`w-full hud-panel corner-accents flex items-center justify-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${nearMeEnabled ? 'text-foreground hover:bg-secondary/50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                        >
                          Near me
                        </button>

                        {nearMeEnabled && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Radius
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {Math.round(nearRadiusKm)} km
                              </span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={2000}
                              step={5}
                              value={nearRadiusKm}
                              onChange={(e) => setNearRadiusKm(Number(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              Sort
                            </span>
                          </div>
                          <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as any)}
                            className="w-full bg-secondary/20 border border-border/40 rounded-sm px-2 py-2 font-mono text-xs text-foreground"
                          >
                            <option value="none">Default</option>
                            <option value="closest_me">Closest to me</option>
                            <option value="closest_view">Closest to view</option>
                            <option value="recent">Recent</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-auto md:hidden absolute left-3 right-3 top-20 z-30">
                <Drawer open={isHudOpen} onOpenChange={setIsHudOpen}>
                  <div className="grid grid-cols-3 gap-2">
                    <DrawerTrigger asChild>
                      <button
                        type="button"
                        className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        aria-label="Open panels"
                      >
                        <Layers className="w-4 h-4" />
                        Panels
                      </button>
                    </DrawerTrigger>

                    <button
                      type="button"
                      onClick={handleSearchOpen}
                      className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      aria-label="Browse cameras"
                    >
                      <Search className="w-4 h-4" />
                      Search
                    </button>

                    <button
                      type="button"
                      onClick={handleSettingsOpen}
                      className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      aria-label="Open settings"
                    >
                      <Sliders className="w-4 h-4" />
                      Settings
                    </button>
                  </div>

                  <DrawerContent className="border-border/40 bg-background/80 backdrop-blur">
                    <DrawerHeader className="p-4 pb-2 text-left">
                      <div className="flex items-center justify-between">
                        <DrawerTitle className="font-mono text-xs uppercase tracking-wider text-white/80">
                          Panels
                        </DrawerTitle>
                        <DrawerClose asChild>
                          <button
                            type="button"
                            className="p-2 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                            aria-label="Close panels"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </DrawerClose>
                      </div>
                    </DrawerHeader>

                    <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto space-y-3">
                      <LiveActivityIndicator
                        online={stats.online}
                        total={stats.total}
                      />

                      <StatsDisplay
                        totalCameras={stats.total}
                        visibleCameras={filteredCameras.length}
                        continents={Object.keys(stats.byContinent).length}
                        countries={Object.keys(stats.byCountry).length}
                      />

                      <RegionFilters
                        regions={regions}
                        selectedRegions={selectedRegions}
                        onRegionToggle={handleRegionToggle}
                      />

                      <QuickFilters
                        manufacturers={manufacturers}
                        selectedManufacturers={selectedManufacturers}
                        onManufacturerToggle={handleManufacturerToggleWithUrl}
                      />
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CommandSearch
          cameras={allCameras}
          isOpen={isSearchOpen}
          onClose={handleSearchClose}
          onSelectCamera={(camera) => {
            handleCameraSelect(camera);
            handleSearch('');
          }}
          onSelectRegion={handleSearchRegion}
        />

        <SettingsPanel
          isOpen={isSettingsOpen}
          autoRotateEnabled={autoRotateEnabled}
          autoRotateSpeed={autoRotateSpeed}
          showOsmTiles={showOsmTiles}
          markerSize={markerSize}
          cloudsEnabled={cloudsEnabled}
          cloudsOpacity={cloudsOpacity}
          showCountryBorders={showCountryBorders}
          showNavigationControls={showNavigationControls}
          showHudLeftFilters={showHudLeftFilters}
          showHudLeftGeo={showHudLeftGeo}
          showHudRightViewToggle={showHudRightViewToggle}
          showHudRightNavControls={showHudRightNavControls}
          showHudFooter={showHudFooter}
          onClose={handleSettingsClose}
          onAutoRotateEnabledChange={setAutoRotateEnabled}
          onAutoRotateSpeedChange={setAutoRotateSpeed}
          onShowOsmTilesChange={setShowOsmTiles}
          onMarkerSizeChange={setMarkerSize}
          onCloudsEnabledChange={setCloudsEnabled}
          onCloudsOpacityChange={setCloudsOpacity}
          onShowCountryBordersChange={setShowCountryBorders}
          onShowNavigationControlsChange={setShowNavigationControls}
          onShowHudLeftFiltersChange={setShowHudLeftFilters}
          onShowHudLeftGeoChange={setShowHudLeftGeo}
          onShowHudRightViewToggleChange={setShowHudRightViewToggle}
          onShowHudRightNavControlsChange={setShowHudRightNavControls}
          onShowHudFooterChange={setShowHudFooter}
        />

        {/* Overlays */}
        <CornerDecorations />
        <ScanLinesOverlay />
        <VignetteOverlay />

        {isSceneReady && showHudRightViewToggle && (
          <div className="hidden sm:block absolute right-6 bottom-16 z-30">
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === 'map' ? 'globe' : 'map'))}
              className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              aria-label="Toggle map view"
            >
              {viewMode === 'map' ? 'Globe' : 'Map'}
            </button>
          </div>
        )}

        {isSceneReady && showHudRightNavControls && showNavigationControls && navState && viewMode === 'globe' && (() => {
          const heading = ((navState.headingDegrees % 360) + 360) % 360;
          return (
            <div className="hidden sm:block absolute right-6 bottom-28 z-50">
              <button
                type="button"
                onClick={() => {
                  globeRef.current?.tiltToTopDown();
                  globeRef.current?.resetHeading();
                }}
                className="hud-panel corner-accents w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                aria-label="Reset heading and tilt"
                title="Reset heading and tilt"
              >
                <span
                  className="inline-flex"
                  style={{ transform: `rotate(${-heading}deg)` }}
                >
                  <Compass className="w-5 h-5" />
                </span>
              </button>
            </div>
          );
        })()}

        {/* Footer status bar */}
        {showHudFooter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <div className="px-4 py-3 sm:px-6 border-t border-border/30 bg-background/50 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-start">
                  <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                    {isSceneReady && viewCenterLonLat
                      ? `Lon: ${viewCenterLonLat[0].toFixed(2)}° | Lat: ${viewCenterLonLat[1].toFixed(2)}°`
                      : 'Lon: --.--° | Lat: --.--°'}
                  </span>
                  <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                    View: {viewMode === 'map' ? 'Flat Map' : 'Globe'}
                  </span>
                </div>

                <div className="hidden sm:block text-center">
                  <span className="font-mono text-[10px] text-accent uppercase tracking-wider">
                    {now.toLocaleTimeString(undefined, { hour12: false })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-start sm:justify-end">
                  <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                    Cameras: {filteredCameras.length.toLocaleString()} / {stats.total.toLocaleString()}
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                    ● {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Camera Detail Modal */}
        <CameraDetailModal
          camera={selectedCamera}
          allCameras={allCameras}
          onClose={handleCloseModal}
          onSelectCamera={(cam) => handleCameraSelect(cam)}
          onToggleFavorite={toggleFavoriteSelected}
          isFavorite={isSelectedFavorite}
          onCopyShareLink={handleCopyShareLink}
          onDidCopy={(label) => toast.success(`${label} copied`)}
        />
      </div>
    </ParallaxProvider>
  );
}
