// METAR Decoder Script

function decodeMetar() {
    const input = document.getElementById('metar-input').value.trim();
    const resultSection = document.getElementById('result-section');
    const output = document.getElementById('decoded-output');
    
    if (!input) {
        output.innerHTML = '<div class="error">Please enter a METAR code to decode.</div>';
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
    if (parts[i] && parts[i].match(/^\d{5}(G\d{2,3})?(KT|MPS|KMH)$/)) {
        decoded.wind = decodeWind(parts[i]);
        i++;
    } else if (parts[i] && parts[i] === 'VRB') {
        if (parts[i+1] && parts[i+1].match(/^\d{2,3}(KT|MPS|KMH)$/)) {
            decoded.wind = 'Variable wind at ' + parts[i+1].replace(/[A-Z]+$/, '') + ' knots';
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
    
    let html = `<div class="raw-metar">Raw METAR: ${rawMetar}</div>`;
    
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
});
