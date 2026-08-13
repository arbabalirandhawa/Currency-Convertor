# Vertex — Currency Converter

A premium, glassmorphism fintech-style web app for the original terminal
currency converter. **All conversion logic still runs in Python** — the
Flask backend fetches live rates and performs every calculation, exactly
like the original script. The frontend (HTML/CSS/JS) only renders the UI
and talks to the backend over JSON.

## Project structure

```
CurrencyConverter/
│── app.py
│── requirements.txt
│── templates/
│     └── index.html
│── static/
│     ├── css/
│     │      style.css
│     ├── js/
│     │      script.js
│     └── images/
└── README.md
```

## How the logic maps from the original script

| Original terminal script                                   | Flask web app                          |
|--------------------------------------------------------------|-----------------------------------------|
| `requests.get(".../currencies.json")`                       | `fetch_all_currencies()` in `app.py`, exposed via `GET /currencies` |
| `requests.get(".../currencies/{code}.json")`                | `fetch_rates_for(code)` in `app.py`, called inside `POST /convert` |
| `input()` for currency codes and amount                     | JSON body of the `POST /convert` request (`amount`, `from_currency`, `to_currency`) |
| `print(...)` of the result                                  | JSON response: `{success, result, rate, from, to, ...}` |

No conversion math, validation, or API calls happen in JavaScript —
`static/js/script.js` only fetches from Flask and updates the DOM.

## Setup

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the app:
   ```bash
   python app.py
   ```

4. Open your browser at `http://127.0.0.1:5000`.

## API reference

### `GET /`
Renders the web page.

### `GET /currencies`
Returns every available currency.
```json
{
  "success": true,
  "currencies": { "usd": "US Dollar", "eur": "Euro", "...": "..." }
}
```

### `POST /convert`
Body:
```json
{ "amount": 100, "from_currency": "usd", "to_currency": "pkr" }
```
Response:
```json
{
  "success": true,
  "result": 28450.82,
  "rate": 284.5082,
  "amount": 100,
  "from": "USD",
  "to": "PKR",
  "from_name": "US Dollar",
  "to_name": "Pakistani Rupee"
}
```

## Design

- **Theme**: dark glassmorphism, inspired by Stripe / Revolut / Wise / Linear / Arc.
- **Palette**: background `#020617`, glass `rgba(255,255,255,0.08)`, gradient `#7C3AED → #2563EB → #06B6D4`, glow accent `#38BDF8`.
- **Typography**: Space Grotesk (display), Inter (body), JetBrains Mono (numbers/codes).
- **Animations**: CSS-only — fade-in, slide-up, floating blobs, button ripple, swap rotation, glow, card hover lift, loading spinner.

## Notes

- Currency data and rates are provided live by the free
  [`@fawazahmed0/currency-api`](https://github.com/fawazahmed0/exchange-api),
  the same source the original script used.
- Conversion history, favorite pair, live clock, and stats are session-only
  UI state (kept in memory in the browser) — they don't affect or replace
  any backend logic.
