/*
 * Vertex — Currency Converter (frontend)
 * ---------------------------------------------------------------
 * IMPORTANT: This file does NOT calculate currency conversions and
 * does NOT talk to the exchange-rate API. It only:
 *   - asks the Flask backend for the currency list ( GET /currencies )
 *   - asks the Flask backend to perform a conversion ( POST /convert )
 *   - renders whatever Python returns
 *   - drives purely visual/UI behaviour (dropdowns, swap, copy, toasts,
 *     the live clock, history list, ripple effect, loading state)
 * All math and validation live in app.py.
 */

(() => {
  "use strict";

  // ---- state -------------------------------------------------------
  let allCurrencies = {};          // { code: name } - from /currencies
  let fromCode = "usd";
  let toCode = "pkr";
  let activePicker = null;         // "from" | "to" | null
  let sessionConversions = 0;
  let favoritePair = null;
  const history = [];

  // ---- element refs -------------------------------------------------
  const el = (id) => document.getElementById(id);

  const amountInput   = el("amountInput");
  const fromSelectBtn = el("fromSelectBtn");
  const toSelectBtn   = el("toSelectBtn");
  const fromFlag = el("fromFlag"), fromCodeEl = el("fromCode"), fromNameEl = el("fromName");
  const toFlag   = el("toFlag"),   toCodeEl   = el("toCode"),   toNameEl   = el("toName");
  const swapBtn = el("swapBtn");
  const convertBtn = el("convertBtn");
  const btnSpinner = el("btnSpinner");
  const resultCard = el("resultCard");
  const resultAmount = el("resultAmount");
  const resultRate = el("resultRate");
  const errorAlert = el("errorAlert");
  const errorText = el("errorText");
  const copyBtn = el("copyBtn");
  const copyLabel = el("copyLabel");
  const favBtn = el("favBtn");

  const pickerOverlay = el("pickerOverlay");
  const pickerTitle = el("pickerTitle");
  const pickerSearch = el("pickerSearch");
  const pickerList = el("pickerList");
  const pickerClose = el("pickerClose");
  const pickerModal = pickerOverlay.querySelector(".picker-modal");

  const historyList = el("historyList");
  const clearHistoryBtn = el("clearHistoryBtn");

  const statConversions = el("statConversions");
  const statFavorite = el("statFavorite");
  const statCurrencies = el("statCurrencies");

  const toastContainer = el("toastContainer");
  const clockTime = el("clockTime");

  // ---- helpers --------------------------------------------------------

  // A tiny, purely-cosmetic code -> flag emoji guesser (UI only, not logic)
  function flagFor(code) {
    const map = {
      usd: "🇺🇸", eur: "🇪🇺", gbp: "🇬🇧", pkr: "🇵🇰", inr: "🇮🇳", jpy: "🇯🇵",
      cny: "🇨🇳", aud: "🇦🇺", cad: "🇨🇦", chf: "🇨🇭", aed: "🇦🇪", sar: "🇸🇦",
      sgd: "🇸🇬", nzd: "🇳🇿", hkd: "🇭🇰", zar: "🇿🇦", try: "🇹🇷", rub: "🇷🇺",
      brl: "🇧🇷", mxn: "🇲🇽", krw: "🇰🇷", thb: "🇹🇭", myr: "🇲🇾", idr: "🇮🇩",
      bdt: "🇧🇩", ngn: "🇳🇬", egp: "🇪🇬", sek: "🇸🇪", nok: "🇳🇴", dkk: "🇩🇰",
      pln: "🇵🇱", ils: "🇮🇱", php: "🇵🇭", vnd: "🇻🇳", qar: "🇶🇦", kwd: "🇰🇼",
    };
    return map[code] || "🌐";
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function setLoading(isLoading) {
    convertBtn.classList.toggle("loading", isLoading);
    btnSpinner.hidden = !isLoading;
    convertBtn.disabled = isLoading;
  }

  function showError(message) {
    errorText.textContent = message;
    errorAlert.removeAttribute("hidden");
    resultCard.hidden = true;
    showToast(message, "error");
  }

  function hideError() {
    errorAlert.setAttribute("hidden", "");
    errorText.textContent = "";
  }

  function updateSelectUI(which) {
    const code = which === "from" ? fromCode : toCode;
    const name = allCurrencies[code] || code.toUpperCase();
    const flagEl = which === "from" ? fromFlag : toFlag;
    const codeEl = which === "from" ? fromCodeEl : toCodeEl;
    const nameEl = which === "from" ? fromNameEl : toNameEl;

    flagEl.textContent = flagFor(code);
    codeEl.textContent = code.toUpperCase();
    nameEl.textContent = name;
  }

  // ---- live clock -------------------------------------------------------
  function tickClock() {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString([], { hour12: false });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---- fetch currency list from Flask ------------------------------------
  async function loadCurrencies() {
    try {
      const res = await fetch("/currencies");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load currencies.");

      allCurrencies = data.currencies;
      statCurrencies.textContent = Object.keys(allCurrencies).length.toLocaleString();
      hideError();

      updateSelectUI("from");
      updateSelectUI("to");
    } catch (err) {
      showError("Could not load currency list. Please refresh the page.");
    }
  }

  // ---- currency picker modal ---------------------------------------------
  function openPicker(which) {
    activePicker = which;
    pickerTitle.textContent = which === "from" ? "Convert from" : "Convert to";
    pickerSearch.value = "";
    renderPickerList("");
    pickerOverlay.hidden = false;
    document.body.classList.add("picker-open");
    requestAnimationFrame(() => {
      pickerSearch.focus();
      pickerSearch.select();
    });
  }

  function closePicker() {
    pickerOverlay.hidden = true;
    activePicker = null;
    document.body.classList.remove("picker-open");
  }

  function renderPickerList(query) {
    const q = query.trim().toLowerCase();
    pickerList.innerHTML = "";

    const entries = Object.entries(allCurrencies).filter(([code, name]) => {
      return !q || code.toLowerCase().includes(q) || String(name).toLowerCase().includes(q);
    });

    if (entries.length === 0) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "No currencies match your search.";
      pickerList.appendChild(li);
      return;
    }

    for (const [code, name] of entries.slice(0, 200)) {
      const li = document.createElement("li");
      li.className = "picker-item";
      li.dataset.code = code;
      li.innerHTML = `
        <span class="flag">${flagFor(code)}</span>
        <span class="p-code">${code.toUpperCase()}</span>
        <span class="p-name">${name}</span>
      `;
      pickerList.appendChild(li);
    }
  }

  function selectCurrency(code) {
    if (activePicker === "from") {
      fromCode = code;
      updateSelectUI("from");
    } else if (activePicker === "to") {
      toCode = code;
      updateSelectUI("to");
    }
    closePicker();
  }

  fromSelectBtn.addEventListener("click", () => openPicker("from"));
  toSelectBtn.addEventListener("click", () => openPicker("to"));
  pickerClose.addEventListener("click", closePicker);
  pickerOverlay.addEventListener("click", (e) => {
    if (e.target === pickerOverlay || e.target === pickerModal) closePicker();
  });
  pickerList.addEventListener("click", (e) => {
    const item = e.target.closest(".picker-item");
    if (!item) return;
    selectCurrency(item.dataset.code);
  });
  pickerSearch.addEventListener("input", (e) => renderPickerList(e.target.value));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pickerOverlay.hidden) closePicker();
  });

  // ---- swap -------------------------------------------------------------
  swapBtn.addEventListener("click", () => {
    [fromCode, toCode] = [toCode, fromCode];
    updateSelectUI("from");
    updateSelectUI("to");
    swapBtn.classList.add("spin");
    setTimeout(() => swapBtn.classList.remove("spin"), 400);
  });

  // ---- ripple effect on convert button -----------------------------------
  convertBtn.addEventListener("click", (e) => {
    const rect = convertBtn.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    ripple.className = "ripple-effect";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    convertBtn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  });

  // ---- convert: calls Flask, Python does 100% of the math ----------------
  async function performConversion() {
    hideError();

    const amount = amountInput.value;

    if (!amount || Number(amount) <= 0) {
      showError("Enter an amount greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          from_currency: fromCode,
          to_currency: toCode,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        showError(data.error || "Conversion failed.");
        return;
      }

      renderResult(data);
      addToHistory(data);
      sessionConversions += 1;
      statConversions.textContent = sessionConversions;
      showToast("Conversion complete", "success");
    } catch (err) {
      showError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function renderResult(data) {
    hideError();
    resultCard.hidden = false;
    // Re-trigger the pop animation
    resultCard.style.animation = "none";
    void resultCard.offsetWidth;
    resultCard.style.animation = "";

    resultAmount.textContent = `${formatNumber(data.result)} ${data.to}`;
    resultRate.textContent = `1 ${data.from} = ${formatNumber(data.rate, 6)} ${data.to}`;
  }

  function formatNumber(num, maxDecimals = 4) {
    return Number(num).toLocaleString(undefined, {
      maximumFractionDigits: maxDecimals,
    });
  }

  convertBtn.addEventListener("click", performConversion);
  amountInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performConversion();
  });

  // ---- copy result --------------------------------------------------------
  copyBtn.addEventListener("click", async () => {
    const text = resultAmount.textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add("copied");
      copyLabel.textContent = "Copied";
      showToast("Result copied to clipboard", "success");
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyLabel.textContent = "Copy";
      }, 1800);
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  });

  // ---- favorite pair --------------------------------------------------------
  favBtn.addEventListener("click", () => {
    favoritePair = `${fromCode.toUpperCase()}/${toCode.toUpperCase()}`;
    favBtn.classList.add("active");
    statFavorite.textContent = favoritePair;
    showToast(`${favoritePair} saved as favorite`, "success");
  });

  // ---- history --------------------------------------------------------------
  function addToHistory(data) {
    history.unshift(data);
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = `<li class="history-empty">No conversions yet — your history will show up here.</li>`;
      return;
    }

    historyList.innerHTML = "";
    for (const item of history.slice(0, 25)) {
      const li = document.createElement("li");
      li.className = "history-item";
      li.innerHTML = `
        <span class="h-pair">${formatNumber(item.amount)} ${item.from} → ${formatNumber(item.result)} ${item.to}</span>
        <span class="h-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      `;
      historyList.appendChild(li);
    }
  }

  clearHistoryBtn.addEventListener("click", () => {
    history.length = 0;
    renderHistory();
    showToast("History cleared", "success");
  });

  // ---- scroll-reveal for sections below the fold -----------------------------
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("slide-up");
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".history-card").forEach((node) => revealObserver.observe(node));

  // ---- init -----------------------------------------------------------------
  loadCurrencies();
})();
