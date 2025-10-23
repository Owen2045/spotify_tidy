// /static/js/config.js
window.App = window.App || {};
App.Config = {
  DT_I18N: "https://cdn.datatables.net/plug-ins/1.13.8/i18n/zh-HANT.json",
  LS: {
    PLAYLISTS: "pl:list",
    playlistTracksKey: (pid) => `pl:tracks:${pid}`,
    LIKED: "liked:list",
  },
  API: {
    PLAYLISTS: "/api/playlists",
    playlistTracks: (pid) => `/api/playlist/${encodeURIComponent(pid)}/tracks`,
    playlistAdd:    (pid) => `/api/playlist/${encodeURIComponent(pid)}/add`,
    playlistRemove: (pid) => `/api/playlist/${encodeURIComponent(pid)}/remove`,
    LIKED: "/api/liked",
    UNLIKE: "/api/liked/remove",
    LOGIN: "/",
  },
};
