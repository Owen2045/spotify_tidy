// /static/js/storage.js
window.App = window.App || {};
App.Storage = {
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn("Storage.set", key, e); }
  },
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn("Storage.get", key, e);
      return fallback;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); }
    catch (e) { /* noop */ }
  },
};
