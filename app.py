"""
Currency Converter - Flask Backend
-----------------------------------
This file is a direct web port of the original terminal script.

The ORIGINAL LOGIC IS UNCHANGED:
  - Same API (https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest)
  - Same two-step flow: fetch the list of all currencies, then fetch the
    conversion-rate table for the chosen "from" currency.
  - Same calculation: amount * rate.

The only thing that changed is *how the logic is triggered*.
Instead of `input()` reading from the terminal and `print()` writing to it,
Flask routes read from an HTTP request and return JSON. No conversion,
validation, or API-fetching logic lives in JavaScript - all of it is here,
in Python, exactly like the original script.
"""

from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies"


# ---------------------------------------------------------------------------
# Core logic (this is the original script's logic, just wrapped in functions
# so it can be reused by more than one route instead of running top-to-bottom
# once). Nothing about *what* it does has changed.
# ---------------------------------------------------------------------------

def fetch_all_currencies():
    """
    Equivalent to the first part of the original script:

        url = ".../v1/currencies.json"
        response = requests.get(url)
        if response.status_code == 200:
            datajson = response.json()
    """
    url = f"{BASE_URL}.json"
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()

    raise RuntimeError(f"Failed to fetch data. Status code: {response.status_code}")


def fetch_rates_for(currency_code):
    """
    Equivalent to the second part of the original script:

        url2 = ".../v1/currencies/{Currencyinput}.json"
        response = requests.get(url2)
        if response.status_code == 200:
            datajson2 = response.json()
            Currencydata2 = datajson2[Currencyinput]
    """
    url2 = f"{BASE_URL}/{currency_code}.json"
    response = requests.get(url2)

    if response.status_code == 200:
        datajson2 = response.json()
        return datajson2[currency_code]

    raise RuntimeError(f"Failed to fetch data. Status code: {response.status_code}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Loads the web page (replaces the script simply starting to run)."""
    return render_template("index.html")


@app.route("/currencies", methods=["GET"])
def currencies():
    """
    Returns every available currency.
    This is what used to be printed to the terminal as:
        "Currency which you want to convert:"
        1 = code: usd, Country/Currency: US Dollar
        2 = code: eur, Country/Currency: Euro
        ...
    """
    try:
        datajson = fetch_all_currencies()
        return jsonify({"success": True, "currencies": datajson})
    except RuntimeError as e:
        return jsonify({"success": False, "error": str(e)}), 502
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": f"An error occurred: {e}"}), 502


@app.route("/convert", methods=["POST"])
def convert():
    """
    Accepts: amount, from_currency, to_currency
    Performs the SAME steps the terminal script performed after the user
    typed their two currency codes and an amount:

        1. Fetch the full currency list (for validation / display names)
        2. Fetch the rate table for the "from" currency
        3. Look up the rate for the "to" currency
        4. amount * rate
    """
    data = request.get_json(silent=True) or {}

    amount_raw = data.get("amount")
    from_currency = str(data.get("from_currency", "")).strip().lower()
    to_currency = str(data.get("to_currency", "")).strip().lower()

    # ---- validation (mirrors what input()/float() would naturally enforce) ----
    if not from_currency or not to_currency:
        return jsonify({"success": False, "error": "Please choose both a 'from' and 'to' currency."}), 400

    try:
        amount = float(amount_raw)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Enter a valid numeric amount."}), 400

    if amount <= 0:
        return jsonify({"success": False, "error": "Amount must be greater than zero."}), 400

    try:
        datajson = fetch_all_currencies()

        if from_currency not in datajson:
            return jsonify({"success": False, "error": f"Unknown currency code: {from_currency}"}), 400
        if to_currency not in datajson:
            return jsonify({"success": False, "error": f"Unknown currency code: {to_currency}"}), 400

        currencydata2 = fetch_rates_for(from_currency)

        if to_currency not in currencydata2:
            return jsonify({"success": False, "error": f"No rate available for {to_currency}"}), 400

        rate = currencydata2[to_currency]
        result = amount * rate

        # Same message the terminal script printed, now as structured JSON:
        #   f"{datajson[Currencyinput]}:{amount} is equal to
        #     {datajson[Currencyinput2]} : {amount*Currencydata2[Currencyinput2]}"
        return jsonify({
            "success": True,
            "result": round(result, 4),
            "rate": rate,
            "amount": amount,
            "from": from_currency.upper(),
            "to": to_currency.upper(),
            "from_name": datajson.get(from_currency, from_currency),
            "to_name": datajson.get(to_currency, to_currency),
        })

    except RuntimeError as e:
        return jsonify({"success": False, "error": str(e)}), 502
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": f"An error occurred: {e}"}), 502


if __name__ == "__main__":
    app.run(debug=True)
