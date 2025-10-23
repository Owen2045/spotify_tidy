// /static/js/tables.js
window.App = window.App || {};
App.Tables = (() => {
  let plTable, likedTable;

  function init() {
    plTable = App.DOM.tables.pl.DataTable({
      pageLength: 5,
      language: { url: App.Config.DT_I18N },
      columnDefs: [{ targets: 0, orderable: false }],
    });
    likedTable = App.DOM.tables.liked.DataTable({
      pageLength: 5,
      language: { url: App.Config.DT_I18N },
      columnDefs: [{ targets: 0, orderable: false }],
    });

    App.DOM.tables.pl.on("draw.dt", () => syncHeaderCheckbox("pl"));
    App.DOM.tables.liked.on("draw.dt", () => syncHeaderCheckbox("liked"));
  }

  function clear(scope) {
    const table = scope === "pl" ? plTable : likedTable;
    table.clear().draw();
    header(scope).prop({ checked: false, indeterminate: false });
  }

  function setRows(scope, rows) {
    const table = scope === "pl" ? plTable : likedTable;
    table.clear().rows.add(rows).draw();
    header(scope).prop({ checked: false, indeterminate: false });
  }

  function toggleSelectAll(scope, checked) {
    const table = scope === "pl" ? plTable : likedTable;
    $(table.rows({ page: "current" }).nodes())
      .find("input.row-check").prop("checked", checked);
    syncHeaderCheckbox(scope);
  }

  function syncHeaderCheckbox(scope) {
    const table = scope === "pl" ? plTable : likedTable;
    const $header = header(scope);
    const $rows = $(table.rows({ page: "current" }).nodes());
    const $checks = $rows.find("input.row-check");
    if (!$checks.length) return $header.prop({ checked: false, indeterminate: false });
    const total = $checks.length;
    const checked = $checks.filter(":checked").length;
    $header.prop("checked", checked === total);
    $header.prop("indeterminate", checked > 0 && checked < total);
  }

  function header(scope) {
    return scope === "pl" ? App.DOM.chk.plSelectAll : App.DOM.chk.likedSelectAll;
  }

  function getCheckedIds(scope) {
    const table = scope === "pl" ? plTable : likedTable;
    return $(table.rows({ page: "current" }).nodes())
      .find("input.row-check:checked")
      .map((_, el) => $(el).data("id"))
      .get()
      .filter(Boolean);
  }

  // 在 return 物件多加 getCheckedUris
  function getCheckedUris(scope) {
    const table = scope === "pl" ? plTable : likedTable;
    return $(table.rows({ page: "current" }).nodes())
      .find("input.row-check:checked")
      .map((_, el) => $(el).data("uri"))
      .get()
      .filter(Boolean);
  }

  return { init, clear, setRows, toggleSelectAll, syncHeaderCheckbox, getCheckedIds, getCheckedUris };

})();
