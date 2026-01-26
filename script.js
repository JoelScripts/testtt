// METAR Decoder Script

// Fetch METAR data from API
async function fetchMetar() {
    const icaoInput = document.getElementById('icao-input');
    const icaoCode = icaoInput.value.trim().toUpperCase();
    const resultSection = document.getElementById('result-section');
    const output = document.getElementById('decoded-output');
    const fetchBtn = document.getElementById('fetch-btn');
    
    // Validate ICAO code
    if (!icaoCode) {
        output.innerHTML = '<div class="error">Please enter an ICAO code.</div>';
        resultSection.style.display = 'block';
        return;
    }
    
    if (!validateIcaoCode(icaoCode)) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = 'Invalid ICAO code. Please enter a 4-character airport code (e.g., KJFK, EGLL, KSFO).';
        output.innerHTML = '';
        output.appendChild(errorDiv);
        resultSection.style.display = 'block';
        return;
    }
    
    // Show loading state
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = `⏳ Fetching METAR data for ${icaoCode}...`;
    output.innerHTML = '';
    output.appendChild(loadingDiv);
    resultSection.style.display = 'block';
    
    try {
        if (window.location && window.location.protocol === 'file:') {
            throw new Error('Live fetching is blocked when opening this page directly from your disk (file://). Run it via a local web server (e.g., VS Code Live Server) or use the deployed GitHub Pages site, then try again.');
        }

        // Try multiple METAR data sources
        let metarData = null;
        let lastError = null;
        
        // Encode the ICAO code to prevent URL injection
        const encodedIcao = encodeURIComponent(icaoCode);
        
        // Primary source: VATSIM METAR endpoint (CORS-friendly for browser apps)
        // Example: https://metar.vatsim.net/EGCC
        try {
            const url = `https://metar.vatsim.net/${encodedIcao}`;
            const response = await fetch(url);
            if (response.ok) {
                metarData = await response.text();
            }
        } catch (e) {
            lastError = e;
        }

        // Fallback: alternate VATSIM URL format
        if (!metarData || metarData.trim() === '') {
            try {
                const url = `https://metar.vatsim.net/metar.php?id=${encodedIcao}`;
                const response = await fetch(url);
                if (response.ok) {
                    metarData = await response.text();
                }
            } catch (e) {
                lastError = e;
            }
        }
        
        // Check if METAR data was successfully retrieved
        if (!metarData || metarData.trim() === '' || metarData.includes('No METAR found')) {
            const extraDetail = lastError ? `\n\nLast error: ${lastError.message || String(lastError)}` : '';
            throw new Error(
                `Unable to fetch METAR data for ${icaoCode}. This may be due to:\n- Invalid airport code\n- No recent weather reports available\n- Network restrictions or temporary endpoint issues\n\nYou can manually enter the METAR code below if you have it.` + extraDetail
            );
        }
        
        // Populate the manual input field with fetched data
        document.getElementById('metar-input').value = metarData.trim();
        
        // Decode the fetched METAR
        const decoded = parseMetar(metarData.trim());
        displayResults(decoded, metarData.trim());
        resultSection.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching METAR:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        
        const title = document.createElement('strong');
        title.textContent = '⚠️ Error fetching METAR data:';
        errorDiv.appendChild(title);
        errorDiv.appendChild(document.createElement('br'));
        
        const errorMessage = error.message || 'Failed to fetch METAR data';
        const lines = errorMessage.split('\n');
        lines.forEach((line, index) => {
            if (index > 0) errorDiv.appendChild(document.createElement('br'));
            errorDiv.appendChild(document.createTextNode(line));
        });
        errorDiv.appendChild(document.createElement('br'));
        errorDiv.appendChild(document.createElement('br'));
        
        const tip = document.createElement('em');
        tip.textContent = 'Alternative: Use the manual input section below to decode METAR codes.';
        errorDiv.appendChild(tip);
        
        output.innerHTML = '';
        output.appendChild(errorDiv);
        resultSection.style.display = 'block';
    } finally {
        // Reset button state
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch Current METAR';
    }
}

// Fetch and decode VATSIM ATIS data
async function fetchAtis() {
    const atisIcaoInput = document.getElementById('atis-icao-input');
    const icaoCode = atisIcaoInput.value.trim().toUpperCase();
    const atisResultSection = document.getElementById('atis-result-section');
    const atisOutput = document.getElementById('atis-output');
    const fetchAtisBtn = document.getElementById('fetch-atis-btn');
    
    // Validate ICAO code
    if (!icaoCode) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = 'Please enter an ICAO code.';
        atisOutput.innerHTML = '';
        atisOutput.appendChild(errorDiv);
        atisResultSection.style.display = 'block';
        return;
    }
    
    if (!validateIcaoCode(icaoCode)) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = 'Invalid ICAO code. Please enter a 4-character airport code (e.g., KJFK, EGLL, KSFO).';
        atisOutput.innerHTML = '';
        atisOutput.appendChild(errorDiv);
        atisResultSection.style.display = 'block';
        return;
    }
    
    // Show loading state
    fetchAtisBtn.disabled = true;
    fetchAtisBtn.textContent = 'Fetching...';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = `⏳ Fetching VATSIM ATIS data for ${icaoCode}...`;
    atisOutput.innerHTML = '';
    atisOutput.appendChild(loadingDiv);
    atisResultSection.style.display = 'block';
    
    try {
        if (window.location && window.location.protocol === 'file:') {
            throw new Error('Live fetching is blocked when opening this page directly from your disk (file://). Run it via a local web server (e.g., VS Code Live Server) or use the deployed GitHub Pages site, then try again.');
        }

        // Fetch ATIS from the official VATSIM public data feed (browser/CORS-friendly)
        const vatsimDataUrls = [
            'https://data.vatsim.net/v3/vatsim-data.json',
            'https://cdn.vatsim.net/vatsim-data.json'
        ];

        let vatsimData = null;
        let lastError = null;

        for (const url of vatsimDataUrls) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`VATSIM feed request failed with status ${response.status}`);
                }
                vatsimData = await response.json();
                break;
            } catch (e) {
                lastError = e;
            }
        }

        if (!vatsimData || !Array.isArray(vatsimData.atis)) {
            const extraDetail = lastError ? ` Last error: ${lastError.message || String(lastError)}` : '';
            throw new Error(`Unable to load VATSIM data feed.${extraDetail}`);
        }

        const upperIcao = icaoCode.toUpperCase();
        const prefix = `${upperIcao}_`;

        const matches = vatsimData.atis
            .filter((a) => typeof a?.callsign === 'string')
            .filter((a) => a.callsign.toUpperCase().startsWith(prefix));

        if (matches.length === 0) {
            throw new Error(`No VATSIM ATIS found for ${icaoCode}. This airport may not have active ATC/ATIS on VATSIM at the moment.`);
        }

        // Prefer the "{ICAO}_ATIS" callsign when present, otherwise choose the most detailed entry.
        const preferred = matches
            .slice()
            .sort((a, b) => {
                const aCallsign = a.callsign.toUpperCase();
                const bCallsign = b.callsign.toUpperCase();
                const aExact = aCallsign === `${upperIcao}_ATIS` ? 1 : 0;
                const bExact = bCallsign === `${upperIcao}_ATIS` ? 1 : 0;
                if (aExact !== bExact) return bExact - aExact;

                const aText = Array.isArray(a.text_atis) ? a.text_atis.join(' ') : (a.text_atis || '');
                const bText = Array.isArray(b.text_atis) ? b.text_atis.join(' ') : (b.text_atis || '');
                return (bText.length || 0) - (aText.length || 0);
            })[0];

        const atisLines = Array.isArray(preferred.text_atis)
            ? preferred.text_atis.filter(Boolean)
            : [preferred.text_atis].filter(Boolean);

        const atisText = atisLines.join(' ').trim();
        if (!atisText) {
            throw new Error(`VATSIM ATIS was found for ${icaoCode} but contained no text.`);
        }

        // Decode and display the ATIS
        displayAtisResults(atisText, icaoCode);
        atisResultSection.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching ATIS:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        
        const title = document.createElement('strong');
        title.textContent = '⚠️ Error fetching VATSIM ATIS:';
        errorDiv.appendChild(title);
        errorDiv.appendChild(document.createElement('br'));
        errorDiv.appendChild(document.createElement('br'));
        
        let errorMessage = error.message || 'Failed to fetch ATIS data';
        if (errorMessage === 'Failed to fetch') {
            errorMessage = 'Failed to fetch ATIS data (network/CORS blocked). Try again, or verify you are online.';
        }
        errorDiv.appendChild(document.createTextNode(errorMessage));
        errorDiv.appendChild(document.createElement('br'));
        errorDiv.appendChild(document.createElement('br'));
        
        const tip = document.createElement('em');
        tip.textContent = 'Note: ATIS is only available when ATC is active at this airport on VATSIM.';
        errorDiv.appendChild(tip);
        
        atisOutput.innerHTML = '';
        atisOutput.appendChild(errorDiv);
        atisResultSection.style.display = 'block';
    } finally {
        // Reset button state
        fetchAtisBtn.disabled = false;
        fetchAtisBtn.textContent = 'Fetch & Decode ATIS';
    }
}

// Display decoded ATIS results
function displayAtisResults(atisText, icaoCode) {
    const atisOutput = document.getElementById('atis-output');
    atisOutput.innerHTML = '';
    
    // Create collapsible container for raw ATIS
    const rawDetails = document.createElement('details');
    rawDetails.className = 'raw-details';
    const rawSummary = document.createElement('summary');
    rawSummary.textContent = 'Raw ATIS';
    const rawContent = document.createElement('div');
    rawContent.className = 'raw-metar';
    rawContent.textContent = atisText;
    rawDetails.appendChild(rawSummary);
    rawDetails.appendChild(rawContent);
    atisOutput.appendChild(rawDetails);
    
    // Decode ATIS information
    const decoded = decodeAtis(atisText, icaoCode);
    
    // Display decoded sections in a compact grid
    const grid = document.createElement('div');
    grid.className = 'decode-grid';
    Object.entries(decoded).forEach(([key, value]) => {
        if (value) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'decode-item';

            const label = document.createElement('strong');
            label.textContent = key;
            itemDiv.appendChild(label);

            const content = document.createElement('p');
            content.textContent = value;
            itemDiv.appendChild(content);

            grid.appendChild(itemDiv);
        }
    });
    atisOutput.appendChild(grid);
}

// Decode ATIS text into human-readable format
function decodeAtis(atisText, icaoCode) {
    const normalized = (atisText || '').replace(/\s+/g, ' ').trim();
    const upper = normalized.toUpperCase();

    const decoded = {
        '🏢 Airport': icaoCode,
        '📻 Information': '',
        '🕐 Time': '',
        '🛬 Runway(s)': '',
        '🧭 Transition Level': '',
        '💨 Wind': '',
        '👁️ Visibility': '',
        '🌦️ Weather': '',
        '☁️ Sky Condition': '',
        '🌡️ Temperature': '',
        '💧 Dewpoint': '',
        '📊 Altimeter/QNH': '',
        '📈 Trend': '',
        '📝 Remarks': ''
    };

    // NATO phonetic alphabet for information letter matching
    const natoPhonetic = [
        'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
        'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
        'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY',
        'XRAY', 'YANKEE', 'ZULU'
    ];

    // Extract information letter (e.g., "INFORMATION A", "ATIS BRAVO")
    const infoPattern = new RegExp(`(?:INFORMATION|ATIS)\\s+([A-Z]|${natoPhonetic.join('|')})`, 'i');
    const infoMatch = normalized.match(infoPattern);
    if (infoMatch) {
        decoded['📻 Information'] = `Information ${infoMatch[1].toUpperCase()}`;
    }

    // Extract time (often "TIME 1450Z" or "1450Z")
    const timeMatch = normalized.match(/(?:TIME\s*)?(\d{4})\s*(?:ZULU|UTC|Z)\b/i);
    if (timeMatch) {
        const timeStr = timeMatch[1];
        decoded['🕐 Time'] = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)} UTC`;
    }

    // Extract runway(s) (handles: "RUNWAY IN USE RWY 05L", "RWY 27 AND 27R", "ARRIVAL RUNWAY 09")
    const arrivalRunways = extractRunwaysByContext(upper, /(ARRIVAL|LANDING|LDG)/);
    const departureRunways = extractRunwaysByContext(upper, /(DEPARTURE|DEPARTING|DEP|TAKEOFF|TKOF)/);
    const inUseRunways = extractRunwaysByContext(upper, /(IN\s+USE|ACTIVE)/);
    const anyRunways = extractAnyRunways(upper);

    const runwayText = buildRunwaySummary(arrivalRunways, departureRunways, inUseRunways, anyRunways);
    if (runwayText) decoded['🛬 Runway(s)'] = runwayText;

    // Transition Level
    const tlMatch = normalized.match(/\bTRANSITION\s+LEVEL\s+(\d{1,3})\b/i) || normalized.match(/\bTL\s*(\d{1,3})\b/i);
    if (tlMatch) {
        decoded['🧭 Transition Level'] = `FL${String(tlMatch[1]).padStart(2, '0')}`;
    }

    // Parse METAR-like weather tokens embedded in ATIS
    const tokens = tokenizeAtisToTokens(upper);
    const metarBits = parseMetarLikeBits(tokens);

    if (metarBits.wind) decoded['💨 Wind'] = metarBits.wind;
    if (metarBits.visibility) decoded['👁️ Visibility'] = metarBits.visibility;
    if (metarBits.weather) decoded['🌦️ Weather'] = metarBits.weather;
    if (metarBits.clouds) decoded['☁️ Sky Condition'] = metarBits.clouds;
    if (metarBits.temperature) decoded['🌡️ Temperature'] = metarBits.temperature;
    if (metarBits.dewpoint) decoded['💧 Dewpoint'] = metarBits.dewpoint;
    if (metarBits.altimeter) decoded['📊 Altimeter/QNH'] = metarBits.altimeter;
    if (metarBits.trend) decoded['📈 Trend'] = metarBits.trend;

    // If we didn't find weather via tokens, fall back to phrase-based visibility/wind/clouds.
    if (!decoded['💨 Wind']) {
        const windPhrase = normalized.match(/\bWIND\s+(CALM|VARIABLE)\b/i);
        if (windPhrase && /CALM/i.test(windPhrase[1])) decoded['💨 Wind'] = 'Wind calm';
        if (windPhrase && /VARIABLE/i.test(windPhrase[1])) {
            const v = normalized.match(/\bWIND\s+VARIABLE\s+(?:AT\s+)?(\d{1,3})\s*(?:KNOTS?|KTS?|KT)\b/i);
            if (v) decoded['💨 Wind'] = `Variable wind at ${v[1]} knots`;
        }
    }
    if (!decoded['👁️ Visibility']) {
        const visMatch = normalized.match(/\bVISIBILITY\s+(\d+)(?:\s+(?:STATUTE\s+)?MILES?|SM)?\b/i);
        if (visMatch) decoded['👁️ Visibility'] = `${visMatch[1]} statute miles`;
        else if (normalized.match(/\bVISIBILITY\s+(?:ONE\s+ZERO|10)\s*(?:KILOMETERS?|KM)\b/i)) {
            decoded['👁️ Visibility'] = '10 kilometers or more';
        }
    }

    // Remarks: show remaining non-weather operational sentences.
    decoded['📝 Remarks'] = extractOperationalSentences(normalized);

    return decoded;
}

function tokenizeAtisToTokens(upperText) {
    return (upperText || '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[.,;:()\[\]{}]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
}

function parseMetarLikeBits(tokens) {
    const bits = {
        wind: '',
        visibility: '',
        weather: '',
        clouds: '',
        temperature: '',
        dewpoint: '',
        altimeter: '',
        trend: ''
    };

    if (!Array.isArray(tokens) || tokens.length === 0) return bits;

    // Wind token: 11004KT, VRB03KT, 00000KT
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?KT$/.test(t)) {
            bits.wind = decodeAtisWindToken(t);
            if (tokens[i + 1] && /^\d{3}V\d{3}$/.test(tokens[i + 1])) {
                const [from, to] = tokens[i + 1].split('V');
                bits.wind += ` (varying ${from}°–${to}°)`;
            }
            break;
        }
    }

    // Visibility token: 9999, 4000, 10SM, CAVOK
    for (const t of tokens) {
        if (t === 'CAVOK' || t === '9999' || /^\d{4}$/.test(t) || /^\d+SM$/.test(t)) {
            bits.visibility = stripKnownPrefix(decodeVisibility(t));
            break;
        }
    }

    // Weather phenomena: -RA, SHRA, TSRA, BR, FG, etc. (strict METAR-style tokens only)
    const wx = [];
    for (const t of tokens) {
        if (isMetarWeatherTokenStrict(t)) wx.push(t);
    }
    if (wx.length) {
        bits.weather = stripKnownPrefix(decodeWeather(uniquePreserveOrder(wx)));
    }

    // Clouds: BKN030, FEW020, SCT050CB, OVC/// etc (keep common)
    const cloudGroups = [];
    for (const t of tokens) {
        if (
            /^(FEW|SCT|BKN|OVC|VV)\d{3}([A-Z]{2,3})?$/.test(t) ||
            t === 'CLR' || t === 'SKC' || t === 'NSC' || t === 'NCD' || t === 'CAVOK'
        ) {
            cloudGroups.push(t);
        }
    }
    if (cloudGroups.length) {
        bits.clouds = stripKnownPrefix(decodeClouds(uniquePreserveOrder(cloudGroups)));
    }

    // Temperature/Dewpoint: 04/00, M05/M10
    for (const t of tokens) {
        if (/^M?\d{2}\/M?\d{2}$/.test(t)) {
            const { temperature, dewpoint } = decodeTempDew(t);
            bits.temperature = temperature;
            bits.dewpoint = dewpoint;
            break;
        }
    }

    // QNH / Altimeter: Q1013, A2992, or "QNH 1013"
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^(Q\d{4}|A\d{4})$/.test(t)) {
            bits.altimeter = stripKnownPrefix(decodeAltimeter(t));
            break;
        }
        if (t === 'QNH' && tokens[i + 1] && /^\d{3,4}$/.test(tokens[i + 1])) {
            const raw = tokens[i + 1];
            const hpa = parseInt(raw.length === 3 ? `0${raw}` : raw, 10);
            bits.altimeter = formatQnh(hpa);
            break;
        }
    }

    // Trend
    const trends = [];
    for (const t of tokens) {
        if (['NOSIG', 'TEMPO', 'BECMG', 'NSW'].includes(t)) trends.push(t);
    }
    if (trends.length) {
        bits.trend = trends.join(' ');
    }

    return bits;
}

function isMetarWeatherTokenStrict(token) {
    if (!token) return false;
    // Examples: -RA, SHRA, TSRA, FZFG, VCTS, BR, HZ, +SN
    return /^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/.test(token);
}

function decodeAtisWindToken(token) {
    if (token === '00000KT') return 'Wind calm';
    if (token.startsWith('VRB')) {
        const m = token.match(/^VRB(\d{2,3})(G\d{2,3})?KT$/);
        if (!m) return 'Variable wind';
        const speed = parseInt(m[1], 10);
        const gust = m[2] ? parseInt(m[2].substring(1), 10) : null;
        let s = `Variable wind at ${speed} knots`;
        if (gust != null) s += `, gusting ${gust} knots`;
        return s;
    }
    return decodeWind(token);
}

function decodeTempDew(tempStr) {
    const [tRaw, dRaw] = tempStr.split('/');
    const toC = (v) => (v.startsWith('M') ? -parseInt(v.substring(1), 10) : parseInt(v, 10));
    const toF = (c) => Math.round((c * 9 / 5) + 32);
    const tC = toC(tRaw);
    const dC = toC(dRaw);
    return {
        temperature: `${tC}°C (${toF(tC)}°F)`,
        dewpoint: `${dC}°C (${toF(dC)}°F)`
    };
}

function formatQnh(hpa) {
    if (!Number.isFinite(hpa)) return '';
    const inHg = (hpa * 0.02953);
    return `${hpa} hPa (${inHg.toFixed(2)} inHg)`;
}

function stripKnownPrefix(text) {
    if (!text) return '';
    return String(text)
        .replace(/^Visibility:\s*/i, '')
        .replace(/^Weather:\s*/i, '')
        .replace(/^Sky condition:\s*/i, '')
        .replace(/^Altimeter(?:\s*\(QNH\))?:\s*/i, '')
        .replace(/^Temperature:\s*/i, '')
        .trim();
}

function uniquePreserveOrder(arr) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        if (!seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    }
    return out;
}

function extractRunwaysByContext(upperText, contextRegex) {
    const runways = [];
    const re = new RegExp(`\\b${contextRegex.source}\\b[^.]*?\\b(?:RUNWAY|RUNWAYS?|RWY|RWYS?)\\b[^0-9]*((?:\\d{1,2}[LRC]?)(?:\\s*(?:AND|&|,|\\/)\\s*\\d{1,2}[LRC]?)*)(?=\\b|\\.|$)`, 'g');
    let m;
    while ((m = re.exec(upperText)) !== null) {
        const runwayList = m[m.length - 1];
        runways.push(...splitRunwayList(runwayList));
    }
    return uniquePreserveOrder(runways);
}

function extractAnyRunways(upperText) {
    const runways = [];
    const re = /\b(?:RUNWAY|RUNWAYS?|RWY|RWYS?)\b[^0-9]*((?:\d{1,2}[LRC]?)(?:\s*(?:AND|&|,|\/)\s*\d{1,2}[LRC]?)*)(?=\b|\.|$)/g;
    let m;
    while ((m = re.exec(upperText)) !== null) {
        runways.push(...splitRunwayList(m[1]));
    }
    return uniquePreserveOrder(runways);
}

function splitRunwayList(listText) {
    if (!listText) return [];
    return listText
        .split(/\s*(?:AND|&|,|\/)\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.padStart(2, '0'));
}

function buildRunwaySummary(arrival, departure, inUse, any) {
    const a = (arrival && arrival.length) ? arrival.join(', ') : '';
    const d = (departure && departure.length) ? departure.join(', ') : '';
    const u = (inUse && inUse.length) ? inUse.join(', ') : '';
    const anyRwy = (any && any.length) ? any.join(', ') : '';

    if (a || d) {
        const parts = [];
        if (a) parts.push(`Arrival: ${a}`);
        if (d) parts.push(`Departure: ${d}`);
        return parts.join(' • ');
    }
    if (u) return `In use: ${u}`;
    if (anyRwy) return anyRwy;
    return '';
}

function extractOperationalSentences(text) {
    if (!text) return '';
    const sentences = text
        .split(/\.(?:\s+|$)/)
        .map((s) => s.trim())
        .filter(Boolean);

    const looksWeatherish = (s) => {
        const u = s.toUpperCase();
        return (
            /\b(\d{3}|VRB)\d{2,3}(G\d{2,3})?KT\b/.test(u) ||
            /\b\d{3}V\d{3}\b/.test(u) ||
            /\b(CAVOK|9999|\d{4}|\d+SM)\b/.test(u) ||
            /\b(FEW|SCT|BKN|OVC|VV)\d{3}[A-Z]{0,3}\b/.test(u) ||
            /\b(M?\d{2}\/M?\d{2})\b/.test(u) ||
            /\b(Q\d{4}|A\d{4}|QNH\s+\d{3,4})\b/.test(u) ||
            /\b(NOSIG|TEMPO|BECMG|NSW)\b/.test(u) ||
            // Only exclude runway sentences that actually specify runway designators (those are decoded separately)
            /\b(?:RUNWAY|RUNWAYS?|RWY|RWYS?)\b[^.]*\b\d{1,2}[LRC]?\b/.test(u) ||
            /\bTRANSITION\s+LEVEL\b/.test(u) ||
            /\bTL\s*\d{1,3}\b/.test(u)
        );
    };

    // Treat only a *header-only* opening line as a header (e.g. "MANCHESTER INFORMATION A").
    // Do not discard operational sentences that mention the word "information".
    const isHeader = (s) => {
        if (!s) return false;
        if (/^TIME\s+\d{4}\s*(?:ZULU|UTC|Z)?\s*$/i.test(s.trim())) return true;

        // Header-only: "<airport name> INFORMATION <letter>" or "<airport name> ATIS <letter>"
        const natoPhonetic = [
            'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
            'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
            'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY',
            'XRAY', 'YANKEE', 'ZULU'
        ];
        const headerOnly = new RegExp(`^\\s*[A-Za-z][A-Za-z\\s]{2,}\\s+(?:INFORMATION|ATIS)\\s+(?:[A-Z]|${natoPhonetic.join('|')})\\s*$`, 'i');
        return headerOnly.test(s);
    };

    const keep = sentences.filter((s) => !isHeader(s) && !looksWeatherish(s));
    return keep.join('. ');
}

// Validate ICAO code format
function validateIcaoCode(code) {
    // ICAO codes are exactly 4 alphanumeric characters (letters or numbers)
    const icaoPattern = /^[A-Z0-9]{4}$/;
    return icaoPattern.test(code);
}

function navigatePage() {
    const select = document.getElementById('site-nav');
    if (!select) return;
    const target = select.value;
    if (!target) return;
    window.location.href = target;
}

function decodeMetar() {
    const input = document.getElementById('metar-input').value.trim();
    const resultSection = document.getElementById('result-section');
    const output = document.getElementById('decoded-output');
    
    if (!input) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = 'Please enter a METAR code to decode.';
        output.innerHTML = '';
        output.appendChild(errorDiv);
        resultSection.style.display = 'block';
        return;
    }
    
    try {
        const decoded = parseMetar(input);
        displayResults(decoded, input);
        resultSection.style.display = 'block';
    } catch (error) {
        output.innerHTML = `<div class="error">Error decoding METAR: ${error.message}</div>`;
        resultSection.style.display = 'block';
    }
}

function parseMetar(metar) {
    const parts = metar.split(/\s+/);
    const decoded = {
        raw: metar,
        station: '',
        time: '',
        wind: '',
        visibility: '',
        weather: '',
        clouds: '',
        temperature: '',
        dewpoint: '',
        altimeter: '',
        remarks: ''
    };
    
    let i = 0;
    
    // Station identifier (4 letters)
    if (parts[i] && parts[i].match(/^[A-Z]{4}$/)) {
        decoded.station = decodeStation(parts[i]);
        i++;
    }
    
    // Date and time
    if (parts[i] && parts[i].match(/^\d{6}Z$/)) {
        decoded.time = decodeTime(parts[i]);
        i++;
    }
    
    // Wind
    if (parts[i] && parts[i].match(/^\d{3}\d{2,3}(G\d{2,3})?(KT|MPS|KMH)$/)) {
        decoded.wind = decodeWind(parts[i]);
        i++;
    } else if (parts[i] && parts[i] === 'VRB') {
        if (parts[i+1] && parts[i+1].match(/^\d{2,3}(KT|MPS|KMH)$/)) {
            const unitMatch = parts[i+1].match(/(KT|MPS|KMH)$/);
            const unit = unitMatch ? unitMatch[1] : 'KT';
            let unitText = 'knots';
            if (unit === 'MPS') unitText = 'meters per second';
            if (unit === 'KMH') unitText = 'kilometers per hour';
            decoded.wind = 'Variable wind at ' + parts[i+1].replace(/[A-Z]+$/, '') + ' ' + unitText;
            i += 2;
        }
    }
    
    // Variable wind direction
    if (parts[i] && parts[i].match(/^\d{3}V\d{3}$/)) {
        const [from, to] = parts[i].split('V');
        decoded.wind += ` (varying between ${from}° and ${to}°)`;
        i++;
    }
    
    // Visibility
    if (parts[i] && (parts[i].match(/^\d{4}$/) || parts[i].match(/^\d+SM$/) || parts[i] === 'CAVOK' || parts[i] === '9999')) {
        decoded.visibility = decodeVisibility(parts[i]);
        i++;
    }
    
    // Weather phenomena
    const weatherCodes = [];
    while (parts[i] && isWeatherPhenomenon(parts[i])) {
        weatherCodes.push(parts[i]);
        i++;
    }
    if (weatherCodes.length > 0) {
        decoded.weather = decodeWeather(weatherCodes);
    }
    
    // Cloud coverage
    const cloudGroups = [];
    while (parts[i] && (parts[i].match(/^(FEW|SCT|BKN|OVC|VV)\d{3}/) || parts[i] === 'CLR' || parts[i] === 'SKC' || parts[i] === 'NSC' || parts[i] === 'CAVOK')) {
        cloudGroups.push(parts[i]);
        i++;
    }
    if (cloudGroups.length > 0) {
        decoded.clouds = decodeClouds(cloudGroups);
    }
    
    // Temperature and dewpoint
    if (parts[i] && parts[i].match(/^M?\d{2}\/M?\d{2}$/)) {
        decoded.temperature = decodeTemperature(parts[i]);
        i++;
    }
    
    // Altimeter
    if (parts[i] && (parts[i].match(/^A\d{4}$/) || parts[i].match(/^Q\d{4}$/))) {
        decoded.altimeter = decodeAltimeter(parts[i]);
        i++;
    }
    
    // Remarks
    if (parts[i] && parts[i] === 'RMK') {
        decoded.remarks = 'Additional remarks: ' + parts.slice(i + 1).join(' ');
    }
    
    return decoded;
}

function decodeStation(code) {
    return `Station: ${code}`;
}

function decodeTime(timeStr) {
    const day = timeStr.substring(0, 2);
    const hour = timeStr.substring(2, 4);
    const minute = timeStr.substring(4, 6);
    return `Observed on day ${day} at ${hour}:${minute} UTC`;
}

function decodeWind(windStr) {
    const match = windStr.match(/^(\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS|KMH)$/);
    if (!match) return 'Wind information not available';
    
    const direction = match[1];
    const speed = match[2];
    const gust = match[4];
    const unit = match[5];
    
    let unitText = 'knots';
    if (unit === 'MPS') unitText = 'meters per second';
    if (unit === 'KMH') unitText = 'kilometers per hour';
    
    let text = `Wind from ${direction}° at ${parseInt(speed)} ${unitText}`;
    if (gust) {
        text += `, gusting to ${parseInt(gust)} ${unitText}`;
    }
    
    return text;
}

function decodeVisibility(visStr) {
    if (visStr === 'CAVOK') {
        return 'Visibility: CAVOK (Ceiling And Visibility OK - visibility 10km or more, no clouds below 5000ft, no significant weather)';
    }
    if (visStr === '9999') {
        return 'Visibility: 10 kilometers or more (excellent visibility)';
    }
    if (visStr.endsWith('SM')) {
        const miles = visStr.replace('SM', '');
        return `Visibility: ${miles} statute miles`;
    }
    if (visStr.match(/^\d{4}$/)) {
        return `Visibility: ${parseInt(visStr)} meters`;
    }
    return `Visibility: ${visStr}`;
}

function isWeatherPhenomenon(code) {
    const phenomena = ['RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'TS', 'SH', 'FZ', 'MI', 'BC', 'BL', 'DR', 'PR', 'VC'];
    const intensity = ['-', '+'];
    
    if (intensity.includes(code[0])) {
        code = code.substring(1);
    }
    
    for (const p of phenomena) {
        if (code.includes(p)) return true;
    }
    return false;
}

function decodeWeather(codes) {
    const weatherMap = {
        'RA': 'rain',
        'SN': 'snow',
        'DZ': 'drizzle',
        'FG': 'fog',
        'BR': 'mist',
        'HZ': 'haze',
        'TS': 'thunderstorm',
        'SH': 'showers',
        'FZ': 'freezing',
        'MI': 'shallow',
        'BC': 'patches',
        'BL': 'blowing',
        'DR': 'drifting',
        'PR': 'partial',
        'VC': 'in vicinity',
        '+': 'heavy',
        '-': 'light'
    };
    
    const descriptions = codes.map(code => {
        let intensity = '';
        let description = '';
        
        if (code.startsWith('+')) {
            intensity = 'Heavy ';
            code = code.substring(1);
        } else if (code.startsWith('-')) {
            intensity = 'Light ';
            code = code.substring(1);
        }
        
        // Parse the weather code
        for (const [key, value] of Object.entries(weatherMap)) {
            if (code.includes(key)) {
                description += value + ' ';
            }
        }
        
        return intensity + description.trim();
    });
    
    return 'Weather: ' + descriptions.join(', ');
}

function decodeClouds(cloudGroups) {
    const cloudMap = {
        'FEW': 'Few clouds',
        'SCT': 'Scattered clouds',
        'BKN': 'Broken clouds',
        'OVC': 'Overcast',
        'CLR': 'Clear skies',
        'SKC': 'Sky clear',
        'NSC': 'No significant clouds',
        'VV': 'Vertical visibility'
    };
    
    if (cloudGroups.includes('CAVOK') || cloudGroups.includes('CLR') || cloudGroups.includes('SKC') || cloudGroups.includes('NSC')) {
        return 'Sky condition: Clear';
    }
    
    const descriptions = cloudGroups.map(group => {
        const match = group.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/);
        if (match) {
            const type = match[1];
            const height = parseInt(match[2]) * 100;
            return `${cloudMap[type]} at ${height} feet`;
        }
        return group;
    });
    
    return 'Sky condition: ' + descriptions.join(', ');
}

function decodeTemperature(tempStr) {
    const [temp, dewpoint] = tempStr.split('/');
    
    const parseTemp = (t) => {
        if (t.startsWith('M')) {
            return `-${parseInt(t.substring(1))}°C`;
        }
        return `${parseInt(t)}°C`;
    };
    
    const tempC = parseTemp(temp);
    const dewpointC = parseTemp(dewpoint);
    
    // Convert to Fahrenheit
    const toFahrenheit = (celsius) => {
        const c = parseInt(celsius.replace(/[^\d-]/g, ''));
        return Math.round((c * 9/5) + 32);
    };
    
    const tempF = toFahrenheit(tempC);
    const dewpointF = toFahrenheit(dewpointC);
    
    return `Temperature: ${tempC} (${tempF}°F), Dewpoint: ${dewpointC} (${dewpointF}°F)`;
}

function decodeAltimeter(altStr) {
    if (altStr.startsWith('A')) {
        const value = altStr.substring(1);
        const inHg = `${value.substring(0, 2)}.${value.substring(2)}`;
        return `Altimeter: ${inHg} inches of mercury`;
    } else if (altStr.startsWith('Q')) {
        const value = parseInt(altStr.substring(1));
        return `Altimeter (QNH): ${value} hectopascals`;
    }
    return altStr;
}

function displayResults(decoded, rawMetar) {
    const output = document.getElementById('decoded-output');
    
    let html = `
        <details class="raw-details">
            <summary>Raw METAR</summary>
            <div class="raw-metar">${rawMetar}</div>
        </details>
    `;
    
    const items = [
        { label: '📍 Station', value: decoded.station },
        { label: '🕐 Time', value: decoded.time },
        { label: '💨 Wind', value: decoded.wind },
        { label: '👁️ Visibility', value: decoded.visibility },
        { label: '🌦️ Weather', value: decoded.weather },
        { label: '☁️ Clouds', value: decoded.clouds },
        { label: '🌡️ Temperature', value: decoded.temperature },
        { label: '📊 Altimeter', value: decoded.altimeter },
        { label: '📝 Remarks', value: decoded.remarks }
    ];
    
    html += `<div class="decode-grid">`;
    items.forEach(item => {
        if (item.value) {
            html += `
                <div class="decode-item">
                    <strong>${item.label}</strong>
                    <p>${item.value}</p>
                </div>
            `;
        }
    });
    html += `</div>`;
    
    output.innerHTML = html;
}

function loadExample(example) {
    document.getElementById('metar-input').value = example;
    decodeMetar();
}

// Allow Enter key to decode (with Ctrl/Cmd)
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('metar-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            decodeMetar();
        }
    });
    
    // Allow Enter key to fetch METAR from ICAO input
    document.getElementById('icao-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchMetar();
        }
    });
    
    // Auto-uppercase ICAO input
    document.getElementById('icao-input').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Allow Enter key to fetch ATIS from ATIS ICAO input
    document.getElementById('atis-icao-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchAtis();
        }
    });
    
    // Auto-uppercase ATIS ICAO input
    document.getElementById('atis-icao-input').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
});
