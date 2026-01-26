// NOTAM Decoder Script

function navigatePage() {
    const select = document.getElementById('site-nav');
    if (!select) return;
    const target = select.value;
    if (!target) return;
    window.location.href = target;
}

function validateIcaoCode(code) {
    const icaoPattern = /^[A-Z0-9]{4}$/;
    return icaoPattern.test(code);
}

async function fetchNotams() {
    const icaoInput = document.getElementById('notam-icao-input');
    const icaoCode = (icaoInput?.value || '').trim().toUpperCase();
    const resultSection = document.getElementById('notam-result-section');
    const output = document.getElementById('notam-output');
    const btn = document.getElementById('fetch-notams-btn');

    if (!icaoCode) {
        showNotamError('Please enter an ICAO code.', output, resultSection);
        return;
    }

    if (!validateIcaoCode(icaoCode)) {
        showNotamError('Invalid ICAO code. Please enter a 4-character airport code (e.g., EGCC, KJFK).', output, resultSection);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Fetching...';
    output.innerHTML = '<div class="loading">⏳ Fetching current NOTAMs...</div>';
    resultSection.style.display = 'block';

    try {
        if (window.location && window.location.protocol === 'file:') {
            throw new Error('Live fetching is blocked when opening this page directly from your disk (file://). Run it via a local web server (e.g., VS Code Live Server) or use the deployed GitHub Pages site, then try again.');
        }

        const raw = await fetchNotamsFromAnySource(icaoCode);
        if (!raw || raw.trim() === '') {
            throw new Error(`No NOTAMs found for ${icaoCode}, or the data source returned empty.`);
        }

        // Populate manual textarea too
        const textarea = document.getElementById('notam-input');
        if (textarea) textarea.value = raw.trim();

        displayNotamResults(raw.trim(), icaoCode);
        resultSection.style.display = 'block';
    } catch (e) {
        showNotamError(
            `${e.message || String(e)}\n\nTip: If fetching fails, paste NOTAMs manually in the box below and click “Decode NOTAMs”.`,
            output,
            resultSection
        );
    } finally {
        btn.disabled = false;
        btn.textContent = 'Fetch NOTAMs';
    }
}

async function fetchNotamsFromAnySource(icaoCode) {
    const encoded = encodeURIComponent(icaoCode);

    // Try a couple of public endpoints. Availability/CORS can vary by browser/region.
    const sources = [
        {
            name: 'aviationapi',
            url: `https://api.aviationapi.com/v1/notams?apt=${encoded}`,
            parse: async (resp) => {
                const data = await resp.json();
                // Common response: { "KJFK": ["...", "..."], "status": ... }
                const direct = data?.[icaoCode] || data?.[icaoCode.toUpperCase()];
                if (Array.isArray(direct)) return direct.join('\n\n');
                if (typeof direct === 'string') return direct;

                // Some variants return { notams: [...] }
                if (Array.isArray(data?.notams)) return data.notams.join('\n\n');
                return '';
            }
        }
    ];

    let lastErr = null;
    for (const s of sources) {
        try {
            const r = await fetch(s.url, { cache: 'no-store' });
            if (!r.ok) throw new Error(`${s.name} responded ${r.status}`);
            const txt = await s.parse(r);
            if (txt && txt.trim()) return txt;
        } catch (e) {
            lastErr = e;
        }
    }

    throw new Error(`Unable to fetch NOTAMs for ${icaoCode}. ${lastErr ? `Last error: ${lastErr.message || String(lastErr)}` : ''}`.trim());
}

function decodeNotamsFromInput() {
    const input = document.getElementById('notam-input')?.value || '';
    const icaoCode = (document.getElementById('notam-icao-input')?.value || '').trim().toUpperCase();
    const resultSection = document.getElementById('notam-result-section');
    const output = document.getElementById('notam-output');

    if (!input.trim()) {
        showNotamError('Please paste one or more NOTAMs to decode.', output, resultSection);
        return;
    }

    displayNotamResults(input.trim(), validateIcaoCode(icaoCode) ? icaoCode : '');
    resultSection.style.display = 'block';
}

function displayNotamResults(rawText, icaoCode) {
    const output = document.getElementById('notam-output');
    output.innerHTML = '';

    const rawDetails = document.createElement('details');
    rawDetails.className = 'raw-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Raw NOTAMs';
    const rawDiv = document.createElement('div');
    rawDiv.className = 'raw-metar';
    rawDiv.textContent = rawText;
    rawDetails.appendChild(summary);
    rawDetails.appendChild(rawDiv);
    output.appendChild(rawDetails);

    const decoded = decodeNotams(rawText, icaoCode);

    const grid = document.createElement('div');
    grid.className = 'decode-grid';

    if (decoded.summary) {
        grid.appendChild(makeCard('📌 Summary', decoded.summary));
    }

    if (Array.isArray(decoded.items) && decoded.items.length) {
        decoded.items.forEach((n, idx) => {
            const titleParts = [];
            if (n.id) titleParts.push(n.id);
            if (n.location) titleParts.push(n.location);
            const title = titleParts.length ? `🛑 NOTAM ${titleParts.join(' — ')}` : `🛑 NOTAM ${idx + 1}`;

            const bodyParts = [];
            if (n.validity) bodyParts.push(`Validity: ${n.validity}`);
            if (n.qLine) bodyParts.push(`Q-line: ${n.qLine}`);
            if (n.altitudes) bodyParts.push(`Altitudes: ${n.altitudes}`);
            if (n.position) bodyParts.push(`Area: ${n.position}`);
            if (n.text) bodyParts.push(n.text);

            grid.appendChild(makeCard(title, bodyParts.join('\n')));
        });
    } else {
        grid.appendChild(makeCard('🛑 NOTAM', expandNotamAbbreviations(rawText)));
    }

    output.appendChild(grid);
}

function makeCard(label, value) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'decode-item';

    const strong = document.createElement('strong');
    strong.textContent = label;

    const p = document.createElement('p');
    p.textContent = value;

    itemDiv.appendChild(strong);
    itemDiv.appendChild(p);
    return itemDiv;
}

function showNotamError(message, output, resultSection) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    output.innerHTML = '';
    output.appendChild(errorDiv);
    resultSection.style.display = 'block';
}

function decodeNotams(rawText, icaoCode) {
    const cleaned = (rawText || '').replace(/\r/g, '').trim();

    // Try to split into items.
    // FAA style often begins with '!'
    // ICAO style often contains "Q)" blocks and NOTAM numbers.
    let chunks = splitNotamChunks(cleaned);

    const items = chunks.map((chunk) => parseNotamChunk(chunk, icaoCode)).filter(Boolean);

    const summary = buildNotamSummary(items);

    return { summary, items };
}

function splitNotamChunks(text) {
    if (!text) return [];

    // If FAA style, split on lines starting with '!'
    const lines = text.split('\n');
    const hasBang = lines.some((l) => /^\s*!/.test(l));
    if (hasBang) {
        const out = [];
        let buf = [];
        for (const line of lines) {
            if (/^\s*!/.test(line) && buf.length) {
                out.push(buf.join('\n').trim());
                buf = [line];
            } else {
                buf.push(line);
            }
        }
        if (buf.length) out.push(buf.join('\n').trim());
        return out.filter(Boolean);
    }

    // Otherwise split on blank lines
    return text
        .split(/\n\s*\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseNotamChunk(chunk, icaoCode) {
    const text = (chunk || '').trim();
    if (!text) return null;

    // FAA bang format example:
    // !JFK 01/012 JFK RWY 04L/22R CLSD 2401011200-2401312359
    if (/^\s*!/.test(text)) {
        return parseFaaBangNotam(text);
    }

    // ICAO-ish format with Q) A) B) C) E)
    if (/\bQ\)\b/i.test(text) || /\bA\)\b/i.test(text)) {
        return parseIcaoStructuredNotam(text, icaoCode);
    }

    // Fallback: treat as plain text
    return {
        id: extractNotamId(text),
        location: icaoCode || '',
        validity: extractValidity(text),
        text: expandNotamAbbreviations(text)
    };
}

function parseFaaBangNotam(text) {
    // Keep first line as primary, rest appended
    const oneLine = text.replace(/\s+/g, ' ').trim();

    // Try to extract: !LOC MM/NN LOC ... VALID
    const m = oneLine.match(/^!([A-Z0-9]{3,4})\s+(\d{2}\/\d{3,4})\s+([A-Z0-9]{3,4})\s+(.+)$/);
    const location = m ? m[1] : '';
    const id = m ? `${location} ${m[2]}` : extractNotamId(oneLine);

    const validity = extractValidity(oneLine);
    const body = m ? m[4] : oneLine;

    return {
        id,
        location,
        validity,
        text: expandNotamAbbreviations(body)
    };
}

function parseIcaoStructuredNotam(text, fallbackIcao) {
    const compact = text.replace(/\r/g, '');

    const qLine = extractField(compact, 'Q');
    const a = extractField(compact, 'A');
    const b = extractField(compact, 'B');
    const c = extractField(compact, 'C');
    const e = extractField(compact, 'E');

    const location = (a || fallbackIcao || '').trim();
    const id = extractNotamId(compact);

    const validity = formatValidity(b, c) || extractValidity(compact);

    const decodedQ = qLine ? decodeQLine(qLine) : '';

    const altitudes = decodedQ?.altitudes || '';
    const position = decodedQ?.position || '';

    return {
        id,
        location,
        validity,
        qLine: qLine ? qLine.trim() : '',
        altitudes,
        position,
        text: expandNotamAbbreviations(e || compact)
    };
}

function extractField(text, letter) {
    // Extracts A) .... up to next X) or end
    const re = new RegExp(`\\b${letter}\\)\\s*([^\\n]+(?:\\n(?![A-Z]\\)\\s).+)*)`, 'i');
    const m = text.match(re);
    if (!m) return '';
    // stop at next "X)" if included
    return m[1].split(/\n\s*[A-Z]\)\s/)[0].trim();
}

function decodeQLine(qLine) {
    // Common ICAO Q-line format:
    // Q) EGTT/QMRLC/IV/NBO/A/000/999/5321N00216W005
    const parts = qLine.split('/').map((s) => s.trim());
    if (parts.length < 2) return null;

    const qCode = parts[1] || '';
    const lower = parts[6] || '';
    const upper = parts[7] || '';
    const pos = parts[8] || '';

    const altitudes = (lower || upper) ? `FL${lower || '---'} to FL${upper || '---'}` : '';
    const position = pos ? decodeQPosition(pos) : '';

    return { qCode, altitudes, position };
}

function decodeQPosition(pos) {
    // Example: 5321N00216W005 (lat/lon + radius NM)
    const m = pos.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])(\d{3})$/);
    if (!m) return pos;

    const latDeg = m[1];
    const latMin = m[2];
    const latHem = m[3];
    const lonDeg = m[4];
    const lonMin = m[5];
    const lonHem = m[6];
    const radiusNm = parseInt(m[7], 10);

    return `${latDeg}°${latMin}'${latHem} ${lonDeg}°${lonMin}'${lonHem} within ${radiusNm} NM`;
}

function extractNotamId(text) {
    // Try patterns like A1234/24 or B1234/24
    const m = text.match(/\b([A-Z]\d{4}\/\d{2})\b/);
    if (m) return m[1];
    return '';
}

function extractValidity(text) {
    // Match ICAO-ish time ranges: YYMMDDHHMM - YYMMDDHHMM or similar
    const m = text.match(/\b(\d{10})\s*(?:-|TO)\s*(\d{10}|PERM)\b/i);
    if (!m) return '';
    return `${m[1]} to ${m[2]}`;
}

function formatValidity(b, c) {
    if (!b && !c) return '';
    if (b && c) return `${b} to ${c}`;
    if (b) return `From ${b}`;
    return `Until ${c}`;
}

function buildNotamSummary(items) {
    if (!Array.isArray(items) || items.length === 0) return '';

    const runway = items.filter((n) => /\bRWY\b/i.test(n.text || '')).length;
    const taxiway = items.filter((n) => /\bTWY\b/i.test(n.text || '')).length;
    const nav = items.filter((n) => /\b(VOR|DME|ILS|LOC|NDB)\b/i.test(n.text || '')).length;

    const parts = [`Total: ${items.length}`];
    if (runway) parts.push(`Runway-related: ${runway}`);
    if (taxiway) parts.push(`Taxiway-related: ${taxiway}`);
    if (nav) parts.push(`Nav/procedures: ${nav}`);

    return parts.join(' • ');
}

function expandNotamAbbreviations(text) {
    if (!text) return '';

    const map = {
        'RWY': 'Runway',
        'TWY': 'Taxiway',
        'APRON': 'Apron',
        'CLSD': 'Closed',
        'SVC': 'Service',
        'U/S': 'Unserviceable',
        'UNSERVICEABLE': 'Unserviceable',
        'OPR': 'Operational',
        'OBST': 'Obstacle',
        'LGT': 'Light',
        'LGTS': 'Lights',
        'PAPI': 'PAPI',
        'RCLL': 'Runway centerline lights',
        'TDZ': 'Touchdown zone',
        'WIP': 'Work in progress',
        'MEN AND EQUIP': 'Men and equipment',
        'DEP': 'Departure',
        'ARR': 'Arrival',
        'SIDs': 'Standard instrument departures',
        'STARs': 'Standard terminal arrival routes',
        'PROC': 'Procedure',
        'TWR': 'Tower',
        'GND': 'Ground',
        'ATC': 'Air traffic control',
        'RAMP': 'Ramp',
        'NAV': 'Navigation',
        'VFR': 'Visual flight rules',
        'IFR': 'Instrument flight rules',
        'DLY': 'Daily',
        'EXC': 'Except',
        'BTN': 'Between'
    };

    // Replace whole-word abbreviations only
    let out = text;
    for (const [abbr, full] of Object.entries(map)) {
        const re = new RegExp(`\\b${escapeRegExp(abbr)}\\b`, 'g');
        out = out.replace(re, full);
    }

    // Normalize whitespace and keep original punctuation as much as possible
    return out.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
