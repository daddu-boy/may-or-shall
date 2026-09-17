/**
 * Reading the web page a clipped card came from, for the connector's search.
 *
 * When words find little among the cards, the pages behind them may still hold
 * the answer. This opens those pages from the server, which is logged in to
 * nothing, so it can only ever read public pages. A page that wants a sign-in is
 * reported as such rather than guessed at, so the model can say the card looked
 * relevant but its page needed a login.
 *
 * Because the addresses come from cards, which anyone can write, every address
 * and every redirect is checked to resolve to a public internet address before
 * a connection is made. The check is done in the socket's own DNS lookup, so a
 * name cannot resolve to one address when checked and another when connected.
 */

import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import zlib from "node:zlib";
import { scoreText, firstHit } from "./searchTerms";

export type LinkedPage =
  | { status: "ok"; url: string; title: string; text: string }
  | { status: "login"; url: string }
  | { status: "unreadable"; url: string; reason: string };

const TIMEOUT_MS = 4000;
const MAX_BYTES = 2_000_000;
const MAX_TEXT = 60_000;
const MAX_REDIRECTS = 4;
const CACHE_MS = 30 * 60 * 1000;
const CACHE_MAX = 300;

/** Sites that show nothing without the person's own session. Not worth a request. */
const LOGIN_HOSTS = [
  "mail.google.com",
  "docs.google.com",
  "drive.google.com",
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "harvey.ai",
  "partner.microsoft.com",
  "outlook.office.com",
  "outlook.live.com",
  "teams.microsoft.com",
  "app.slack.com",
  "web.whatsapp.com",
  "linkedin.com",
  "notion.so",
  "manupatrafast.com",
  "scconline.com",
];

const LOGIN_PATH = /\/(log-?in|sign-?in|signin|auth|sso|oauth|accounts?\/(login|signin)|session\/new)(\/|\?|$)/i;

export function needsLoginByHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return LOGIN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** True for loopback, private, link local, carrier grade, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      v === "::" ||
      v === "::1" ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("fe8") ||
      v.startsWith("fe9") ||
      v.startsWith("fea") ||
      v.startsWith("feb") ||
      v.startsWith("ff") ||
      v.startsWith("64:ff9b:") ||
      v.startsWith("2001:db8")
    );
  }
  return true;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function safeLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb) {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err, "", 4);
    const list = addrs as dns.LookupAddress[];
    const bad = !list.length || list.some((a) => isPrivateAddress(a.address));
    if (bad) {
      const e = new Error("refused: not a public address") as NodeJS.ErrnoException;
      e.code = "EPRIVATE";
      return cb(e, "", 4);
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

interface Raw {
  status: number;
  location?: string;
  type: string;
  body: string;
}

function request(url: URL, deadline: number): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error("timed out"));
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup as unknown as typeof dns.lookup,
        timeout: left,
        headers: {
          "user-agent": "MayOrShallBot/1.0 (+https://app.mayorshall.com)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers["content-type"] ?? "");
        const location = res.headers.location;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location, type, body: "" });
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            resolve({ status, type, body: Buffer.concat(chunks).toString("utf8") });
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, type, body: Buffer.concat(chunks).toString("utf8") }));
        stream.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    req.end();
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r\f\v\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return { title: title.replace(/\s+/g, " ").trim(), text: text.slice(0, MAX_TEXT) };
}

/** What to tell the model about a card's page that held none of the words. */
export function pageNoteFor(p: LinkedPage | undefined): string {
  if (!p) return "";
  if (p.status === "ok") {
    const gist = pageGist(p.text);
    return gist ? `its web page does not contain those words but reads, in part: "${gist}"` : "";
  }
  return pageProblem(p);
}

/** One plain sentence on why a card's page could not be used, for the model to pass on. */
export function pageProblem(p: LinkedPage | undefined): string {
  if (!p || p.status === "ok") return "";
  if (p.status === "login") return "its web page needs the user's own login and could not be read; if it looks relevant, tell the user so";
  if (p.reason === "the site turns away automated readers") {
    return "its web page turned away May or Shall's reader; if it looks relevant, try opening the link yourself";
  }
  return `its web page could not be read (${p.reason})`;
}

/** A page that is mostly a sign-in form, or says it wants one and has little else. */
export function looksLikeLogin(html: string, text: string): boolean {
  const password = /<input[^>]+type=["']?password/i.test(html);
  const asks = /\b(sign in|log in|login|sign-in|log-in)\b/i.test(text.slice(0, 3000));
  // a public page often carries a hidden sign-in form, so a password box alone is not enough
  return (password && text.length < 3000) || (asks && text.length < 1500);
}

const cache = new Map<string, { at: number; page: LinkedPage }>();

async function load(start: string): Promise<LinkedPage> {
  let url: URL;
  try {
    url = new URL(start);
  } catch {
    return { status: "unreadable", url: start, reason: "not a web address" };
  }
  if (needsLoginByHost(start)) return { status: "login", url: start };
  const deadline = Date.now() + TIMEOUT_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { status: "unreadable", url: start, reason: "not a web address" };
    }
    if (url.username || url.password) return { status: "unreadable", url: start, reason: "address carries credentials" };
    if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) {
      return { status: "unreadable", url: start, reason: "unusual port" };
    }
    if (hop > 0 && (needsLoginByHost(url.href) || LOGIN_PATH.test(url.pathname))) {
      return { status: "login", url: start };
    }
    let raw: Raw;
    try {
      raw = await request(url, deadline);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const reason = err.code === "EPRIVATE" ? "not a public address" : err.message === "timed out" ? "timed out" : "could not connect";
      return { status: "unreadable", url: start, reason };
    }
    if (raw.status >= 300 && raw.status < 400 && raw.location) {
      url = new URL(raw.location, url);
      continue;
    }
    if (raw.status === 401 || raw.status === 407) return { status: "login", url: start };
    if (raw.status === 403) {
      // forbidden is as often a site turning away automated readers as a sign-in wall
      const t = htmlToText(raw.body).text;
      if (looksLikeLogin(raw.body, t)) return { status: "login", url: start };
      return { status: "unreadable", url: start, reason: "the site turns away automated readers" };
    }
    if (raw.status === 429 || raw.status === 503) {
      return { status: "unreadable", url: start, reason: "the site turns away automated readers" };
    }
    if (raw.status >= 400) return { status: "unreadable", url: start, reason: `the site answered ${raw.status}` };
    if (!/text\/html|application\/xhtml|text\/plain/i.test(raw.type)) {
      return { status: "unreadable", url: start, reason: "not a web page (for example a PDF)" };
    }
    const { title, text } = /html/i.test(raw.type) ? htmlToText(raw.body) : { title: "", text: raw.body.slice(0, MAX_TEXT) };
    if (/just a moment|attention required|verify you are human|captcha/i.test(title)) {
      return { status: "unreadable", url: start, reason: "the site turns away automated readers" };
    }
    if (/html/i.test(raw.type) && looksLikeLogin(raw.body, text)) return { status: "login", url: start };
    if (text.length < 40) return { status: "unreadable", url: start, reason: "the page has no readable text (it may need JavaScript)" };
    return { status: "ok", url: start, title, text };
  }
  return { status: "unreadable", url: start, reason: "too many redirects" };
}

/**
 * Read one page, remembered for half an hour. The memory is keyed by address
 * only, and only ever consulted for an address the asking user's own card
 * holds, so it reveals nothing across accounts.
 */
export async function readLinkedPage(url: string): Promise<LinkedPage> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.page;
  const page = await load(url);
  cache.set(url, { at: Date.now(), page });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return page;
}

/** Read several at once, never more than `limit`, all within about the timeout. */
export async function readLinkedPages(urls: string[], limit = 8): Promise<Map<string, LinkedPage>> {
  const unique = [...new Set(urls)].slice(0, limit);
  const pages = await Promise.all(unique.map((u) => readLinkedPage(u)));
  return new Map(unique.map((u, i) => [u, pages[i]]));
}

/**
 * The stretch of a page where most of the query's words sit together. The first
 * occurrence is often a menu or a heading; the passage that holds several of the
 * words at once is usually the one that answers.
 */
export function bestPassage(text: string, terms: string[], width = 240): string {
  const lower = text.toLowerCase();
  let best = { at: Math.max(0, firstHit(text, terms)), score: -1 };
  for (const t of terms) {
    let from = 0;
    for (let n = 0; n < 60; n++) {
      const i = lower.indexOf(t, from);
      if (i < 0) break;
      from = i + t.length;
      const start = Math.max(0, i - 60);
      const win = lower.slice(start, start + width);
      let score = 0;
      for (const u of terms) {
        const k = win.split(u).length - 1;
        if (k) score += 10 + Math.min(k, 3);
      }
      // prose over menus: sentences have full stops and few very short lines
      if (/[.;:]\s/.test(win)) score += 2;
      if (score > best.score) best = { at: start, score };
    }
  }
  return text.slice(best.at, best.at + width).replace(/\s+/g, " ").trim();
}

/**
 * The opening of a page's actual prose, skipping menus and headings: the first
 * lines long enough to be sentences. Sent when a page holds none of the words,
 * so the model can still judge by meaning whether it is the one wanted.
 */
export function pageGist(text: string, width = 320): string {
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const prose = lines.filter((l) => l.length >= 80 && /[.?!;:]/.test(l));
  const body = (prose.length ? prose : lines.filter((l) => l.length >= 30)).join(" ");
  const out = body.slice(0, width).trim();
  return out.length < body.length ? `${out}…` : out;
}

export interface PageMatch<T> {
  card: T;
  excerpt: string;
  score: number;
}

/**
 * Open the pages behind a set of cards and find which of them contain the
 * query's words. Sites known to need a login are not requested at all and do
 * not count towards the limit. Returns the matches, best first, and what
 * happened for every card that has an address.
 */
export async function matchLinkedPages<T extends { sourceUrl: string | null }>(
  cards: T[],
  terms: string[],
  phrase: string,
  limit = 8
): Promise<{ matches: PageMatch<T>[]; state: Map<string, LinkedPage> }> {
  const state = new Map<string, LinkedPage>();
  const linked = cards.filter((c) => c.sourceUrl && /^https?:\/\//i.test(c.sourceUrl));
  const readable: string[] = [];
  for (const c of linked) {
    const u = c.sourceUrl as string;
    if (needsLoginByHost(u)) state.set(u, { status: "login", url: u });
    else if (!readable.includes(u)) readable.push(u);
  }
  const matches: PageMatch<T>[] = [];
  if (!terms.length || !readable.length) return { matches, state };
  const pages = await readLinkedPages(readable, limit);
  for (const [u, p] of pages) state.set(u, p);
  const done = new Set<string>();
  for (const c of linked) {
    const p = pages.get(c.sourceUrl as string);
    if (!p || p.status !== "ok" || done.has(c.sourceUrl as string)) continue;
    const s = scoreText(p.text, terms, phrase);
    if (!s.matched) continue;
    done.add(c.sourceUrl as string);
    matches.push({ card: c, score: s.matched * 10 + s.score, excerpt: bestPassage(p.text, terms) });
  }
  matches.sort((a, b) => b.score - a.score);
  return { matches, state };
}
