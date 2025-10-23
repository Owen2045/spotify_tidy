// /static/js/api.js
window.App = window.App || {};
App.API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json();
  },
  async post(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
    return res.json().catch(() => ({}));
  },

  // 拿播放清單
  getPlaylists() { return this.get(App.Config.API.PLAYLISTS); }
  ,
  // 拿指定播放清單歌曲
  getPlaylistTracks(pid) { return this.get(App.Config.API.playlistTracks(pid)); },
  // 新增到指定播放清單(uri)
  addToPlaylistByUris(pid, uris) { return this.post(App.Config.API.playlistAdd(pid), { uris }); },
  // 移除指定播放清單歌曲(uri)
  removeFromPlaylistByUris(pid, uris) { return this.post(App.Config.API.playlistRemove(pid), { uris }); },

  // 拿已按讚
  getLiked() { return this.get(App.Config.API.LIKED); },
  // 刪除已按讚
  unlikeByIds(ids) { return this.post(App.Config.API.UNLIKE, { ids }); },

};
