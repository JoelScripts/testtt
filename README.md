# METAR Decoder Website

A user-friendly website that decodes METAR (Meteorological Aerodrome Report) codes and makes aviation weather reports easier to understand.

## 🌐 Live Demo

Visit the live website: **https://joelscripts.github.io/testtt/**

## Features

- **🆕 Automatic METAR Fetching**: Enter any airport ICAO code (e.g., KJFK, EGLL, KSFO) to automatically fetch and decode current weather data
- **✈️ VATSIM ATIS Decoder**: Fetch and decode live ATIS from VATSIM network airports with active ATC (via the official VATSIM data feed)
- **🛑 NOTAM Decoder (New)**: Fetch and decode current NOTAMs for an airport (with manual paste fallback if fetching is blocked)
- **🧭 Route Checker (New)**: Paste a SimBrief route and get a quick “looks OK / likely reroute / invalid format” check based on common VATSIM issues
- **Input Validation**: Built-in validation ensures only valid 4-letter ICAO codes are submitted
- **Easy-to-use interface**: Simply paste a METAR code and get instant human-readable translations
- **Comprehensive decoding**: Decodes all major METAR components including:
  - Airport station identifier
  - Observation date and time
  - Wind speed, direction, and gusts
  - Visibility conditions
  - Weather phenomena (rain, snow, fog, etc.)
  - Cloud coverage and height
  - Temperature and dewpoint (in both Celsius and Fahrenheit)
  - Altimeter settings
- **Quick examples**: Pre-loaded examples for major airports (JFK, London Heathrow, San Francisco)
- **Responsive design**: Works on desktop, tablet, and mobile devices
- **Error handling**: Clear error messages for invalid codes or API failures
- **No dependencies**: Pure HTML, CSS, and JavaScript - no frameworks needed

## How to Use

### Online
Visit https://joelscripts.github.io/testtt/ to use the decoder immediately.

### Locally
1. Run a local web server (recommended), then open the site in your browser
   - VS Code: use the "Live Server" extension
   - Or: `python -m http.server` and open `http://localhost:8000/`
2. **Option 1 - Fetch Current METAR:**
   - Enter a 4-letter ICAO airport code (e.g., KJFK, EGLL, KSFO)
   - Press Enter or click "Fetch Current METAR"
   - The current METAR data will be fetched and automatically decoded
3. **Option 2 - Manual Input:**
   - Enter a METAR code in the text area, or click one of the example buttons
   - Click "Decode METAR" to see the human-readable translation
4. **Option 3 - VATSIM ATIS:**
   - Enter a 4-letter ICAO airport code in the VATSIM ATIS section
   - Press Enter or click "Fetch & Decode ATIS"
   - If ATC is active at that airport on VATSIM, the ATIS will be fetched and decoded
5. The decoded information will display with clear icons and explanations

### NOTAMs Page
Use the navigation dropdown in the header to switch to the NOTAMs page.

- **Fetch NOTAMs:** Enter an ICAO and click "Fetch NOTAMs"
- **Manual Decode:** Paste one or more NOTAMs and click "Decode NOTAMs"

### Notes on NOTAM Fetching
NOTAM providers often require API keys or block cross-origin requests from browser apps.

- This site uses **AVWX** for live NOTAM fetching (requires an AVWX API token).
- If you don’t have a token (or fetching fails), use the manual paste box to decode NOTAM text.

### Note on API Access
The automatic METAR fetching feature uses the public VATSIM METAR endpoint (CORS-friendly for browser apps like GitHub Pages). If automatic fetching doesn't work, you can still use the manual input method to decode METAR codes.

## Example METAR Codes

- `KJFK 121251Z 24016G28KT 10SM FEW250 23/14 A3012` - New York JFK Airport
- `EGLL 121250Z 27015KT 9999 FEW035 17/12 Q1013` - London Heathrow
- `KSFO 121256Z 29008KT 10SM CLR 18/12 A2990` - San Francisco Airport

## What is METAR?

METAR is a standardized format for reporting weather information used in aviation worldwide. It contains coded information about meteorological conditions at airports, including wind, visibility, weather phenomena, clouds, temperature, dewpoint, and atmospheric pressure.

## What is ATIS?

ATIS (Automatic Terminal Information Service) is a continuous broadcast of recorded aeronautical information at airports. It includes essential information such as weather conditions, active runways, and other important notices. On VATSIM (Virtual Air Traffic Simulation Network), controllers provide ATIS broadcasts that pilots can use for flight planning and operations.

## Files

- `index.html` - Main HTML structure
- `notams.html` - NOTAM fetch/decode page
- `styles.css` - Styling and responsive design
- `script.js` - METAR parsing and decoding logic
- `notams.js` - NOTAM fetching and decoding logic
- `routecheck.html` - SimBrief route checker page
- `routecheck.js` - Route parsing and sanity checks
- `.github/workflows/deploy.yml` - GitHub Pages deployment configuration

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

## License

For educational purposes.

## Deployment

This website is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment workflow is configured in `.github/workflows/deploy.yml`.