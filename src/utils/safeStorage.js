// Safe localStorage access with automatic sanitation to avoid syntax errors like
// "Uncaught SyntaxError: 'undefined' is not valid JSON"

// Global guard on JSON.parse to prevent "undefined" is not valid JSON anywhere in the app
if (typeof window !== "undefined" && window.JSON && typeof window.JSON.parse === "function") {
  const _origJSONParse = window.JSON.parse;
  window.JSON.parse = function safeJSONParseWrapped(text, reviver) {
    if (
      text === undefined ||
      text === "undefined" ||
      text === null ||
      text === "" ||
      text === "null" ||
      text === "NaN"
    ) {
      return null;
    }
    if (typeof text === "string") {
      const trimmed = text.trim();
      if (trimmed === "" || trimmed === "undefined" || trimmed === "null" || trimmed === "NaN") {
        return null;
      }
    }
    try {
      return _origJSONParse.call(this, text, reviver);
    } catch (err) {
      if (
        typeof text === "string" &&
        (text.trim() === "undefined" || err.message?.includes('"undefined"') || err.message?.includes("is not valid JSON"))
      ) {
        return null;
      }
      throw err;
    }
  };
}

// Global guard on Storage.prototype to prevent storing or returning "undefined"
if (typeof window !== "undefined" && typeof Storage !== "undefined" && Storage.prototype) {
  try {
    const _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (value === undefined || value === "undefined") {
        this.removeItem(key);
        return;
      }
      return _origSetItem.call(this, key, value);
    };

    const _origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const res = _origGetItem.call(this, key);
      if (res === "undefined" || res === "NaN") {
        try { this.removeItem(key); } catch {}
        return null;
      }
      return res;
    };
  } catch (e) {
    console.warn("Could not patch Storage prototype:", e);
  }
}

// Global guard on Response.prototype.json
if (typeof window !== "undefined" && window.Response && Response.prototype && Response.prototype.json) {
  try {
    const _origResponseJson = Response.prototype.json;
    Response.prototype.json = async function () {
      try {
        return await _origResponseJson.call(this);
      } catch (err) {
        if (err instanceof SyntaxError && (err.message?.includes('"undefined"') || err.message?.includes("is not valid JSON"))) {
          console.warn("Handled response.json() syntax error:", err);
          return {};
        }
        throw err;
      }
    };
  } catch (e) {
    console.warn("Could not patch Response.prototype.json:", e);
  }
}

// Global uncaught error listener to prevent crashing if an unhandled JSON error bubbles up
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (
      event.message?.includes('"undefined" is not valid JSON') ||
      (event.error && event.error.message?.includes('"undefined" is not valid JSON'))
    ) {
      console.warn("Global safety handler caught invalid JSON error:", event.message);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason?.message?.includes('"undefined" is not valid JSON') ||
      (typeof event.reason === "string" && event.reason.includes('"undefined" is not valid JSON'))
    ) {
      console.warn("Global safety handler caught unhandled rejection invalid JSON:", event.reason);
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

export function sanitizeLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (
        val === null ||
        val === undefined ||
        val === "undefined" ||
        val === "NaN" ||
        val === "null" ||
        (typeof val === "string" && val.trim() === "undefined")
      ) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn("Could not sanitize localStorage:", e);
  }
}

// Automatically sanitize on load
sanitizeLocalStorage();

export function safeJsonParse(raw, fallback = null) {
  if (
    raw === null ||
    raw === undefined ||
    raw === "" ||
    raw === "undefined" ||
    raw === "null" ||
    raw === "NaN"
  ) {
    return fallback;
  }
  if (typeof raw === "string" && raw.trim() === "undefined") {
    return fallback;
  }
  try {
    const res = JSON.parse(raw);
    return res === undefined ? fallback : res;
  } catch {
    return fallback;
  }
}

export function safeGetItem(key, fallback = null) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = localStorage.getItem(key);
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    const str = JSON.stringify(value);
    if (str === undefined || str === "undefined") {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, str);
  } catch (e) {
    console.warn(`Could not set ${key} in localStorage:`, e);
  }
}

export function safeRemoveItem(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.removeItem(key);
  } catch {}
}
