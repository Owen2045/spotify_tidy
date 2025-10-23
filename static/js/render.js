// /static/js/render.js
window.App = window.App || {};
App.Render = {
  setStatus(msg) { App.DOM.status.text(`狀態：${msg}`); },

  playlistTitle(name) {
    App.DOM.text.plTitle.text(name || "已選取播放清單");
  },

  playlistList(items, onClick) {
    const ul = App.DOM.lists.playlistList.empty();
    (items || []).forEach(pl => {
      const $li = $(`
        <li class="list-group-item d-flex justify-content-between align-items-center" style="cursor:pointer;">
          <span>${App.Utils.escapeHtml(pl.name)}</span>
          <span class="badge bg-secondary">${pl.tracks_total ?? "-"}</span>
        </li>
      `);
      $li.on("click", () => onClick(pl));
      ul.append($li);
    });
  },

  playlistSelect(items) {
    const sel = App.DOM.select.likedTargetPl;
    if (!sel.length) return;
    const current = sel.val();
    sel.empty();
    sel.append(`<option value="" disabled ${current ? "" : "selected"}>請選擇播放清單</option>`);
    (items || []).forEach(pl => sel.append(new Option(pl.name, pl.id)));
    if (current && sel.find(`option[value="${CSS.escape(current)}"]`).length) sel.val(current);
  },

  // track -> DataTables row
  trackRow(t) {
    const id = t?.id || "";
    const uri = t?.uri || (id ? `spotify:track:${id}` : "");
    const name = t?.name || "";
    const artists = Array.isArray(t?.artists) ? t.artists.join(", ") : (t?.artists || "");
    const album = t?.album || "";
    const release_date = t?.release_date || "";

    return [
      // 新增 data-uri 屬性
      `<input type="checkbox" class="row-check" data-id="${App.Utils.escapeHtml(id)}" data-uri="${App.Utils.escapeHtml(uri)}">`,
      App.Utils.escapeHtml(name),
      App.Utils.escapeHtml(artists),
      App.Utils.escapeHtml(album),
      App.Utils.escapeHtml(release_date),

      `<span class="mono small">${App.Utils.escapeHtml(id)}</span>`
    ];
  },
};
