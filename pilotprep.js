// Pilot Prep Toolkit

function navigatePage() {
    const select = document.getElementById('site-nav');
    if (!select) return;
    const target = select.value;
    if (!target) return;
    window.location.href = target;
}

function validateIcao(code) {
    return /^[A-Z0-9]{4}$/.test((code || '').toUpperCase());
}

function getPilotPlan() {
    return {
        callsign: (document.getElementById('pp-callsign')?.value || '').trim().toUpperCase(),
        aircraft: (document.getElementById('pp-aircraft')?.value || '').trim().toUpperCase(),
        dep: (document.getElementById('pp-dep')?.value || '').trim().toUpperCase(),
        arr: (document.getElementById('pp-arr')?.value || '').trim().toUpperCase(),
        alt: (document.getElementById('pp-alt')?.value || '').trim().toUpperCase(),
        cruise: (document.getElementById('pp-cruise')?.value || '').trim().toUpperCase(),
        route: (document.getElementById('pp-route')?.value || '').trim()
    };
}

function setPilotPlan(plan) {
    if (!plan) return;
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v || '';
    };
    set('pp-callsign', plan.callsign);
    set('pp-aircraft', plan.aircraft);
    set('pp-dep', plan.dep);
    set('pp-arr', plan.arr);
    set('pp-alt', plan.alt);
    set('pp-cruise', plan.cruise);
    set('pp-route', plan.route);
}

function savePilotPlan() {
    const plan = getPilotPlan();
    try {
        localStorage.setItem('pilotPlan', JSON.stringify(plan));
    } catch (_) {}
    flashOutput('Saved flight details locally.');
}

function loadPilotPlan() {
    try {
        const raw = localStorage.getItem('pilotPlan');
        if (!raw) return flashOutput('No saved flight found yet.');
        setPilotPlan(JSON.parse(raw));
        flashOutput('Loaded saved flight details.');
    } catch (_) {
        flashOutput('Failed to load saved flight.');
    }
}

function flashOutput(message) {
    const section = document.getElementById('pp-output');
    const inner = document.getElementById('pp-output-inner');
    if (!section || !inner) return;
    section.style.display = 'block';
    inner.innerHTML = '';
    inner.appendChild(makeCard('ℹ️ Info', message));
}

function normalizeRouteText(text) {
    let t = String(text || '')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/^\s*ROUTE\s*[:=-]?\s*/i, '')
        .replace(/^\s*RTE\s*[:=-]?\s*/i, '')
        .trim();
    return t.replace(/\s+/g, ' ').toUpperCase();
}

function tokenizeRoute(route) {
    return (route || '')
        .split(' ')
        .map((t) => t.trim())
        .filter(Boolean);
}

function detectRegion(dep, arr, regionPref) {
    const d = (dep || '').toUpperCase();
    const a = (arr || '').toUpperCase();

    const looksEurope = (c) => c.startsWith('E');
    const looksUk = (c) => c.startsWith('EG');
    const looksUsCanada = (c) => c.startsWith('K') || c.startsWith('C') || c.startsWith('P');

    if (regionPref === 'uk-eu') return { family: 'europe', kind: 'europe', label: 'UK/Europe', ukInvolved: true };
    if (regionPref === 'us') return { family: 'us', kind: 'us', label: 'US/Canada', ukInvolved: false };

    const depEurope = d ? looksEurope(d) : false;
    const arrEurope = a ? looksEurope(a) : false;
    const depUk = d ? looksUk(d) : false;
    const arrUk = a ? looksUk(a) : false;
    const depUs = d ? looksUsCanada(d) : false;
    const arrUs = a ? looksUsCanada(a) : false;

    const ukInvolved = depUk || arrUk;

    if ((depEurope && arrUs) || (arrEurope && depUs)) {
        return { family: 'europe', kind: 'transatlantic', label: 'Transatlantic (Europe ↔ US/Canada)', ukInvolved };
    }

    if (depEurope || arrEurope) return { family: 'europe', kind: 'europe', label: ukInvolved ? 'UK/Europe' : 'Europe', ukInvolved };
    if (depUs || arrUs) return { family: 'us', kind: 'us', label: 'US/Canada', ukInvolved: false };

    return { family: 'europe', kind: 'unknown', label: 'Auto (default)', ukInvolved: false };
}

function suggestBetterRouteTokens(tokens, dep, arr, region) {
    const notes = [];
    let t = Array.isArray(tokens) ? tokens.slice() : [];

    if (dep && t[0] === dep) {
        t = t.slice(1);
        notes.push(`Removed leading departure ICAO (${dep}).`);
    }
    if (arr && t[t.length - 1] === arr) {
        t = t.slice(0, -1);
        notes.push(`Removed trailing arrival ICAO (${arr}).`);
    }

    const beforeLen = t.length;
    t = t.filter((x) => {
        if (!x) return false;
        if (['SID', 'STAR', 'DEPARTURE', 'ARRIVAL'].includes(x)) return false;
        if (/^RW\d{2}[LRC]?$/.test(x)) return false;
        if (/^(SID|STAR)[A-Z0-9]+$/.test(x)) return false;
        return true;
    });
    if (t.length !== beforeLen) notes.push('Removed runway/SID/STAR/procedure tokens.');

    let seenSL = false;
    const pruned = [];
    for (const x of t) {
        if (/^[KN]\d{4}F\d{3}$/.test(x)) {
            if (seenSL) continue;
            seenSL = true;
        }
        pruned.push(x);
    }
    if (pruned.length !== t.length) notes.push('Kept only the first speed/level token.');
    t = pruned;

    const compressed = [];
    for (const x of t) {
        if (x === 'DCT' && compressed[compressed.length - 1] === 'DCT') continue;
        compressed.push(x);
    }
    t = compressed;
    while (t[0] === 'DCT') t.shift();
    while (t[t.length - 1] === 'DCT') t.pop();

    const dctCount = t.filter((x) => x === 'DCT').length;
    if (region?.family === 'europe' && dctCount >= 3) notes.push('UK/Europe tends to prefer airway-structured routes; reduce DCT where possible.');
    if (region?.family === 'us' && dctCount >= 6) notes.push('US allows more DCT, but very high DCT usage can still be amended.');

    const hasNAT = t.some((x) => /^NAT[A-Z\d]{1,2}$/.test(x));
    const hasLatLon = t.some((x) => /^\d{2}[NS]\d{3}[EW]$/.test(x) || /^\d{4}[NS]\d{5}[EW]$/.test(x));
    if (region?.kind === 'transatlantic' && !hasNAT && !hasLatLon) {
        notes.push('Transatlantic flights usually need an oceanic segment (NAT or lat/long points).');
    }

    const meaningful = t.filter((x) => x !== 'DCT');
    if (meaningful.length < 3) {
        return { tokens, notes: ['Route is too short to safely improve; showing original.'] };
    }

    return { tokens: t, notes };
}

function makeCard(label, value, mono) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'decode-item';

    const labelEl = document.createElement('strong');
    labelEl.textContent = label;
    itemDiv.appendChild(labelEl);

    const p = document.createElement('p');
    if (mono) p.className = 'mono';
    p.textContent = value;
    itemDiv.appendChild(p);

    return itemDiv;
}

function ensureChecklist() {
    const container = document.getElementById('pp-checklist');
    if (!container || container.childElementCount) return;

    const items = [
        { id: 'charts', text: 'Charts open (SID/STAR/Approach + airport diagram)' },
        { id: 'brief', text: 'Departure/arrival briefing completed' },
        { id: 'route', text: 'Route checked and filed format ready' },
        { id: 'fuel', text: 'Fuel + alternate planned' },
        { id: 'radios', text: 'Radio plan ready (ATIS/DEL/GND/TWR/DEP)' },
        { id: 'xpdr', text: 'Transponder ready (Mode C / ALT)' },
        { id: 'vatsim', text: 'VATSIM setup: audio/PTT/voice configured' },
        { id: 'failsafe', text: 'Plan for contingencies (go-around, alternate, missed)' }
    ];

    const grid = document.createElement('div');
    grid.className = 'checklist-grid';

    for (const it of items) {
        const row = document.createElement('label');
        row.className = 'check-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `pp-chk-${it.id}`;

        const span = document.createElement('span');
        span.textContent = it.text;

        row.appendChild(cb);
        row.appendChild(span);
        grid.appendChild(row);
    }

    container.appendChild(grid);
}

function runAllChecks() {
    ensureChecklist();
    suggestRoute();
    smartReminders();
    flashOutput('Checks updated below (Checklist / Route / Reminders).');
}

function buildReadback() {
    const plan = getPilotPlan();
    const sid = (document.getElementById('pp-sid')?.value || '').trim().toUpperCase();
    const initAlt = (document.getElementById('pp-init-alt')?.value || '').trim();
    const squawk = (document.getElementById('pp-squawk')?.value || '').trim();
    const depFreq = (document.getElementById('pp-dep-freq')?.value || '').trim();
    const qnh = (document.getElementById('pp-qnh')?.value || '').trim();
    const runway = (document.getElementById('pp-runway')?.value || '').trim().toUpperCase();

    const lines = [];
    lines.push(`${plan.callsign || 'CALLSIGN'} ready to copy IFR clearance.`);
    lines.push(`Cleared to ${plan.arr || 'DEST'}${sid ? ` via the ${sid} departure` : ''}.`);
    if (runway) lines.push(`Departure runway ${runway}.`);
    if (initAlt) lines.push(`Initial altitude ${initAlt}.`);
    if (plan.cruise) lines.push(`Expect ${plan.cruise} in cruise.`);
    if (depFreq) lines.push(`Departure frequency ${depFreq}.`);
    if (squawk) lines.push(`Squawk ${squawk}.`);
    if (qnh) lines.push(`QNH ${qnh}.`);

    const box = document.getElementById('pp-readback');
    box.innerHTML = '';
    box.appendChild(makeCard('📻 Readback (template)', lines.join('\n'), true));
}

function calcWindComponents() {
    const wd = parseFloat(document.getElementById('pp-wind-dir')?.value || '');
    const ws = parseFloat(document.getElementById('pp-wind-spd')?.value || '');
    const rh = parseFloat(document.getElementById('pp-rwy-heading')?.value || '');

    const out = document.getElementById('pp-wind');
    out.innerHTML = '';

    if (!Number.isFinite(wd) || !Number.isFinite(ws) || !Number.isFinite(rh)) {
        out.appendChild(makeCard('💨 Wind components', 'Enter wind direction/speed and runway heading.'));
        return;
    }

    const angle = ((wd - rh) * Math.PI) / 180;
    const head = Math.round(ws * Math.cos(angle));
    const cross = Math.round(ws * Math.sin(angle));

    const headText = head >= 0 ? `Headwind ${head} kt` : `Tailwind ${Math.abs(head)} kt`;
    const crossText = cross >= 0 ? `Crosswind ${Math.abs(cross)} kt (from right)` : `Crosswind ${Math.abs(cross)} kt (from left)`;

    out.appendChild(makeCard('💨 Wind components', `${headText}\n${crossText}`, true));
}

function suggestRoute() {
    const plan = getPilotPlan();
    const regionPref = (document.getElementById('pp-region')?.value || 'auto').toLowerCase();
    const region = detectRegion(plan.dep, plan.arr, regionPref);

    const normalized = normalizeRouteText(plan.route);
    const tokens = tokenizeRoute(normalized);

    const box = document.getElementById('pp-route-tools');
    box.innerHTML = '';

    if (!tokens.length) {
        box.appendChild(makeCard('🛣️ Suggested Route', 'Paste a route above first.'));
        return;
    }

    const s = suggestBetterRouteTokens(tokens, plan.dep, plan.arr, region);
    box.appendChild(makeCard('🛣️ Suggested Route (cleanup)', s.tokens.join(' '), true));
    if (s.notes?.length) box.appendChild(makeCard('📝 Notes', s.notes.join('\n'), true));
}

function formatRouteVariants() {
    const plan = getPilotPlan();
    const normalized = normalizeRouteText(plan.route);
    const tokens = tokenizeRoute(normalized);

    const box = document.getElementById('pp-route-tools');
    box.innerHTML = '';

    if (!tokens.length) {
        box.appendChild(makeCard('🧾 Filing variants', 'Paste a route above first.'));
        return;
    }

    // Variant A: controller-friendly (no airport ICAOs at ends)
    const a = tokens.filter((t, idx) => {
        if (idx === 0 && plan.dep && t === plan.dep) return false;
        if (idx === tokens.length - 1 && plan.arr && t === plan.arr) return false;
        return true;
    });

    // Variant B: FMC-friendly (keep as-is)
    const b = tokens;

    // Variant C: minimal DCT cleanup
    const c = suggestBetterRouteTokens(tokens, plan.dep, plan.arr, detectRegion(plan.dep, plan.arr, (document.getElementById('pp-region')?.value || 'auto').toLowerCase())).tokens;

    box.appendChild(makeCard('🧾 Filing variant (controller-friendly)', a.join(' '), true));
    box.appendChild(makeCard('🧾 FMC paste (as entered)', b.join(' '), true));
    box.appendChild(makeCard('🧾 Filing variant (cleanup)', c.join(' '), true));
}

function oceanicHelper() {
    const plan = getPilotPlan();
    const region = detectRegion(plan.dep, plan.arr, 'auto');

    const box = document.getElementById('pp-oceanic');
    box.innerHTML = '';

    if (region.kind !== 'transatlantic') {
        box.appendChild(makeCard('🌊 Oceanic', 'This looks like a non-transatlantic flight. Oceanic brief not required.', false));
        return;
    }

    const normalized = normalizeRouteText(plan.route);
    const tokens = tokenizeRoute(normalized);
    const hasNAT = tokens.some((t) => /^NAT[A-Z\d]{1,2}$/.test(t));
    const hasLatLon = tokens.some((t) => /^\d{2}[NS]\d{3}[EW]$/.test(t) || /^\d{4}[NS]\d{5}[EW]$/.test(t));

    const lines = [];
    lines.push(`Route type: ${region.label}`);
    lines.push(hasNAT || hasLatLon ? 'Oceanic segment: detected' : 'Oceanic segment: NOT detected (you may be rerouted/asked for oceanic routing)');
    lines.push('Position report template:');
    lines.push(`${plan.callsign || 'CALLSIGN'} POSITION <FIX/COORD> AT <TIME> FL<LEVEL> ESTIMATING <NEXT> AT <TIME> THEN <NEXT>`);

    box.appendChild(makeCard('🌊 Oceanic brief', lines.join('\n'), true));
}

function insertBriefTemplate() {
    const plan = getPilotPlan();
    const el = document.getElementById('pp-brief');
    if (!el) return;

    const template = [
        `Airport brief: ${plan.dep || 'DEP'} → ${plan.arr || 'ARR'}`,
        '',
        'Runway config expected:',
        'SID / initial climb:',
        'Taxi notes / hotspots:',
        'ATIS notes (QNH / TL / wind):',
        'Departure frequency:',
        'Arrival/Approach notes:',
        'NOTAM highlights:',
        'Contingencies (go-around / alternate):'
    ].join('\n');

    el.value = el.value ? `${el.value}\n\n${template}` : template;
}

function saveBrief() {
    const plan = getPilotPlan();
    const el = document.getElementById('pp-brief');
    if (!el) return;
    try {
        localStorage.setItem(`brief:${plan.dep || 'DEP'}:${plan.arr || 'ARR'}`, el.value);
    } catch (_) {}
    flashOutput('Saved airport brief locally.');
}

async function loadAtcSnapshot() {
    const plan = getPilotPlan();
    const box = document.getElementById('pp-atc');
    box.innerHTML = '<div class="loading">⏳ Loading VATSIM ATC...</div>';

    try {
        if (window.location && window.location.protocol === 'file:') {
            throw new Error('Live fetching is blocked on file://. Use Live Server / GitHub Pages.');
        }

        const urls = ['https://data.vatsim.net/v3/vatsim-data.json', 'https://cdn.vatsim.net/vatsim-data.json'];
        let data = null;
        let lastErr = null;
        for (const u of urls) {
            try {
                const r = await fetch(u, { cache: 'no-store' });
                if (!r.ok) throw new Error(`status ${r.status}`);
                data = await r.json();
                break;
            } catch (e) {
                lastErr = e;
            }
        }
        if (!data || !Array.isArray(data.controllers)) {
            throw new Error(`Failed to load VATSIM feed. ${lastErr ? lastErr.message : ''}`.trim());
        }

        const dep = plan.dep;
        const arr = plan.arr;
        const controllers = data.controllers;

        const matches = controllers
            .filter((c) => typeof c?.callsign === 'string')
            .filter((c) => {
                const cs = c.callsign.toUpperCase();
                const depMatch = dep && cs.startsWith(dep + '_');
                const arrMatch = arr && cs.startsWith(arr + '_');
                return depMatch || arrMatch;
            })
            .sort((a, b) => (a.callsign || '').localeCompare(b.callsign || ''));

        box.innerHTML = '';

        if (!matches.length) {
            box.appendChild(makeCard('🧑‍✈️ ATC', 'No airport-specific controllers found for your dep/arr right now. (Try CTR search on VATSIM maps.)'));
            return;
        }

        const lines = matches.map((c) => `${c.callsign}  ${c.frequency}  (${c.name || ''})`.trim());
        box.appendChild(makeCard('🧑‍✈️ Active ATC (airport callsigns)', lines.join('\n'), true));

    } catch (e) {
        box.innerHTML = '';
        box.appendChild(makeCard('⚠️ ATC snapshot error', e.message || String(e)));
    }
}

function smartReminders() {
    const plan = getPilotPlan();
    const regionPref = (document.getElementById('pp-region')?.value || 'auto').toLowerCase();
    const region = detectRegion(plan.dep, plan.arr, regionPref);

    const normalized = normalizeRouteText(plan.route);
    const tokens = tokenizeRoute(normalized);

    const reminders = [];

    if (!plan.callsign) reminders.push('Set a callsign that matches what you will connect with on VATSIM.');
    if (plan.dep && !validateIcao(plan.dep)) reminders.push('Departure ICAO looks invalid.');
    if (plan.arr && !validateIcao(plan.arr)) reminders.push('Arrival ICAO looks invalid.');
    if (plan.alt && !validateIcao(plan.alt)) reminders.push('Alternate ICAO looks invalid.');

    const hasProcWords = tokens.some((t) => ['SID', 'STAR', 'DEPARTURE', 'ARRIVAL'].includes(t) || /^(SID|STAR)[A-Z0-9]+$/.test(t));
    if (hasProcWords) reminders.push('Route contains SID/STAR/procedure text — many vACCs prefer enroute-only routing.');

    const dctCount = tokens.filter((t) => t === 'DCT').length;
    const dctWarn = region.family === 'europe' ? 3 : 5;
    if (dctCount >= dctWarn) reminders.push(`High DCT usage (${dctCount}x) for ${region.label} — expect possible reroute.`);

    const isTransatlantic = region.kind === 'transatlantic';
    if (isTransatlantic) {
        const hasNAT = tokens.some((t) => /^NAT[A-Z\d]{1,2}$/.test(t));
        const hasLatLon = tokens.some((t) => /^\d{2}[NS]\d{3}[EW]$/.test(t) || /^\d{4}[NS]\d{5}[EW]$/.test(t));
        if (!hasNAT && !hasLatLon) reminders.push('Transatlantic flight detected but no NAT/lat-long segment found.');
        if (!plan.alt) reminders.push('Consider setting an alternate (especially if weather is marginal).');
    }

    const box = document.getElementById('pp-reminders');
    box.innerHTML = '';

    if (!reminders.length) {
        box.appendChild(makeCard('🧠 Reminders', 'No major issues detected. You still may receive ATC reroutes based on traffic/sector workload.'));
        return;
    }

    box.appendChild(makeCard('🧠 Reminders', reminders.map((r) => `• ${r}`).join('\n'), true));
}

document.addEventListener('DOMContentLoaded', () => {
    ensureChecklist();
    loadPilotPlan();
});
