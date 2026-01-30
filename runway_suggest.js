// runway_suggest.js
// Modern, clean JS for runway suggestion UI

function suggestLandingRunway() {
    const icao = document.getElementById('runway-icao').value.trim().toUpperCase();
    const output = document.getElementById('runway-suggestion-output');
    output.textContent = '';
    if (!icao || icao.length !== 4) {
        output.textContent = 'Please enter a valid 4-letter ICAO code.';
        return;
    }
    output.textContent = 'Fetching METAR and runway data...';
    fetchMetarAndSuggest(icao, output);
}

async function fetchMetarAndSuggest(icao, output) {
    try {
        // Fetch METAR
        const metarResp = await fetch(`https://metar.vatsim.net/${icao}`);
        if (!metarResp.ok) throw new Error('Could not fetch METAR.');
        const metar = (await metarResp.text()).trim();
        if (!metar || metar.includes('No METAR found')) throw new Error('No METAR found for this airport.');

        // Parse wind direction and speed
        const windMatch = metar.match(/(\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS|KMH)/);
        if (!windMatch) throw new Error('Could not parse wind from METAR.');
        const windDir = parseInt(windMatch[1], 10);
        const windSpd = parseInt(windMatch[2], 10);

        // Fetch runways from runways.json if available
        let runways = [];
        try {
            const rwResp = await fetch('runways.json');
            if (rwResp.ok) {
                const rwData = await rwResp.json();
                if (rwData[icao]) runways = rwData[icao];
            }
        } catch {}
        if (!runways.length) {
            output.textContent = 'Runway data not found for this airport.';
            return;
        }

        // Calculate best runway (smallest crosswind, max headwind)
        let best = null, bestScore = -Infinity;
        for (const rw of runways) {
            const rwyDir = parseInt(rw.substr(0, 2)) * 10;
            let diff = Math.abs(windDir - rwyDir);
            if (diff > 180) diff = 360 - diff;
            const headwind = windSpd * Math.cos(diff * Math.PI / 180);
            const crosswind = windSpd * Math.sin(diff * Math.PI / 180);
            // Score: prioritize headwind, penalize crosswind
            const score = headwind - Math.abs(crosswind) * 0.5;
            if (score > bestScore) {
                bestScore = score;
                best = rw;
            }
        }
        output.innerHTML = `<b>Best Runway:</b> <span style="color:#7c3aed;">${best}</span><br><small>Wind: ${windDir}° @ ${windSpd}kt<br>METAR: <code>${metar}</code></small>`;
    } catch (e) {
        output.textContent = e.message || 'Error suggesting runway.';
    }
}

document.getElementById('runway-icao').addEventListener('input', function(e) {
    e.target.value = e.target.value.toUpperCase();
});
