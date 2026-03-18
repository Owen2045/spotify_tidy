// /static/js/aggrid.demo.js
window.App = window.App || {};
App.AGGridDemo = (() => {
  const elGrid = '#agLikedDemo';
  const elQuick = '#gridQuick';
  const elReset = '#gridReset';

  // 讀「已按讚」暫存；若空，用假資料
  function loadRows() {
    const raw = App.Storage?.get?.(App.Config?.LS?.LIKED, []);
    let rows = Array.isArray(raw) ? raw.slice() : [];

    // 正規化：轉成 grid 需要的欄位
    rows = rows.map(t => {
      const release = t?.release_date || t?.album_release_date || t?.album?.release_date || '';
      const year = parseInt(String(release).slice(0,4), 10);
      return {
        name: t?.name ?? '',
        artists: Array.isArray(t?.artists) ? t.artists.join(', ') : (t?.artists ?? ''),
        album: t?.album ?? t?.album_name ?? '',
        release_date: release ?? '',
        year: isNaN(year) ? null : year,
        id: t?.id ?? '',
        uri: t?.uri ?? '',
      };
    });

    // if (!rows.length) {
    //   // 產生一些假資料以便測試
    //   const artists = ['Taylor Swift','Adele','Ed Sheeran','The Weeknd','BTS','Bruno Mars','Billie Eilish','Coldplay','Ariana Grande','Imagine Dragons'];
    //   const albums = ['Greatest Hits','Best Of','Live','Studio Sessions','Anthology'];
    //   const mk = (n) => ('0000' + n).slice(-4);
    //   for (let i=1;i<=1000;i++) {
    //     const y = 1980 + Math.floor(Math.random()*46); // 1980~2025
    //     const m = 1 + Math.floor(Math.random()*12);
    //     const d = 1 + Math.floor(Math.random()*28);
    //     rows.push({
    //       name: `Song ${i}`,
    //       artists: artists[Math.floor(Math.random()*artists.length)],
    //       album: albums[Math.floor(Math.random()*albums.length)],
    //       release_date: `${y}-${mk(m)}-${mk(d)}`,
    //       year: y,
    //       id: Math.random().toString(36).slice(2, 2+22),
    //       uri: `spotify:track:${Math.random().toString(36).slice(2, 2+22)}`,
    //     });
    //   }
    // }
    return rows;
  }

  // 欄位與濾器
  const columnDefs = [
    { headerName: '名稱', field: 'name', filter: 'agTextColumnFilter', minWidth: 200 },
    { headerName: '藝人', field: 'artists', filter: 'agTextColumnFilter', minWidth: 180 },
    { headerName: '專輯', field: 'album', filter: 'agTextColumnFilter', minWidth: 160 },
    {
      headerName: '年份', field: 'year', filter: 'agNumberColumnFilter', width: 120,
      filterParams: { inRangeInclusive: true }, // 讓 2010-2015 包端點
      valueFormatter: p => (p.value ?? ''),
      floatingFilter: true,
    },
    { headerName: '發行日', field: 'release_date', filter: 'agTextColumnFilter', width: 130 },
    { headerName: 'ID', field: 'id', minWidth: 200, cellClass: 'mono small' },
    { headerName: 'URI', field: 'uri', minWidth: 250, cellClass: 'mono small' },
  ];

  // 預設欄設定
  const defaultColDef = {
    sortable: true,
    filter: true,
    floatingFilter: true,     // 欄上方小搜尋框
    resizable: true,
  };

  let gridApi, gridOptions;

  function init() {
    const rowData = loadRows();

    gridOptions = {
			theme: 'legacy',
      columnDefs,
      defaultColDef,
      rowData,
      animateRows: true,
      rowSelection: 'multiple',
      suppressDragLeaveHidesColumns: true,
      suppressCellSelection: true,
      onGridReady: params => {
        // 自動調整欄寬
        params.api.sizeColumnsToFit();
        // 快速搜尋
        bindQuickFilter(params.api);
        // 重置
        bindReset(params.api);
      },
    };

    const eGridDiv = document.querySelector(elGrid);
    if (!eGridDiv) return;
    gridApi = agGrid.createGrid(eGridDiv, gridOptions);
  }

  function bindQuickFilter(api) {
    const input = document.querySelector(elQuick);
    if (!input) return;
    input.addEventListener('input', () => {
      api.setQuickFilter(input.value || '');
    });
  }

  function bindReset(api) {
    const btn = document.querySelector(elReset);
    if (!btn) return;
    btn.addEventListener('click', () => {
      api.setFilterModel(null);
      api.setQuickFilter(null);
      document.querySelector(elQuick)?.value && (document.querySelector(elQuick).value = '');
      api.onFilterChanged();
    });
  }

  // 對外：初始化
  function mount() { init(); }

  // 讓你在載入/更新資料後可呼叫重繪
  function refreshWithCurrentLS() {
    if (!gridOptions?.api) return;
    gridOptions.api.setRowData(loadRows());
  }

  return { mount, refreshWithCurrentLS };
})();

// 你可以在 DOM ready 或 App.Controller.init() 之後呼叫
document.addEventListener('DOMContentLoaded', () => {
  try { App.AGGridDemo.mount(); } catch (e) { console.error(e); }
});
