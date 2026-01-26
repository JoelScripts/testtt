# METAR Decoder Website

A user-friendly website that decodes METAR (Meteorological Aerodrome Report) codes and makes aviation weather reports easier to understand.

## Features

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
- **No dependencies**: Pure HTML, CSS, and JavaScript - no frameworks needed

## How to Use

1. Open `index.html` in a web browser
2. Enter a METAR code in the text area, or click one of the example buttons
3. Click "Decode METAR" to see the human-readable translation
4. The decoded information will display with clear icons and explanations

## Example METAR Codes

- `KJFK 121251Z 24016G28KT 10SM FEW250 23/14 A3012` - New York JFK Airport
- `EGLL 121250Z 27015KT 9999 FEW035 17/12 Q1013` - London Heathrow
- `KSFO 121256Z 29008KT 10SM CLR 18/12 A2990` - San Francisco Airport

## What is METAR?

METAR is a standardized format for reporting weather information used in aviation worldwide. It contains coded information about meteorological conditions at airports, including wind, visibility, weather phenomena, clouds, temperature, dewpoint, and atmospheric pressure.

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and responsive design
- `script.js` - METAR parsing and decoding logic

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

## License

For educational purposes.