// ====================== 基本狀態 ======================
let currentPlaylist = { id: null, name: "尚未選取" };
let plTable, likedTable;

// DataTables 繁中語系（對應 1.13.x）
const DT_I18N = "https://cdn.datatables.net/plug-ins/1.13.8/i18n/zh-HANT.json";

// ====================== localStorage helpers ======================
function lsSetJSON(key, val) {
	try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn("lsSetJSON", e); }
}
function lsGetJSON(key, fallback = null) {
	try {
		const raw = localStorage.getItem(key);
		if (raw == null) return fallback;
		return JSON.parse(raw);
	} catch (e) {
		console.warn("lsGetJSON", e);
		return fallback;
	}
}
function lsRemove(key) {
	try { localStorage.removeItem(key); } catch (e) { /* noop */ }
}

// key 命名
const LS_KEYS = {
	playlists: "pl:list",                     // [{id, name, tracks_total}, ...]
	playlistTracks: (pid) => `pl:tracks:${pid}`, // Array<track> for playlist
	liked: "liked:list"                       // Array<track>
};

// ====================== 初始化 ======================
$(function () {
	initTables();
	bindUI();

	// 播放清單：若 localStorage 有就用；沒有才打 API
	loadPlaylists(/*force*/ false);

	// ▶ 已按讚：每次 F5（頁面載入）都重打 API，覆蓋 localStorage
	preloadLikedOnPageLoad();
});

function initTables() {
	plTable = $("#pl-table").DataTable({
		pageLength: 5,
		language: { url: DT_I18N },
		columnDefs: [{ targets: 0, orderable: false }]
	});

	likedTable = $("#liked-table").DataTable({
		pageLength: 5,
		language: { url: DT_I18N },
		columnDefs: [{ targets: 0, orderable: false }]
	});

	$("#pl-table").on("draw.dt", () => syncHeaderCheckbox("pl"));
	$("#liked-table").on("draw.dt", () => syncHeaderCheckbox("liked"));
}

function bindUI() {
  // 先移除舊的 handler，避免重複綁定
  $("#btn-login").off("click");
  $("#btn-refresh-pl").off("click");
  $("#btn-reload-pl-tracks").off("click");
  $("#btn-load-liked").off("click");
  $("#btn-add").off("click");
  $("#btn-remove").off("click");
  $("#btn-like").off("click");
  $("#btn-unlike").off("click");
  $("#pl-select-all").off("change");
  $("#liked-select-all").off("change");
  $("#pl-table tbody").off("change", "input.row-check");
  $("#liked-table tbody").off("change", "input.row-check");

  // ✅ 與你原本一致的功能
  $("#btn-login").on("click", onLogin);
  $("#btn-refresh-pl").on("click", onRefreshPlaylists);         // 重打 /api/playlists 並覆蓋暫存
  $("#btn-reload-pl-tracks").on("click", onReloadPlaylistTracks); // 重打 /api/playlist/:id/tracks 並覆蓋暫存
  $("#btn-load-liked").on("click", onLoadLikedFromLocalOnly);     // 只讀 localStorage，不打 API（F5 已預抓）

  $("#btn-add").on("click", onAddToCurrentPlaylist);             // POST /add
  $("#btn-remove").on("click", onRemoveFromCurrentPlaylist);     // POST /remove
  $("#btn-like").on("click", onAddLikedSelectionToPlaylist);     // 右表勾選→加入指定播放清單
  $("#btn-unlike").on("click", onUnlikeAndUpdateLocal);          // 從已按讚移除（更新 localStorage）

  $("#pl-select-all").on("change", function () { toggleSelectAll("pl", this.checked); });
  $("#liked-select-all").on("change", function () { toggleSelectAll("liked", this.checked); });

  $("#pl-table tbody").on("change", "input.row-check", () => syncHeaderCheckbox("pl"));
  $("#liked-table tbody").on("change", "input.row-check", () => syncHeaderCheckbox("liked"));
}


// ====================== 播放清單 / 曲目 ======================
// 播放清單列表：除非 force，否則先看 localStorage；沒有才打 API
async function loadPlaylists(force = false) {
	try {
		if (!force) {
			const cached = lsGetJSON(LS_KEYS.playlists, null);
			if (Array.isArray(cached)) {
				renderPlaylistList(cached);
				populatePlaylistSelect(cached);
				setStatus("播放清單（使用 localStorage 暫存）");
				return;
			}
		}
		setStatus("載入播放清單…");
		const res = await fetch("/api/playlists");
		const data = await res.json(); // [{id, name, tracks_total}, ...]
		lsSetJSON(LS_KEYS.playlists, data || []);
		renderPlaylistList(data || []);
		populatePlaylistSelect(data || []);
		setStatus("播放清單已更新");
	} catch (e) {
		console.error(e);
		setStatus("載入播放清單失敗");
	}
}

function populatePlaylistSelect(items) {
	const $sel = $("#sel-liked-target-pl");
	if (!$sel.length) return;
	const current = $sel.val();
	$sel.empty();

	$sel.append(`<option value="" disabled ${current ? "" : "selected"}>請選擇播放清單</option>`);
	(items || []).forEach(pl => {
		const opt = document.createElement("option");
		opt.value = pl.id;
		opt.textContent = pl.name;
		$sel.append(opt);
	});
	if (current && $sel.find(`option[value="${CSS.escape(current)}"]`).length) {
		$sel.val(current);
	}
}

function renderPlaylistList(items) {
	const $ul = $("#pl-list").empty();
	(items || []).forEach(pl => {
		const $li = $(`
      <li class="list-group-item d-flex justify-content-between align-items-center" style="cursor:pointer;">
        <span>${escapeHtml(pl.name)}</span>
        <span class="badge bg-secondary">${pl.tracks_total ?? "-"}</span>
      </li>
    `);
		$li.on("click", () => {
			currentPlaylist = { id: pl.id, name: pl.name };
			loadPlaylistTracks(pl.id, pl.name, /*force*/ false); // 先用 localStorage，沒有才打 API
		});
		$ul.append($li);
	});
}

async function loadPlaylistTracks(playlistId, playlistName, force = false) {
	$("#pl-title").text(playlistName || "已選取播放清單");
	const key = LS_KEYS.playlistTracks(playlistId);

	try {
		if (!force) {
			const cached = lsGetJSON(key, null);
			if (Array.isArray(cached)) {
				const rows = cached.map(trackToRowHtml);
				plTable.clear().rows.add(rows).draw();
				$("#pl-select-all").prop({ checked: false, indeterminate: false });
				setStatus(`已載入 ${rows.length} 首歌（播放清單曲目 / localStorage 暫存）`);
				return;
			}
		}
		setStatus(`載入播放清單曲目…`);
		const res = await fetch(`/api/playlist/${encodeURIComponent(playlistId)}/tracks`);
		const data = await res.json(); // [{id, name, artists, album}, ...]
		lsSetJSON(key, data || []);

		const rows = (data || []).map(trackToRowHtml);
		plTable.clear().rows.add(rows).draw();
		$("#pl-select-all").prop({ checked: false, indeterminate: false });
		setStatus(`已載入 ${rows.length} 首歌（播放清單曲目 / 已更新暫存）`);
	} catch (e) {
		console.error(e);
		setStatus("載入播放清單曲目失敗");
	}
}

// ====================== 已按讚（右表） ======================
// ▶ 每次頁面載入都重打 API，並覆蓋 localStorage（符合「F5 才會打 API」的語意）
async function preloadLikedOnPageLoad() {
	try {
		setStatus("（預抓）正在取得已按讚曲目…");
		const res = await fetch(`/api/liked`);
		const data = await res.json();
		lsSetJSON(LS_KEYS.liked, data || []);
		setStatus(`已完成預抓已按讚（${(data || []).length} 首）`);
	} catch (e) {
		console.error(e);
		setStatus("預抓已按讚曲目失敗");
	}
}

// 將一筆 track 轉成 DataTables row（含 checkbox）
function trackToRowHtml(t) {
	const id = t?.id || "";
	const name = t?.name || "";
	const artists = Array.isArray(t?.artists) ? t.artists.join(", ") : (t?.artists || "");
	const album = t?.album || "";
	return [
		`<input type="checkbox" class="row-check" data-id="${escapeHtml(id)}">`,
		escapeHtml(name),
		escapeHtml(artists),
		escapeHtml(album),
		`<span class="mono small">${escapeHtml(id)}</span>`
	];
}


// ▶ 按「載入」時只用 localStorage，不打 API
function renderLikedFromLocal() {
	const liked = lsGetJSON(LS_KEYS.liked, null);
	if (!Array.isArray(liked)) {
		setStatus("尚無已按讚暫存：請按 F5 重整以建立暫存");
		likedTable.clear().draw();
		$("#liked-select-all").prop({ checked: false, indeterminate: false });
		return;
	}
	const rows = liked.map(trackToRowHtml);
	likedTable.clear().rows.add(rows).draw();
	$("#liked-select-all").prop({ checked: false, indeterminate: false });
	setStatus(`已載入 ${rows.length} 首歌（已按讚 / localStorage 暫存）`);
}

// ====================== 勾選 / 工具 ======================
function toggleSelectAll(scope, checked) {
	const table = scope === "pl" ? plTable : likedTable;
	$(table.rows({ page: "current" }).nodes())
		.find("input.row-check")
		.prop("checked", checked);
	syncHeaderCheckbox(scope);
}

function syncHeaderCheckbox(scope) {
	const table = scope === "pl" ? plTable : likedTable;
	const header = scope === "pl" ? "#pl-select-all" : "#liked-select-all";
	const $header = $(header);
	const $rowsOnPage = $(table.rows({ page: "current" }).nodes());
	const $checks = $rowsOnPage.find("input.row-check");

	if (!$checks.length) {
		$header.prop({ checked: false, indeterminate: false });
		return;
	}
	const total = $checks.length;
	const checked = $checks.filter(":checked").length;
	$header.prop("checked", checked === total);
	$header.prop("indeterminate", checked > 0 && checked < total);
}

function getCheckedIds(scope) {
	const table = scope === "pl" ? plTable : likedTable;
	return $(table.rows({ page: "current" }).nodes())
		.find("input.row-check:checked")
		.map((_, el) => $(el).data("id"))
		.get()
		.filter(Boolean);
}

function parseTrackIds(text) {
	const lines = (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
	const ids = [];
	for (const s of lines) {
		let id = null;
		const m1 = s.match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/);
		if (m1) id = m1[1];
		const m2 = s.match(/spotify:track:([A-Za-z0-9]{22})/);
		if (m2) id = m2[1];
		const m3 = s.match(/^([A-Za-z0-9]{22})$/);
		if (m3) id = m3[1];
		if (id) ids.push(id);
	}
	return Array.from(new Set(ids));
}

async function postJSON(url, payload) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload || {})
	});
	if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
	return res.json().catch(() => ({}));
}

function setStatus(msg) {
	$("#status").text(`狀態：${msg}`);
}

function escapeHtml(str) {
	return String(str ?? "").replace(/[&<>"'`=\/]/g, s => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
		"`": "&#96;", "=": "&#61;", "/": "&#47;"
	}[s]));
}


function onLogin() {
  location.href = "/";
}

function onRefreshPlaylists() {
  // 強制刷新播放清單清單與右側下拉，並覆蓋 localStorage
  loadPlaylists(true);
}

function onReloadPlaylistTracks() {
  if (!currentPlaylist.id) return setStatus("尚未選取播放清單");
  // 強制刷新目前清單曲目並覆蓋 localStorage
  loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
}

function onLoadLikedFromLocalOnly() {
  // 右表（已按讚）按「載入」：只從 localStorage 畫面，不打 API
  renderLikedFromLocal();
}

async function onAddToCurrentPlaylist() {
  if (!currentPlaylist.id) return setStatus("請先選取播放清單");
  const ids = parseTrackIds($("#txt-uris").val());
  if (!ids.length) return setStatus("沒有可處理的 Track");

  try {
    await postJSON(`/api/playlist/${encodeURIComponent(currentPlaylist.id)}/add`, { ids });
    setStatus(`已加入 ${ids.length} 首歌到播放清單`);
    // 失效並重抓（覆蓋 localStorage）
    lsRemove(LS_KEYS.playlistTracks(currentPlaylist.id));
    await loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
  } catch (e) {
    console.error(e);
    setStatus("加入到播放清單失敗");
  }
}

async function onRemoveFromCurrentPlaylist() {
  if (!currentPlaylist.id) return setStatus("請先選取播放清單");
  const idsInput = parseTrackIds($("#txt-uris").val());
  const idsChecked = getCheckedIds("pl");
  const ids = idsInput.length ? idsInput : idsChecked;
  if (!ids.length) return setStatus("沒有可處理的 Track");

  try {
    await postJSON(`/api/playlist/${encodeURIComponent(currentPlaylist.id)}/remove`, { ids });
    setStatus(`已自播放清單移除 ${ids.length} 首歌`);
    // 失效並重抓（覆蓋 localStorage）
    lsRemove(LS_KEYS.playlistTracks(currentPlaylist.id));
    await loadPlaylistTracks(currentPlaylist.id, currentPlaylist.name, true);
  } catch (e) {
    console.error(e);
    setStatus("自播放清單移除失敗");
  }
}

async function onAddLikedSelectionToPlaylist() {
  const targetPlId = $("#sel-liked-target-pl").val();
  if (!targetPlId) return setStatus("請先選擇目標播放清單");

  // 只取當前頁面勾選（符合你既有需求）
  const ids = getCheckedIds("liked");
  if (!ids.length) return setStatus("請先在「已按讚」清單勾選要加入的歌曲（僅當前頁面）");

  try {
    await postJSON(`/api/playlist/${encodeURIComponent(targetPlId)}/add`, { ids });
    setStatus(`已將 ${ids.length} 首歌加入到播放清單`);
    // 若加入的是左側目前所選播放清單，失效其曲目暫存（交由你決定是否手動按「重載曲目」）
    if (currentPlaylist.id === targetPlId) {
      lsRemove(LS_KEYS.playlistTracks(targetPlId));
    }
  } catch (e) {
    console.error(e);
    setStatus("加入播放清單失敗");
  }
}

async function onUnlikeAndUpdateLocal() {
  // 右表移除：沿用你原本 API，再同步更新 localStorage，然後用暫存重畫
  const idsInput = parseTrackIds($("#txt-liked").val());
  const idsChecked = getCheckedIds("liked");
  const ids = idsInput.length ? idsInput : idsChecked;
  if (!ids.length) return setStatus("沒有可處理的 Track");

  try {
    await postJSON(`/api/liked/remove`, { ids });
    setStatus(`已自「已按讚」移除 ${ids.length} 首歌`);
    const liked = lsGetJSON(LS_KEYS.liked, []);
    if (Array.isArray(liked)) {
      const toRemove = new Set(ids);
      const updated = liked.filter(t => !toRemove.has(t.id));
      lsSetJSON(LS_KEYS.liked, updated);
    }
    renderLikedFromLocal();
  } catch (e) {
    console.error(e);
    setStatus("移除已按讚失敗");
  }
}
