// /static/js/main.js
// 初始化 Split.js（儲存比例到 localStorage），然後啟動 App.Controller
(function initSplit() {
  const KEY = "layout:tripanel:sizes";  // localStorage key
  const DEF = [20, 40, 40];             // 預設比例
  const MIN = 10;                       // 單欄最小 %

  const load = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) && v.length === 3 ? v : DEF;
    } catch {
      return DEF;
    }
  };
  const save = (sizes) => localStorage.setItem(KEY, JSON.stringify(sizes));

  const sizes = load();

  // 建立三欄分割（播放清單｜左表｜右表）
  window._split = Split(
    ['#panel-playlists', '#panel-selected', '#panel-liked'],
    {
      sizes,
      minSize: [MIN, MIN, MIN],
      gutterSize: 8,
      snapOffset: 0,
      cursor: 'col-resize',
      onDragEnd: save,
    }
  );

  // 手機寬度時的樣式處理（此處維持堆疊；若要真正上下拖曳可再擴充）
  const mq = window.matchMedia('(max-width: 991.98px)');
  const applyMode = () => {
    document.body.classList.toggle('split-vertical', mq.matches);
  };
  mq.addEventListener('change', applyMode);
  applyMode();
})();

// 啟動你的 App（等 DOM 就緒）
$(function () {
  App.Controller.init();
});
