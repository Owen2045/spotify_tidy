// /static/js/utils.js
window.App = window.App || {};
App.Utils = {
  escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"'`=\/]/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      "`": "&#96;", "=": "&#61;", "/": "&#47;"
    }[s]));
  },

  // 播放清單：只接受 spotify:track:<22碼>
  parseStrictTrackUris(text) {
    const lines = (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const uris = lines.filter(s => /^spotify:track:[A-Za-z0-9]{22}$/.test(s));
    return Array.from(new Set(uris));
  },

  // 已按讚：只接受 22 碼 ID
  parseStrictTrackIds(text) {
    const lines = (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const ids = lines.filter(s => /^[A-Za-z0-9]{22}$/.test(s));
    return Array.from(new Set(ids));
  },
};
