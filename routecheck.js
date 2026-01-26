// Route Checker (SimBrief route sanity checks for VATSIM)

function navigatePage() {
    const select = document.getElementById('site-nav');
    if (!select) return;
    const target = select.value;
    if (!target) return;
    window.location.href = target;
}

function validateIcaoCode(code) {
    return /^[A-Z0-9]{4}$/.test(code);
}

function checkRoute() {
    const dep = (document.getElementById('route-dep')?.value || '').trim().toUpperCase();
    const arr = (document.getElementById('route-arr')?.value || '').trim().toUpperCase();
    const regionPref = (document.getElementById('route-region')?.value || 'auto').toLowerCase();
    const navDb = (document.getElementById('nav-db')?.value || 'builtin').toLowerCase();
    const raw = (document.getElementById('route-input')?.value || '').trim();

    const resultSection = document.getElementById('route-result-section');
    const output = document.getElementById('route-output');

    output.innerHTML = '';
    resultSection.style.display = 'block';

    if (!raw) {
        output.appendChild(makeError('Please paste a route to check.'));
        return;
    }

    if (dep && !validateIcaoCode(dep)) {
        output.appendChild(makeError('Departure ICAO is invalid. Use 4 characters (e.g., EGLL).'));
        return;
    }

    if (arr && !validateIcaoCode(arr)) {
        output.appendChild(makeError('Arrival ICAO is invalid. Use 4 characters (e.g., KJFK).'));
        return;
    }

    const normalized = normalizeRouteText(raw);
    const tokens = tokenizeRoute(normalized);

    const { status, reasons, suggestions, parsed } = analyzeRoute(tokens, dep, arr, regionPref);

    // Suggested improved route (format cleanup / ATC-friendly)
    const region = detectRegion(dep, arr, regionPref);
    const suggestion = suggestBetterRoute(tokens, dep, arr, region);

    // Status card
    const statusCard = document.createElement('div');
    statusCard.className = 'decode-item';

    const pill = document.createElement('div');
    pill.className = `status-pill ${status.className}`;
    pill.textContent = status.label;
    statusCard.appendChild(pill);

    const st = document.createElement('p');
    st.textContent = status.description;
    statusCard.appendChild(st);

    output.appendChild(statusCard);

    // Parsed summary
    output.appendChild(makeCard('🧩 Parsed', parsed));

    // Navigraph note (requires backend)
    if (navDb === 'navigraph') {
        output.appendChild(
            makeCard(
                '🗺️ Navigraph AIRAC',
                'Using Navigraph AIRAC to truly validate waypoints/airways requires a backend service (to keep credentials private and comply with licensing).\n\nThis page currently provides best-effort format + region heuristics and a cleaned route suggestion.'
            )
        );
    }

    // Better route suggestion
    if (suggestion?.route) {
        output.appendChild(makeCard('🛣️ Suggested Route (cleanup)', suggestion.route, true));
        if (suggestion.notes?.length) {
            output.appendChild(makeCard('📝 Why this is better', suggestion.notes.join('\n')));
        }
    }

    // Reasons
    if (reasons.length) {
        output.appendChild(makeCard('⚠️ Flags', reasons.join('\n')));
    }

    // Suggestions
    if (suggestions.length) {
        output.appendChild(makeCard('✅ Suggestions', suggestions.join('\n')));
    }

    // Tokens (collapsed)
    const details = document.createElement('details');
    details.className = 'raw-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Route tokens';
    const body = document.createElement('div');
    body.className = 'raw-metar';
    body.textContent = tokens.join(' ');
    details.appendChild(summary);
    details.appendChild(body);
    output.appendChild(details);
}

function normalizeRouteText(text) {
    // Remove common prefixes from SimBrief/OFP
    let t = String(text)
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/^\s*ROUTE\s*[:=-]?\s*/i, '')
        .replace(/^\s*RTE\s*[:=-]?\s*/i, '')
        .trim();

    // Collapse spaces and uppercase
    t = t.replace(/\s+/g, ' ').toUpperCase();

    return t;
}

function tokenizeRoute(route) {
    return route
        .split(' ')
        .map((t) => t.trim())
        .filter(Boolean);
}

function analyzeRoute(tokens, dep, arr, regionPref) {
    const reasons = [];
    const suggestions = [];

    const region = detectRegion(dep, arr, regionPref);

    const illegal = tokens.find((t) => /[^A-Z0-9\/\-]/.test(t));
    if (illegal) {
        return {
            status: {
                label: 'Invalid format',
                className: 'status-bad',
                description: `Route contains invalid characters in token: ${illegal}`
            },
            reasons: ['Only letters/numbers and / - are expected in a route line.'],
            suggestions: ['Remove commas/periods/special symbols and try again.'],
            parsed: buildParsedSummary(tokens, dep, arr, region)
        };
    }

    // Count DCT usage (region-aware)
    const dctCount = tokens.filter((t) => t === 'DCT').length;
    const dctWarn = region.family === 'europe' ? 3 : 5;
    const dctHeavy = region.family === 'europe' ? 5 : 8;
    if (dctCount >= dctHeavy) {
        reasons.push(`Heavy DCT usage (${dctCount}x) for ${region.label}. You will often be rerouted onto airways.`);
        suggestions.push(region.family === 'europe'
            ? 'Try a route with more airways (UL/UM/UN/UT/UQ/etc) and fewer DCT segments.'
            : 'DCT is common in the US, but excessive DCT can still trigger amendments. Consider adding airways (J/Q/V/T) where appropriate.'
        );
    } else if (dctCount >= dctWarn) {
        reasons.push(`Moderate DCT usage (${dctCount}x) for ${region.label}. You may get a reroute depending on the sector.`);
    }

    // Airway presence expectations (Europe tends to be airway-heavy)
    const airwayCount = tokens.filter((t) => /^(U|UL|UM|UN|UT|UZ|T|Q|J|V)\d{1,3}[A-Z]?$/.test(t)).length;
    const hasAnyAirway = airwayCount > 0;
    const nonDctTokens = tokens.filter((t) => t !== 'DCT');
    const seemsEnroute = nonDctTokens.length >= 6;
    if (region.family === 'europe' && seemsEnroute && !hasAnyAirway) {
        reasons.push('No airway designators detected. In Europe/UK, fully “direct-to” routes are commonly amended to preferred airways.');
        suggestions.push('Add upper airways (e.g., UL9/UN14/UMxxx) where appropriate, or use your vACC preferred route.');
    }

    // Departure/arrival placement checks
    const firstIcao = tokens.find((t) => validateIcaoCode(t));
    const lastIcao = [...tokens].reverse().find((t) => validateIcaoCode(t));

    if (dep) {
        const startsWithDep = tokens[0] === dep || firstIcao === dep;
        if (!startsWithDep) {
            reasons.push(`Route does not appear to start at ${dep}.`);
            suggestions.push(`Ensure the route begins with ${dep} (or remove airport codes if your vACC prefers that format).`);
        }
    }

    if (arr) {
        const endsWithArr = tokens[tokens.length - 1] === arr || lastIcao === arr;
        if (!endsWithArr) {
            reasons.push(`Route does not appear to end at ${arr}.`);
            suggestions.push(`Ensure the route ends with ${arr} (or remove airport codes if your vACC prefers that format).`);
        }
    }

    // UK-focused hinting for common boundary/exit fixes (non-blocking)
    if (region.ukInvolved) {
        const ukBoundaryFixes = new Set([
            // Common UK/London area exits / entry points (not exhaustive)
            'DVR', 'DET', 'BIG', 'LAM', 'BPK', 'CPT', 'SAM', 'OCK',
            'BCN', 'WAL', 'POL', 'TLA', 'SFD', 'KENET', 'LOGAN',
            'GOW', 'KONAN', 'NANTI', 'MIMKU', 'LAPRA', 'BUZAD', 'BEXET'
        ]);
        const hasBoundaryFix = tokens.slice(0, 12).some((t) => ukBoundaryFixes.has(t));
        if (!hasBoundaryFix && tokens.length >= 8) {
            reasons.push('UK/Europe: no common UK boundary/exit fix detected early in the route. This can lead to a departure/entry reroute.');
            suggestions.push('If you are departing/arriving UK, check vNATS/vACC preferred routings and ensure you use the correct exit/entry fix for your runway/SID/STAR.');
        }
    }

    // SID/STAR/runway text in route line is often discouraged
    const hasRunway = tokens.some((t) => /^RW\d{2}[LRC]?$/.test(t) || /^\d{2}[LRC]?$/.test(t));
    const hasSidStarWords = tokens.some((t) => ['SID', 'STAR', 'DEPARTURE', 'ARRIVAL'].includes(t));
    const looksLikeProc = tokens.some((t) => /^(SID|STAR)[A-Z0-9]+$/.test(t));

    if (hasRunway || hasSidStarWords || looksLikeProc) {
        reasons.push('Route line appears to include runway/SID/STAR/procedure text. Many controllers expect those via the FMS/clearance, not in the enroute string.');
        suggestions.push('Consider removing runway/SID/STAR names from the route line unless your vACC specifically asks for them.');
    }

    // Transatlantic / oceanic sanity
    const hasNAT = tokens.some((t) => /^NAT[A-Z\d]{1,2}$/.test(t));
    const hasLatLon = tokens.some((t) => /^\d{2}[NS]\d{3}[EW]$/.test(t) || /^\d{4}[NS]\d{5}[EW]$/.test(t));
    const isTransatlantic = region.kind === 'transatlantic';
    if (isTransatlantic && !hasNAT && !hasLatLon) {
        reasons.push('Transatlantic route detected, but no NAT track or lat/long points found. You may be rerouted to an oceanic clearance.');
        suggestions.push('Include a valid NAT track (e.g., NATA) or published oceanic coordinates for your direction/time.');
    }
    if (!isTransatlantic && (hasNAT || hasLatLon) && region.family === 'europe') {
        reasons.push('Oceanic (NAT/lat-long) tokens found on a non-transatlantic Europe/UK route. This looks accidental.');
        suggestions.push('Remove the oceanic segment unless you are actually flying an oceanic portion.');
    }

    // NAT token sanity
    const natTokens = tokens.filter((t) => t.startsWith('NAT'));
    if (natTokens.length) {
        const malformed = natTokens.find((t) => !/^NAT[A-Z]$/.test(t) && !/^NAT\d{1,2}$/.test(t));
        if (malformed) {
            reasons.push(`NAT token looks unusual: ${malformed}.`);
            suggestions.push('If flying oceanic, use a valid track designator (e.g., NATA) or paste the track routing as published.');
        }
    }

    // Speed/level tokens (N0450F350) are okay, but warn if duplicated a lot
    const speedLevels = tokens.filter((t) => /^[KN]\d{4}F\d{3}$/.test(t));
    if (speedLevels.length > 2) {
        reasons.push('Multiple speed/level tokens found. Usually one is enough.');
    }

    // Very short routes
    const meaningful = tokens.filter((t) => t !== 'DCT');
    if (meaningful.length < 3) {
        reasons.push('Route is very short. This is likely incomplete.');
        suggestions.push('Paste the full enroute string from SimBrief (not just one waypoint).');
    }

    // Basic token-type distribution (heuristic)
    const tokenTypes = classifyTokens(tokens);
    if (tokenTypes.unknown.length > 0) {
        reasons.push(`Unrecognized tokens: ${tokenTypes.unknown.slice(0, 8).join(', ')}${tokenTypes.unknown.length > 8 ? '…' : ''}`);
        suggestions.push('Double-check for typos. This tool can’t confirm every waypoint/airway without a nav database.');
    }

    // Final status selection
    let status;
    if (reasons.some((r) => r.includes('Invalid') || r.includes('incomplete'))) {
        status = {
            label: 'Invalid format',
            className: 'status-bad',
            description: 'The route appears malformed or incomplete.'
        };
    } else if (reasons.length >= 2 || dctCount >= dctHeavy) {
        status = {
            label: 'Likely reroute',
            className: 'status-warn',
            description: 'The route may work, but ATC may amend it based on local preferred routings.'
        };
    } else {
        status = {
            label: 'Looks OK',
            className: 'status-ok',
            description: 'Format looks reasonable. Final acceptance depends on local vACC/ATC and current constraints.'
        };
    }

    if (!suggestions.length) {
        suggestions.push(region.family === 'europe'
            ? 'Check your vACC/vFIR preferred routes (UK: vNATS) for your city pair and runway direction.'
            : 'Check preferred routes for your city pair (US: FAA preferred routes / common ATC routings).'
        );
        suggestions.push('If ATC issues a reroute, read back and update the FMC route accordingly.');
    }

    return {
        status,
        reasons,
        suggestions,
        parsed: buildParsedSummary(tokens, dep, arr, region)
    };
}

function detectRegion(dep, arr, regionPref) {
    const d = (dep || '').toUpperCase();
    const a = (arr || '').toUpperCase();

    const looksEurope = (c) => c.startsWith('E');
    const looksUk = (c) => c.startsWith('EG');
    const looksUsCanada = (c) => c.startsWith('K') || c.startsWith('C') || c.startsWith('P');

    if (regionPref === 'uk-eu') {
        return { family: 'europe', kind: 'europe', label: 'UK/Europe', ukInvolved: true };
    }
    if (regionPref === 'us') {
        return { family: 'us', kind: 'us', label: 'US/Canada', ukInvolved: false };
    }

    const depEurope = d ? looksEurope(d) : false;
    const arrEurope = a ? looksEurope(a) : false;
    const depUk = d ? looksUk(d) : false;
    const arrUk = a ? looksUk(a) : false;
    const depUs = d ? looksUsCanada(d) : false;
    const arrUs = a ? looksUsCanada(a) : false;

    const ukInvolved = depUk || arrUk;

    // Transatlantic heuristics: Europe <-> US/Canada
    if ((depEurope && arrUs) || (arrEurope && depUs)) {
        return { family: 'europe', kind: 'transatlantic', label: 'Transatlantic (Europe ↔ US/Canada)', ukInvolved };
    }

    if (depEurope || arrEurope) {
        return { family: 'europe', kind: 'europe', label: ukInvolved ? 'UK/Europe' : 'Europe', ukInvolved };
    }

    if (depUs || arrUs) {
        return { family: 'us', kind: 'us', label: 'US/Canada', ukInvolved: false };
    }

    // Unknown: default to Europe-ish strictness (VATSIM tends to reroute direct routes in controlled airspace)
    return { family: 'europe', kind: 'unknown', label: 'Auto (default)', ukInvolved: false };
}

function classifyTokens(tokens) {
    const types = { airway: [], waypoint: [], coord: [], speedLevel: [], icao: [], dct: [], unknown: [] };

    for (const t of tokens) {
        if (t === 'DCT') {
            types.dct.push(t);
        } else if (validateIcaoCode(t)) {
            types.icao.push(t);
        } else if (/^[A-Z]{1,2}\d{1,3}[A-Z]?$/.test(t) || /^[A-Z]{1,2}\d{1,3}$/.test(t) || /^[A-Z]{1,2}\d{1,3}\w?$/.test(t)) {
            // broad airway-ish, will be refined below
            // leave classification to next checks
        }

        if (/^[A-Z]{1,3}\d{1,3}[A-Z]?$/.test(t) || /^[A-Z]{1,2}[A-Z]?\d{1,3}[A-Z]?$/.test(t)) {
            // some airways match this, but so do some waypoint idents; check more specific below
        }

        if (/^[KN]\d{4}F\d{3}$/.test(t)) {
            types.speedLevel.push(t);
        } else if (/^\d{2}[NS]\d{3}[EW]$/.test(t) || /^\d{4}[NS]\d{5}[EW]$/.test(t)) {
            // simple coordinate formats (limited)
            types.coord.push(t);
        } else if (/^[A-Z]{2,5}$/.test(t) || /^[A-Z]{2,5}\d$/.test(t)) {
            // waypoint-ish
            types.waypoint.push(t);
        } else if (/^(U|UL|UM|UN|UT|UZ|Q|L|M|N)\d{1,3}[A-Z]?$/.test(t)) {
            types.airway.push(t);
        } else if (t === 'DCT' || validateIcaoCode(t) || /^[KN]\d{4}F\d{3}$/.test(t)) {
            // already counted
        } else {
            // allow NAT tokens
            if (/^NAT[A-Z\d]{1,2}$/.test(t)) continue;
            // allow common oceanic waypoints like 52N020W (we don’t fully parse them)
            if (/^\d{2}N\d{3}W$/.test(t) || /^\d{2}N\d{3}E$/.test(t) || /^\d{2}S\d{3}W$/.test(t) || /^\d{2}S\d{3}E$/.test(t)) continue;
            // allow “DCT” already handled
            if (t === 'DCT') continue;

            types.unknown.push(t);
        }
    }

    return types;
}

function buildParsedSummary(tokens, dep, arr, region) {
    const firstIcao = tokens.find((t) => validateIcaoCode(t)) || '';
    const lastIcao = [...tokens].reverse().find((t) => validateIcaoCode(t)) || '';
    const dctCount = tokens.filter((t) => t === 'DCT').length;
    const airwayCount = tokens.filter((t) => /^(U|UL|UM|UN|UT|UZ|T|Q|J|V)\d{1,3}[A-Z]?$/.test(t)).length;

    const lines = [];
    if (region?.label) lines.push(`Region: ${region.label}`);
    if (dep) lines.push(`Departure: ${dep}`);
    else if (firstIcao) lines.push(`Detected departure ICAO: ${firstIcao}`);

    if (arr) lines.push(`Arrival: ${arr}`);
    else if (lastIcao && lastIcao !== firstIcao) lines.push(`Detected arrival ICAO: ${lastIcao}`);

    lines.push(`Tokens: ${tokens.length} (DCT: ${dctCount}, Airways: ${airwayCount})`);

    return lines.join('\n');
}

function makeCard(label, value) {
    return makeCard(label, value, false);
}

function makeCard(label, value, mono) {
    const card = document.createElement('div');
    card.className = 'decode-item';

    const strong = document.createElement('strong');
    strong.textContent = label;

    const p = document.createElement('p');
    if (mono) p.className = 'mono';
    p.textContent = value;

    card.appendChild(strong);
    card.appendChild(p);
    return card;
}

function suggestBetterRoute(tokens, dep, arr, region) {
    const notes = [];

    // Clone
    let t = Array.isArray(tokens) ? tokens.slice() : [];

    // Remove obvious leading/trailing ICAOs if present (many vACCs prefer route without them)
    if (dep && t[0] === dep) {
        t = t.slice(1);
        notes.push(`Removed leading departure ICAO (${dep}).`);
    }
    if (arr && t[t.length - 1] === arr) {
        t = t.slice(0, -1);
        notes.push(`Removed trailing arrival ICAO (${arr}).`);
    }

    // Remove runway/SID/STAR/procedure-ish tokens
    const beforeLen = t.length;
    t = t.filter((x) => {
        if (!x) return false;
        if (['SID', 'STAR', 'DEPARTURE', 'ARRIVAL'].includes(x)) return false;
        if (/^RW\d{2}[LRC]?$/.test(x)) return false;
        if (/^(SID|STAR)[A-Z0-9]+$/.test(x)) return false;
        return true;
    });
    if (t.length !== beforeLen) {
        notes.push('Removed runway/SID/STAR/procedure words from the route string.');
    }

    // Keep only the first speed/level token
    let seenSL = false;
    const pruned = [];
    for (const x of t) {
        if (/^[KN]\d{4}F\d{3}$/.test(x)) {
            if (seenSL) continue;
            seenSL = true;
        }
        pruned.push(x);
    }
    if (pruned.length !== t.length) {
        notes.push('Kept only the first speed/level token (extra ones removed).');
    }
    t = pruned;

    // Compress DCT usage: remove repeats, remove leading/trailing DCT
    const compressed = [];
    for (const x of t) {
        if (x === 'DCT' && compressed[compressed.length - 1] === 'DCT') continue;
        compressed.push(x);
    }
    t = compressed;
    while (t[0] === 'DCT') t.shift();
    while (t[t.length - 1] === 'DCT') t.pop();

    // Europe/UK: if there are many DCTs, suggest removing some (cannot invent airways without a nav DB)
    const dctCount = t.filter((x) => x === 'DCT').length;
    if (region?.family === 'europe' && dctCount >= 3) {
        notes.push('UK/Europe tends to prefer airway-structured routes; reduce DCT segments if you can.');
    }
    if (region?.family === 'us' && dctCount >= 6) {
        notes.push('US often allows more DCT, but very high DCT usage can still be amended by ATC.');
    }

    // Transatlantic: don’t fabricate oceanic routing; add a note
    const hasNAT = t.some((x) => /^NAT[A-Z\d]{1,2}$/.test(x));
    const hasLatLon = t.some((x) => /^\d{2}[NS]\d{3}[EW]$/.test(x) || /^\d{4}[NS]\d{5}[EW]$/.test(x));
    if (region?.kind === 'transatlantic' && !hasNAT && !hasLatLon) {
        notes.push('Transatlantic flights usually need an oceanic segment (NAT track or published lat/long points). Add the correct oceanic routing for your direction/time.');
    }

    // If route becomes too short after cleanup, fall back to original
    const meaningful = t.filter((x) => x !== 'DCT');
    if (meaningful.length < 3) {
        return {
            route: tokens.join(' '),
            notes: ['Route is too short to safely “improve” automatically; showing original.']
        };
    }

    return { route: t.join(' '), notes };
}

function makeError(message) {
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = message;
    return div;
}

document.addEventListener('DOMContentLoaded', () => {
    const routeInput = document.getElementById('route-input');
    routeInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            checkRoute();
        }
    });
});
