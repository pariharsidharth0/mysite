#!/usr/bin/env node
/**
 * Automated Book Cover Resolver
 * --------------------------------
 * Resolves a working cover image for every book in config.json, then rewrites
 * config.json with the resolved URLs. Run it whenever you add/edit books:
 *
 *     node scripts/fetch-covers.js          # resolve + write config.json
 *     node scripts/fetch-covers.js --dry    # report only, don't write
 *
 * Why this exists: OpenLibrary's `covers.openlibrary.org/b/isbn/{isbn}-L.jpg`
 * returns a BLANK placeholder image (with HTTP 200) when it has no cover for an
 * ISBN — so a naive HEAD check can't distinguish "has cover" from "blank". That
 * was the bug behind the empty book tiles. The reliable fixes used here:
 *   - Append `?default=false` so OpenLibrary returns 404 (not a blank) when it
 *     genuinely has no cover for that ISBN.
 *   - Use the OpenLibrary *Search* API, which returns a `cover_i` (cover id)
 *     for the work across ALL its editions — so even when the exact ISBN has no
 *     image, another edition's cover is found.
 *
 * Resolution order per book (first hit wins):
 *   1. OpenLibrary direct ISBN cover, validated with ?default=false
 *   2. OpenLibrary Search by ISBN        → cover_i → /b/id/{id}-L.jpg
 *   3. OpenLibrary Search by title+author → cover_i → /b/id/{id}-L.jpg
 *   4. Google Books by ISBN/title (best-effort; may be rate-limited)
 *   5. Leave the existing cover_image untouched (last resort)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const DRY_RUN = process.argv.includes('--dry');
const REQUEST_DELAY_MS = 250; // be polite to the APIs
const UA = 'mysite-cover-resolver/1.0 (personal portfolio build script)';

// A real ISBN is ISBN-10 (9 digits + check 0-9/X) or ISBN-13 (13 digits).
function isValidIsbn(isbn) {
    if (!isbn) return false;
    const clean = String(isbn).replace(/[-\s]/g, '');
    return /^(\d{9}[\dX]|\d{13})$/i.test(clean);
}

function httpsGetJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 12000, headers: { 'User-Agent': UA } }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return resolve(null);
            }
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

// HEAD check that treats OpenLibrary's blank-placeholder as "missing" by
// requesting ?default=false (returns 404 when there is no real cover).
function openLibraryIsbnHasCover(isbn) {
    return new Promise((resolve) => {
        const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
        const req = https.request(url, { method: 'HEAD', timeout: 8000, headers: { 'User-Agent': UA } }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- OpenLibrary Search ---------------------------------------------------

async function olSearchCoverByIsbn(isbn) {
    const url = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=cover_i&limit=1`;
    const json = await httpsGetJson(url);
    const id = json && json.docs && json.docs.find((d) => d.cover_i)?.cover_i;
    return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null;
}

async function olSearchCoverByTitleAuthor(title, author) {
    const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/^NEW-?/i, '').trim();
    const params = new URLSearchParams({ title: cleanTitle, fields: 'cover_i', limit: '5' });
    if (author) params.set('author', author);
    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const json = await httpsGetJson(url);
    const id = json && json.docs && json.docs.find((d) => d.cover_i)?.cover_i;
    return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null;
}

// --- Google Books (best-effort fallback; anonymous quota may 429) ---------

function cleanGoogleImageUrl(link) {
    if (!link) return null;
    return link.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=2');
}

function pickGoogleCover(item) {
    const links = item?.volumeInfo?.imageLinks;
    if (!links) return null;
    const best = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail;
    return cleanGoogleImageUrl(best);
}

async function googleCover(isbn, title, author) {
    if (isbn) {
        const j = await httpsGetJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`);
        const c = j && j.items && pickGoogleCover(j.items[0]);
        if (c) return c;
    }
    const cleanTitle = title.replace(/\([^)]*\)/g, '').trim();
    const q = `intitle:${cleanTitle}${author ? `+inauthor:${author}` : ''}`;
    const j = await httpsGetJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
    if (j && j.items) {
        for (const item of j.items) {
            const c = pickGoogleCover(item);
            if (c) return c;
        }
    }
    return null;
}

// --- Resolver -------------------------------------------------------------

async function resolveCover(book) {
    const isbn = (book.isbn || '').replace(/[-\s]/g, '');
    const hasValidIsbn = isValidIsbn(isbn);

    // 1. Direct ISBN cover, validated (no blank placeholder)
    if (hasValidIsbn && (await openLibraryIsbnHasCover(isbn))) {
        return { url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, source: 'ol:isbn' };
    }

    // 2. OpenLibrary Search by ISBN
    if (hasValidIsbn) {
        const c = await olSearchCoverByIsbn(isbn);
        if (c) return { url: c, source: 'ol:search-isbn' };
    }

    // 3. OpenLibrary Search by title + author
    const ct = await olSearchCoverByTitleAuthor(book.title, book.author);
    if (ct) return { url: ct, source: 'ol:search-title' };

    // 4. Google Books (best-effort)
    try {
        const g = await googleCover(hasValidIsbn ? isbn : '', book.title, book.author);
        if (g) return { url: g, source: 'google' };
    } catch { /* ignore */ }

    return null;
}

async function main() {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const books = config.books || [];
    console.log(`Resolving covers for ${books.length} books${DRY_RUN ? ' (dry run)' : ''}...\n`);

    let updated = 0;
    let unresolved = 0;

    for (const book of books) {
        const result = await resolveCover(book);
        if (result) {
            if (result.url !== book.cover_image) {
                book.cover_image = result.url;
                updated++;
                console.log(`✓ ${book.title}  [${result.source}]  → updated`);
            } else {
                console.log(`✓ ${book.title}  [${result.source}]  (unchanged)`);
            }
        } else {
            unresolved++;
            console.log(`✗ ${book.title}: no cover found — keeping existing`);
        }
        await sleep(REQUEST_DELAY_MS);
    }

    console.log(`\nResolved ${books.length - unresolved}/${books.length}  |  Updated ${updated}  |  Unresolved ${unresolved}`);

    if (DRY_RUN) {
        console.log('\nDry run — config.json not modified.');
    } else if (updated > 0) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
        console.log(`\nconfig.json updated with ${updated} new cover URLs.`);
    } else {
        console.log('\nNo changes needed.');
    }
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
