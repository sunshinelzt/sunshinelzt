/**
 * YummyAnime module for Shirox (iOS / iPadOS / macOS)
 * Author: sunshinelzt (https://github.com/sunshinelzt)
 * Repository: https://github.com/sunshinelzt/sunshinelzt/tree/main/meow
 * Source: YummyAnime (https://site.yummyani.me, API: https://api.yani.tv)
 * Player: Kodik (HLS .m3u8 direct streams)
 */

// Public application developer token (YummyAnime Developer Portal)
const PUBLIC_TOKEN = "kkzbstclw4nk-j8i";

const API_BASE = "https://api.yani.tv";
const IMAGE_REFERER = "https://site.yummyani.me/";
const KODIK_REFERER = "https://kodikplayer.com/";

function _ua() {
  return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
}

function _absUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return "https:" + s;
  return s;
}

function _safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

function _cleanText(s) {
  if (!s) return "";
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalizes voiceover studio names for clean display in Shirox UI
 */
function _cleanDubbingName(name) {
  let s = String(name || "").trim();
  if (!s) return "Стандартная";
  // Remove redundant prefixes
  s = s.replace(/^(озвучка|плеер|перевод)\s+/i, "");
  // Clean special characters
  s = s.replace(/^#/, "");
  return s.trim() || "Стандартная";
}

/**
 * Universal HTTP request wrapper compatible with both Shirox/Sora fetchv2 and standard fetch
 */
async function _request(url, headers = {}, method = "GET", body = null) {
  if (typeof fetchv2 === "function") {
    return fetchv2(url, headers, method, body);
  }
  if (typeof fetch === "function") {
    const opts = { method, headers };
    if (body) opts.body = body;
    return fetch(url, opts);
  }
  throw new Error("No HTTP fetch client available in runtime");
}

async function _readJson(res) {
  if (!res) return null;
  if (typeof res.json === "function") {
    try {
      const val = await res.json();
      if (val !== undefined && val !== null) return val;
    } catch (_) {}
  }
  if (typeof res.text === "function") {
    try {
      const txt = await res.text();
      return _safeJsonParse(txt, null);
    } catch (_) {}
  }
  return null;
}

async function _readText(res) {
  if (!res) return "";
  if (typeof res.text === "function") {
    return await res.text();
  }
  return "";
}

/**
 * Headers for YummyAnime API requests including application developer tokens
 */
function _apiHeaders(extra = {}) {
  return {
    "User-Agent": _ua(),
    "Accept": "application/json",
    "Referer": IMAGE_REFERER,
    "Origin": IMAGE_REFERER,
    "X-Application": PUBLIC_TOKEN,
    ...extra
  };
}

/**
 * Voiceover ranking priority for the Russian anime community
 */
function _dubbingRank(name) {
  const s = String(name || "").toLowerCase();
  const order = [
    "anilibria",
    "анилибрия",
    "studio band",
    "studioband",
    "студийная банда",
    "deep",
    "дип",
    "jam",
    "джем",
    "dream cast",
    "dreamcast",
    "дримкаст",
    "дрим каст",
    "shiza",
    "шиза",
    "shiza project",
    "anidub",
    "анидаб",
    "crunchyroll",
    "кранчиролл",
    "субтитры",
    "субтит",
    "subtitles",
    "sub",
    "дубляж",
    "дублированный",
    "полное дублирование",
    "кансай",
    "kansai",
    "анистар",
    "anistar",
    "анивост",
    "animevost",
    "onwave",
    "онвейв",
    "многоголосый",
    "двухголосый"
  ];
  for (let i = 0; i < order.length; i++) {
    if (s.includes(order[i])) return i;
  }
  return 999;
}

/**
 * Smart relevance scoring comparing keyword with Russian title, slug, and English aliases
 */
function _scoreSearchItem(item, keyword) {
  const k = String(keyword || "").toLowerCase().trim();
  if (!k) return 99;

  const title = String(item?.title || "").toLowerCase().trim();
  const slug = String(item?.anime_url || "").toLowerCase().replace(/[-_]/g, " ").trim();
  const alias = String(item?.remote_ids?.anilibria_alias || "").toLowerCase().replace(/[-_]/g, " ").trim();

  if (title === k || slug === k || alias === k) return 0;
  if (title.startsWith(k) || slug.startsWith(k) || alias.startsWith(k)) return 1;
  if (title.includes(k) || slug.includes(k) || alias.includes(k)) return 2;
  return 3;
}

function _pack(obj) {
  return "yummy:" + encodeURIComponent(JSON.stringify(obj || {}));
}

function _unpack(href) {
  const s = String(href || "").trim();
  if (!s.startsWith("yummy:")) return null;
  return _safeJsonParse(decodeURIComponent(s.slice("yummy:".length)), null);
}

/**
 * Categorizes voiceover into user-friendly badge for Shirox details: Дубляж, Субтитры, Закадр
 */
function _dubbingType(name) {
  const s = String(name || "").toLowerCase().replace(/[\s-_]+/g, "");
  if (s.includes("субтитр") || s.includes("sub")) return "Субтитры";
  if (s.includes("дубляж") || s.includes("дублирован") || s.includes("studioband") || s.includes("студийнаябанда") || s.includes("deep") || s.includes("дип") || s.includes("flarrow") || s.includes("тодубляжная") || s.includes("реанимедиа") || s.includes("reanimedia")) return "Дубляж";
  if (s.includes("двухголосый") || s.includes("2голосый")) return "2-голосый";
  if (s.includes("многоголосый")) return "Многоголосый";
  return "Закадровый";
}

/**
 * High-performance In-Memory LRU Cache with TTL for Apple JavaScriptCore runtime
 */
class MemoryCache {
  constructor(maxSize = 30, ttlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    if (!key) return null;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (!key) return;
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { time: Date.now(), value });
  }
}

// Global in-memory caches persisting across Shirox session
const _episodesCache = new MemoryCache(30, 10 * 60 * 1000);  // 30 anime, 10 min TTL
const _streamsCache = new MemoryCache(50, 15 * 60 * 1000);   // 50 episodes, 15 min TTL
const _searchCache = new MemoryCache(25, 5 * 60 * 1000);     // 25 searches, 5 min TTL
const _kodikIframeCache = new MemoryCache(60, 20 * 60 * 1000); // 60 iframes, 20 min TTL

// ---------------------------------------------------------------------------
// 1. searchResults(keyword)
// ---------------------------------------------------------------------------
/**
 * Queries YummyAnime API for anime catalog items.
 * Supports Cyrillic, Latin, and special characters.
 * @param {string} keyword Search term
 * @returns {Promise<string>} JSON string: [{ title, image, href }]
 */
async function searchResults(keyword) {
  const q = String(keyword || "").trim();
  if (!q) return "[]";

  const cacheKey = q.toLowerCase();
  const cached = _searchCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/search?limit=30&offset=0&q=${encodeURIComponent(q)}`;
    const headers = _apiHeaders();

    const res = await _request(url, headers);
    const json = await _readJson(res);
    const arr = Array.isArray(json?.response) ? json.response : [];
    const results = [];

    for (const item of arr) {
      const title = String(item?.title || "").trim() || "Unknown";
      let poster =
        item?.poster?.fullsize ||
        item?.poster?.big ||
        item?.poster?.medium ||
        item?.poster?.small ||
        item?.poster?.huge ||
        item?.poster?.mega ||
        "";

      poster = _absUrl(poster);

      // Prefer stable numeric anime_id or fallback to slug
      const href = item?.anime_id != null ? String(item.anime_id) : String(item?.anime_url || "").trim();
      if (!href) continue;

      results.push({
        title,
        image: poster,
        href,
        _score: _scoreSearchItem(item, q)
      });
    }

    results.sort((a, b) => a._score - b._score);
    const resultJson = JSON.stringify(results.map(({ _score, ...rest }) => rest));
    _searchCache.set(cacheKey, resultJson);
    return resultJson;
  } catch (err) {
    if (typeof console !== "undefined" && console.log) {
      console.log("[searchResults error] " + (err?.message || err));
    }
    return "[]";
  }
}

// ---------------------------------------------------------------------------
// 2. extractDetails(animeIdOrUrl)
// ---------------------------------------------------------------------------
/**
 * Extracts metadata (synopsis, year, alternative titles) for an anime.
 * @param {string} animeIdOrUrl Anime ID or slug
 * @returns {Promise<string>} JSON string: [{ description, aliases, airdate }]
 */
async function extractDetails(animeIdOrUrl) {
  const target = String(animeIdOrUrl || "").trim();
  if (!target) {
    return JSON.stringify([{ description: "No description available", airdate: "Unknown", aliases: "" }]);
  }

  try {
    const url = `${API_BASE}/anime/${encodeURIComponent(target)}?need_videos=false`;
    const headers = _apiHeaders();

    const res = await _request(url, headers);
    const json = await _readJson(res);
    const data = json?.response || {};

    // Collect and clean English/Romaji alternative titles for Shirox tracking match
    const rawTitles = Array.isArray(data?.other_titles) ? data.other_titles : [];
    const cleanedTitles = [];
    const seenTitles = new Set();
    for (const t of rawTitles) {
      const s = String(t || "").trim();
      if (s && !seenTitles.has(s.toLowerCase())) {
        seenTitles.add(s.toLowerCase());
        cleanedTitles.push(s);
      }
    }

    const description = _cleanText(data?.description) || "No description available";
    const airdate = data?.year != null && data.year > 0 ? String(data.year) : "Unknown";
    const aliases = cleanedTitles.length ? cleanedTitles.join(", ") : "";

    return JSON.stringify([{
      description,
      airdate,
      aliases
    }]);
  } catch (err) {
    if (typeof console !== "undefined" && console.log) {
      console.log("[extractDetails error] " + (err?.message || err));
    }
    return JSON.stringify([{ description: "No description available", airdate: "Unknown", aliases: "" }]);
  }
}

// ---------------------------------------------------------------------------
// 3. extractEpisodes(animeIdOrUrl)
// ---------------------------------------------------------------------------
/**
 * Fetches episode list for an anime, grouping voiceover options and preserving order.
 * @param {string} animeIdOrUrl Anime ID or slug
 * @returns {Promise<string>} JSON string: [{ number, title, href }]
 */
async function extractEpisodes(animeIdOrUrl) {
  const raw = String(animeIdOrUrl || "").trim();
  if (!raw) return "[]";

  const cached = _episodesCache.get(raw);
  if (cached) return cached;

  try {
    let animeId = null;

    if (/^\d+$/.test(raw)) {
      animeId = raw;
    } else {
      const infoUrl = `${API_BASE}/anime/${encodeURIComponent(raw)}?need_videos=false`;
      const infoRes = await _request(infoUrl, _apiHeaders());
      const infoJson = await _readJson(infoRes);
      const info = infoJson?.response || {};
      animeId = info?.anime_id != null ? String(info.anime_id) : null;
    }

    if (!animeId) return "[]";

    const cachedById = _episodesCache.get(animeId);
    if (cachedById) {
      _episodesCache.set(raw, cachedById);
      return cachedById;
    }

    const url = `${API_BASE}/anime/${encodeURIComponent(animeId)}/videos`;
    const res = await _request(url, _apiHeaders());
    const json = await _readJson(res);
    const vids = Array.isArray(json?.response) ? json.response : [];

    // Filter only Kodik-compatible player entries
    const kodikVids = vids.filter(v => {
      const iframe = String(v?.iframe_url || "").toLowerCase();
      const player = String(v?.data?.player || "").toLowerCase();
      return (
        iframe.includes("kodik") ||
        iframe.includes("aniqit") ||
        iframe.includes("anivod") ||
        player.includes("kodik")
      );
    });

    // Group by episode number
    const byNum = new Map();

    for (const v of kodikVids) {
      const num = parseFloat(v?.number);
      if (isNaN(num)) continue;

      const iframeUrl = _absUrl(v?.iframe_url || "");
      if (!iframeUrl) continue;

      const dubbing = _cleanDubbingName(v?.data?.dubbing);
      const player = String(v?.data?.player || "Kodik").trim();

      if (!byNum.has(num)) {
        byNum.set(num, { num, options: [] });
      }

      const ep = byNum.get(num);

      // Prevent exact duplicates of the same voiceover for the same episode
      if (!ep.options.some(o => o.dubbing === dubbing && o.iframe_url === iframeUrl)) {
        ep.options.push({
          dubbing,
          player,
          iframe_url: iframeUrl
        });
      }
    }

    const episodes = Array.from(byNum.values())
      .sort((a, b) => a.num - b.num)
      .map(ep => {
        ep.options.sort((x, y) => _dubbingRank(x.dubbing) - _dubbingRank(y.dubbing));

        const payload = {
          animeId,
          number: ep.num,
          options: ep.options
        };

        return {
          number: ep.num,
          title: `Серия ${ep.num}`,
          href: _pack(payload)
        };
      });

    const resultJson = JSON.stringify(episodes);
    _episodesCache.set(raw, resultJson);
    _episodesCache.set(animeId, resultJson);
    return resultJson;
  } catch (err) {
    if (typeof console !== "undefined" && console.log) {
      console.log("[extractEpisodes error] " + (err?.message || err));
    }
    return "[]";
  }
}

// ---------------------------------------------------------------------------
// 4. kodikParser(url) & ROT18 decode
// ---------------------------------------------------------------------------
/**
 * ROT18 + Base64 cipher decoder for Kodik streaming links
 */
function decode(input) {
  const map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "", b = 0, c = 0;

  const r = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (/[a-zA-Z]/.test(ch)) {
      const cc = ch.charCodeAt(0);
      const max = ch <= "Z" ? 90 : 122;
      const sh = cc + 18;
      r.push(String.fromCharCode(sh <= max ? sh : sh - 26));
    } else {
      r.push(ch);
    }
  }

  const rot = r.join("");
  for (let j = 0; j < rot.length; j++) {
    const ch = rot[j];
    if (ch === "=") break;
    const v = map.indexOf(ch);
    if (v === -1) continue;

    b = (b << 6) | v;
    c += 6;

    if (c >= 8) {
      c -= 8;
      out += String.fromCharCode((b >> c) & 0xff);
    }
  }
  return out;
}

/**
 * Resolves Kodik iframe into available qualities and HLS .m3u8 stream URLs
 */
async function kodikParser(url) {
  if (!url) return {};
  const cached = _kodikIframeCache.get(url);
  if (cached) return cached;

  try {
    const headers = {
      "Referer": IMAGE_REFERER,
      "User-Agent": _ua()
    };

    const response = await _request(url, headers);
    const htmlText = await _readText(response);

    let urlParams = {};
    const urlParamsMatch = htmlText.match(/var\s+urlParams\s*=\s*(['"])([\s\S]+?)\1\s*;/);
    if (urlParamsMatch) {
      urlParams = _safeJsonParse(urlParamsMatch[2], {});
    } else {
      const jsonMatch = htmlText.match(/var\s+urlParams\s*=\s*({[\s\S]+?});/);
      if (jsonMatch) urlParams = _safeJsonParse(jsonMatch[1], {});
    }

    let videoInfo_type = "";
    let videoInfo_hash = "";
    let videoInfo_id = "";

    const vTypeMatch = htmlText.match(/vInfo\.type\s*=\s*['"]([^'"]+)['"]/i) || htmlText.match(/type:\s*['"]([^'"]+)['"]/i);
    if (vTypeMatch) videoInfo_type = vTypeMatch[1];

    const vHashMatch = htmlText.match(/vInfo\.hash\s*=\s*['"]([^'"]+)['"]/i) || htmlText.match(/hash:\s*['"]([^'"]+)['"]/i);
    if (vHashMatch) videoInfo_hash = vHashMatch[1];

    const vIdMatch = htmlText.match(/vInfo\.id\s*=\s*['"]([^'"]+)['"]/i) || htmlText.match(/id:\s*['"]([^'"]+)['"]/i);
    if (vIdMatch) videoInfo_id = vIdMatch[1];

    // Fallback extraction from URL path: /season/<id>/<hash>/720p or /seria/<id>/<hash>/720p
    if (!videoInfo_hash || !videoInfo_id || !videoInfo_type) {
      const urlPartsMatch = url.match(/\/([a-z]+)\/(\d+)\/([a-f0-9]+)/i);
      if (urlPartsMatch) {
        if (!videoInfo_type) videoInfo_type = urlPartsMatch[1];
        if (!videoInfo_id) videoInfo_id = urlPartsMatch[2];
        if (!videoInfo_hash) videoInfo_hash = urlPartsMatch[3];
      }
    }

    if (!videoInfo_hash || !videoInfo_id) {
      return {};
    }

    const domain = urlParams.pd || "kodikplayer.com";
    const ftorUrl = `https://${domain}/ftor`;

    const finalData =
      `d=${urlParams.d || ""}` +
      `&d_sign=${urlParams.d_sign || ""}` +
      `&pd=${urlParams.pd || ""}` +
      `&pd_sign=${urlParams.pd_sign || ""}` +
      `&ref=${urlParams.ref || ""}` +
      `&ref_sign=${urlParams.ref_sign || ""}` +
      `&bad_user=false&cdn_is_working=true` +
      `&type=${videoInfo_type}&hash=${videoInfo_hash}&id=${videoInfo_id}&info=%7B%7D`;

    const headers2 = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": url,
      "User-Agent": _ua(),
      "X-Requested-With": "XMLHttpRequest"
    };

    const apiResponse = await _request(ftorUrl, headers2, "POST", finalData);
    const apiJson = await _readJson(apiResponse);
    const qualities = {};

    if (apiJson?.links) {
      for (const quality in apiJson.links) {
        const qArr = apiJson.links[quality];
        const first = Array.isArray(qArr) ? qArr[0] : null;
        if (!first?.src) continue;

        let decodedSrc = decode(first.src);
        if (decodedSrc.startsWith("//")) {
          decodedSrc = "https:" + decodedSrc;
        }

        qualities[quality] = {
          src: decodedSrc,
          type: first.type || "application/x-mpegURL"
        };
      }
    }

    if (Object.keys(qualities).length > 0) {
      _kodikIframeCache.set(url, qualities);
    }
    return qualities;
  } catch (err) {
    if (typeof console !== "undefined" && console.log) {
      console.log("[kodikParser error] " + (err?.message || err));
    }
    return {};
  }
}

/**
 * Concurrently executes an async mapper across an array with a bounded worker pool.
 */
async function _mapConcurrent(items, limit, fn) {
  if (!Array.isArray(items) || !items.length) return [];
  const results = new Array(items.length);
  let index = 0;
  const count = Math.min(limit || 8, items.length);
  const workers = new Array(count).fill(0).map(async () => {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (_) {
        results[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// 5. extractStreamUrl(href)
// ---------------------------------------------------------------------------
/**
 * Resolves an episode payload into playable HLS video stream options.
 * @param {string} href Packed episode payload string or direct player URL
 * @returns {Promise<string>} JSON string: { streams: [{ title, details, streamUrl, headers }] }
 */
async function extractStreamUrl(href) {
  const raw = String(href || "").trim();
  if (!raw) {
    return JSON.stringify({ streams: [] });
  }

  const cached = _streamsCache.get(raw);
  if (cached) return cached;

  try {
    let options = [];

    if (raw.startsWith("yummy:")) {
      const payload = _unpack(raw);
      options = Array.isArray(payload?.options) ? payload.options : [];
    } else if (raw.startsWith("http://") || raw.startsWith("https://")) {
      options = [{ dubbing: "Kodik", iframe_url: raw }];
    } else if (raw.startsWith("{")) {
      const parsed = _safeJsonParse(raw, null);
      if (Array.isArray(parsed?.options)) options = parsed.options;
    }

    if (!options.length) {
      return JSON.stringify({ streams: [] });
    }

    // Sort voiceover options by popularity (AniLibria, StudioBand, Dream Cast, Crunchyroll, etc.)
    options.sort((a, b) => _dubbingRank(a.dubbing) - _dubbingRank(b.dubbing));

    // Resolve ALL available voiceovers using bounded concurrency (pool of 12 workers)
    // Resolves 36+ voiceovers in ~500-800ms without exceeding connection limits
    const parsedResults = await _mapConcurrent(options, 12, async (opt) => {
      try {
        const qualities = await kodikParser(opt.iframe_url);
        return { opt, qualities };
      } catch (_) {
        return null;
      }
    });

    const streams = [];
    const seenUrls = new Set();

    // Pass 1: Exclusively high-definition streams (>= 720p: 720p, 1080p, etc.)
    for (const res of parsedResults) {
      if (!res || !res.qualities || typeof res.qualities !== "object") continue;
      const { opt, qualities } = res;

      // Filter only 720p and higher, sorted descending (1080 -> 720)
      const qNums = Object.keys(qualities)
        .map(k => parseInt(String(k).replace(/[^\d]/g, ""), 10) || 0)
        .filter(n => n >= 720)
        .sort((a, b) => b - a);

      for (const q of qNums) {
        const qKey = String(q);
        const item = qualities[qKey];
        const src = item?.src;
        if (!src || seenUrls.has(src)) continue;
        seenUrls.add(src);

        streams.push({
          title: `${opt.dubbing} (${q}p)`,
          details: `${q}p • ${_dubbingType(opt.dubbing)} • Kodik`,
          streamUrl: src,
          headers: {
            "Referer": KODIK_REFERER
          }
        });
      }
    }

    // Pass 2 Fallback: If absolutely no HD streams exist anywhere (e.g. retro 480p anime), take highest available
    if (!streams.length) {
      for (const res of parsedResults) {
        if (!res || !res.qualities || typeof res.qualities !== "object") continue;
        const { opt, qualities } = res;

        const qNums = Object.keys(qualities)
          .map(k => parseInt(String(k).replace(/[^\d]/g, ""), 10) || 0)
          .filter(n => n > 0)
          .sort((a, b) => b - a);

        if (qNums.length > 0) {
          const maxQ = qNums[0];
          const item = qualities[String(maxQ)];
          const src = item?.src;
          if (src && !seenUrls.has(src)) {
            seenUrls.add(src);
            streams.push({
              title: `${opt.dubbing} (${maxQ}p)`,
              details: `${maxQ}p • ${_dubbingType(opt.dubbing)} • Kodik`,
              streamUrl: src,
              headers: {
                "Referer": KODIK_REFERER
              }
            });
          }
        }
      }
    }

    const resultJson = JSON.stringify({
      streams,
      allSubtitles: []
    });
    if (streams.length > 0) {
      _streamsCache.set(raw, resultJson);
    }
    return resultJson;
  } catch (err) {
    if (typeof console !== "undefined" && console.log) {
      console.log("[extractStreamUrl error] " + (err?.message || err));
    }
    return JSON.stringify({ streams: [] });
  }
}

// ---------------------------------------------------------------------------
// 6. Exports & Runtime Hookup
// ---------------------------------------------------------------------------
const _exports = {
  searchResults,
  extractDetails,
  extractEpisodes,
  extractStreamUrl
};

try {
  if (typeof globalThis !== "undefined") {
    globalThis.searchResults = searchResults;
    globalThis.extractDetails = extractDetails;
    globalThis.extractEpisodes = extractEpisodes;
    globalThis.extractStreamUrl = extractStreamUrl;
    globalThis.default = _exports;
  }
} catch (_) {}

try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = _exports;
    module.exports.default = _exports;
  }
} catch (_) {}
