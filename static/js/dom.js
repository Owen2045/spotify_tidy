// /static/js/dom.js
// 注意：此檔需在 HTML 結尾載入；本專案的 <script> 都在 </body> 前載入，所以安全。
window.App = window.App || {};
App.DOM = {
  btn: {
    login:               $("#btn-login"),
    refreshPlaylists:    $("#btn-refresh-pl"),
    reloadPlaylistTracks:$("#btn-reload-pl-tracks"),
    loadLiked:           $("#btn-load-liked"),
    addToPlaylist:       $("#btn-add"),
    removeFromPlaylist:  $("#btn-remove"),
    likeToPlaylist:      $("#btn-like"),
    unlike:              $("#btn-unlike"),
  },
  chk: {
    plSelectAll:     $("#pl-select-all"),
    likedSelectAll:  $("#liked-select-all"),
  },
  lists: {
    playlistList: $("#pl-list"),
  },
  tables: {
    pl:    $("#pl-table"),
    liked: $("#liked-table"),
  },
  select: {
    likedTargetPl: $("#sel-liked-target-pl"),
  },
  text: {
    plTitle: $("#pl-title"),
  },
  status: $("#status"),
};
