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

    const { status, reasons, suggestions, parsed } = analyzeRoute(tokens, dep, arr);

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

function analyzeRoute(tokens, dep, arr) {
    const reasons = [];
    const suggestions = [];

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
            parsed: buildParsedSummary(tokens, dep, arr)
        };
    }

    // Count DCT usage
    const dctCount = tokens.filter((t) => t === 'DCT').length;
    if (dctCount >= 6) {
        reasons.push(`Heavy DCT usage (${dctCount}x). Many FIRs/vACCs prefer structured airways.`);
        suggestions.push('Try generating a route with more airways (UL/UT/UQ/etc) or use local preferred routes.');
    } else if (dctCount >= 3) {
        reasons.push(`Moderate DCT usage (${dctCount}x). You may get a minor reroute.`);
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

    // SID/STAR/runway text in route line is often discouraged
    const hasRunway = tokens.some((t) => /^RW\d{2}[LRC]?$/.test(t) || /^\d{2}[LRC]?$/.test(t));
    const hasSidStarWords = tokens.some((t) => ['SID', 'STAR', 'DEPARTURE', 'ARRIVAL'].includes(t));
    const looksLikeProc = tokens.some((t) => /^(SID|STAR)[A-Z0-9]+$/.test(t));

    if (hasRunway || hasSidStarWords || looksLikeProc) {
        reasons.push('Route line appears to include runway/SID/STAR/procedure text. Many controllers expect those via the FMS/clearance, not in the enroute string.');
        suggestions.push('Consider removing runway/SID/STAR names from the route line unless your vACC specifically asks for them.');
    }

    // NAT / oceanic track sanity
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
        suggestions.push('Double-check for typos. This tool can’t confirm every waypoint without a nav database.');
    }

    // Final status selection
    let status;
    if (reasons.some((r) => r.includes('Invalid') || r.includes('incomplete'))) {
        status = {
            label: 'Invalid format',
            className: 'status-bad',
            description: 'The route appears malformed or incomplete.'
        };
    } else if (reasons.length >= 2 || dctCount >= 6) {
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
        suggestions.push('Check your vACC preferred routes for your departure/arrival pair.');
        suggestions.push('If ATC issues a reroute, read back and update the FMC route accordingly.');
    }

    return {
        status,
        reasons,
        suggestions,
        parsed: buildParsedSummary(tokens, dep, arr)
    };
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

function buildParsedSummary(tokens, dep, arr) {
    const firstIcao = tokens.find((t) => validateIcaoCode(t)) || '';
    const lastIcao = [...tokens].reverse().find((t) => validateIcaoCode(t)) || '';
    const dctCount = tokens.filter((t) => t === 'DCT').length;

    const lines = [];
    if (dep) lines.push(`Departure: ${dep}`);
    else if (firstIcao) lines.push(`Detected departure ICAO: ${firstIcao}`);

    if (arr) lines.push(`Arrival: ${arr}`);
    else if (lastIcao && lastIcao !== firstIcao) lines.push(`Detected arrival ICAO: ${lastIcao}`);

    lines.push(`Tokens: ${tokens.length} (DCT: ${dctCount})`);

    return lines.join('\n');
}

function makeCard(label, value) {
    const card = document.createElement('div');
    card.className = 'decode-item';

    const strong = document.createElement('strong');
    strong.textContent = label;

    const p = document.createElement('p');
    p.textContent = value;

    card.appendChild(strong);
    card.appendChild(p);
    return card;
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
