// /static/js/controller.js
window.App = window.App || {};
App.Controller = (() => {
  let currentPlaylist = { id: null, name: "尚未選取" };

  function init() {
    App.Tables.init();
    bind();
    // 播放清單：localStorage 優先；按刷新才重打 API
    loadPlaylists(false);
    // 已按讚：F5 預抓 API → 覆蓋 localStorage；按「載入」只讀暫存
    preloadLikedOnPageLoad();
  }

  function bind() {
    // 先清掉舊的 handler
    Object.values(App.DOM.btn).forEach($b => $b && $b.off("click"));
    App.DOM.chk.plSelectAll.off("change");
    App.DOM.chk.likedSelectAll.off("change");
    App.DOM.tables.pl.find("tbody").off("change", "input.row-check");
    App.DOM.tables.liked.find("tbody").off("change", "input.row-check");

    // Actions
    App.DOM.btn.login.on("click", () => location.href = App.Config.API.LOGIN);
    App.DOM.btn.refreshPlaylists.on("click", () => loadPlaylists(true));
    App.DOM.btn.reloadPlaylistTracks.on("click", () => {
      if (!currentPlaylist.id) return App.Render.setStatus("尚未選取播放清單");
      loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
    });
    App.DOM.btn.loadLiked.on("click", () => renderLikedFromLocal());

    App.DOM.btn.addToPlaylist.on("click", onAddToCurrentPlaylist);
    App.DOM.btn.removeFromPlaylist.on("click", onRemoveFromCurrentPlaylist);
    App.DOM.btn.likeToPlaylist.on("click", onAddLikedSelectionToPlaylist);
    App.DOM.btn.unlike.on("click", onUnlikeAndUpdateLocal);

    // Checkboxes
    App.DOM.chk.plSelectAll.on("change", function () { App.Tables.toggleSelectAll("pl", this.checked); });
    App.DOM.chk.likedSelectAll.on("change", function () { App.Tables.toggleSelectAll("liked", this.checked); });
    App.DOM.tables.pl.find("tbody").on("change", "input.row-check", () => App.Tables.syncHeaderCheckbox("pl"));
    App.DOM.tables.liked.find("tbody").on("change", "input.row-check", () => App.Tables.syncHeaderCheckbox("liked"));
  }

  /* ---------- 播放清單列表 ---------- */
  async function loadPlaylists(force) {
    try {
      if (!force) {
        const cached = App.Storage.get(App.Config.LS.PLAYLISTS, null);
        if (Array.isArray(cached)) {
          App.Render.playlistList(cached, onPickPlaylist);
          App.Render.playlistSelect(cached);
          App.Render.setStatus("播放清單（localStorage 暫存）");
          return;
        }
      }
      App.Render.setStatus("載入播放清單…");
      const data = await App.API.getPlaylists();
      App.Storage.set(App.Config.LS.PLAYLISTS, data || []);
      App.Render.playlistList(data || [], onPickPlaylist);
      App.Render.playlistSelect(data || []);
      App.Render.setStatus("播放清單已更新");
    } catch (e) {
      console.error(e);
      App.Render.setStatus("載入播放清單失敗");
    }
  }

  function onPickPlaylist(pl) {
    currentPlaylist = { id: pl.id, name: pl.name };
    loadPlaylistTracks(pl.id, pl.name, false); // 優先 localStorage
  }

  /* ---------- 播放清單曲目 ---------- */
  async function loadPlaylistTracks(playlistId, playlistName, force) {
    App.Render.playlistTitle(playlistName);
    const key = App.Config.LS.playlistTracksKey(playlistId);
    try {
      if (!force) {
        const cached = App.Storage.get(key, null);
        if (Array.isArray(cached)) {
          App.Tables.setRows("pl", cached.map(App.Render.trackRow));
          App.Render.setStatus(`已載入 ${cached.length} 首歌（播放清單曲目 / localStorage）`);
          return;
        }
      }
      App.Render.setStatus("載入播放清單曲目…");
      const data = await App.API.getPlaylistTracks(playlistId);
      App.Storage.set(key, data || []);
      App.Tables.setRows("pl", (data || []).map(App.Render.trackRow));
      App.Render.setStatus(`已載入 ${(data || []).length} 首歌（播放清單曲目 / 已更新暫存）`);
    } catch (e) {
      console.error(e);
      App.Render.setStatus("載入播放清單曲目失敗");
    }
  }

  /* ---------- 已按讚（F5 預抓；按「載入」只讀暫存） ---------- */
  async function preloadLikedOnPageLoad() {
    try {
      App.Render.setStatus("（預抓）正在取得已按讚曲目…");
      const data = await App.API.getLiked();
      App.Storage.set(App.Config.LS.LIKED, data || []);
      App.Render.setStatus(`已完成預抓已按讚（${(data || []).length} 首）`);
    } catch (e) {
      console.error(e);
      App.Render.setStatus("預抓已按讚曲目失敗");
    }
  }

  function renderLikedFromLocal() {
    const liked = App.Storage.get(App.Config.LS.LIKED, null);
    if (!Array.isArray(liked)) {
      App.Tables.clear("liked");
      App.Render.setStatus("尚無已按讚暫存：請按 F5 重整以建立暫存");
      return;
    }
    App.Tables.setRows("liked", liked.map(App.Render.trackRow));
    App.Render.setStatus(`已載入 ${liked.length} 首歌（已按讚 / localStorage）`);
  }

  /* ---------- Buttons: 左側加入 / 移除；右側加入 / 取消讚 ---------- */
  async function onAddToCurrentPlaylist() {
    if (!currentPlaylist.id) return App.Render.setStatus("請先選取播放清單");

    // 只接受 URI
    const uris = App.Utils.parseStrictTrackUris($("#txt-uris").val());

    if (!uris.length) return App.Render.setStatus("沒有可處理的 Track（請貼 spotify:track:<id>）");

    try {
      await App.API.addToPlaylistByUris(currentPlaylist.id, uris);
      App.Render.setStatus(`已加入 ${uris.length} 首歌到播放清單（URI）`);
      App.Storage.remove(App.Config.LS.playlistTracksKey(currentPlaylist.id));
      await loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
    } catch (e) {
      console.error(e);
      App.Render.setStatus("加入到播放清單失敗");
    }
  }



  async function onRemoveFromCurrentPlaylist() {
    if (!currentPlaylist.id) return App.Render.setStatus("請先選取播放清單");

    const inputUris = App.Utils.parseStrictTrackUris($("#txt-uris").val());
    const uris = inputUris.length ? inputUris : App.Tables.getCheckedUris("pl");
    if (!uris.length) return App.Render.setStatus("沒有可處理的 Track（請貼 URI 或勾選）");

    try {
      await App.API.removeFromPlaylistByUris(currentPlaylist.id, uris);
      App.Render.setStatus(`已自播放清單移除 ${uris.length} 首歌（URI）`);
      App.Storage.remove(App.Config.LS.playlistTracksKey(currentPlaylist.id));
      await loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
    } catch (e) {
      console.error(e);
      App.Render.setStatus("自播放清單移除失敗");
    }
  }


  async function onAddLikedSelectionToPlaylist() {
    const targetPlId = App.DOM.select.likedTargetPl.val();
    if (!targetPlId) return App.Render.setStatus("請先選擇目標播放清單");

    // 從「已按讚」表格勾選的列，拿 data-uri（播放清單端全走 URI）
    const uris = App.Tables.getCheckedUris("liked");
    if (!uris.length) {
      return App.Render.setStatus("請先在「已按讚」清單勾選要加入的歌曲（僅當前頁面）");
    }

    try {
      // 加到「選擇的目標播放清單」
      await App.API.addToPlaylistByUris(targetPlId, uris);
      App.Render.setStatus(`已將 ${uris.length} 首歌加入到播放清單`);

      // 若加到的就是左側目前顯示的清單，失效其曲目暫存（下次載入會重新抓）
      if (targetPlId === (typeof currentPlaylist !== "undefined" ? currentPlaylist.id : null)) {
        App.Storage.remove(App.Config.LS.playlistTracksKey(targetPlId));
      }
    } catch (e) {
      console.error(e);
      App.Render.setStatus("加入播放清單失敗");
    }
  }

  async function onUnlikeAndUpdateLocal() {
    const inputIds = App.Utils.parseStrictTrackIds($("#txt-liked").val());
    const ids = inputIds.length ? inputIds : App.Tables.getCheckedIds("liked");
    if (!ids.length) return App.Render.setStatus("沒有可處理的 Track（請貼 22 碼 ID 或勾選）");

    try {
      await App.API.unlikeByIds(ids);
      // 同步更新 localStorage（以 id 比對）
      const liked = App.Storage.get(App.Config.LS.LIKED, []);
      const removeSet = new Set(ids);
      const updated = Array.isArray(liked) ? liked.filter(t => !removeSet.has(t.id)) : [];
      App.Storage.set(App.Config.LS.LIKED, updated);
      renderLikedFromLocal();
      App.Render.setStatus(`已自「已按讚」移除 ${ids.length} 首歌`);
    } catch (e) {
      console.error(e);
      App.Render.setStatus("移除已按讚失敗");
    }
  }


  return { init };
})();
