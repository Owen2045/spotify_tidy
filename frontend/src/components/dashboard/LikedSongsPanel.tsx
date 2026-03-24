import { useState } from "react"
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE, type Playlist } from "@/pages/Dashboard"
import { columns, type TrackItem } from "@/components/dashboard/PlaylistDetails"

export function LikedSongsPanel({ playlists }: { playlists: Playlist[] }) {
  const [data, setData] = useState<TrackItem[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<string>("")

  const loadLikedSongs = () => {
    setIsLoading(true)
    fetch(`${API_BASE}/api/me/tracks`)
      .then(res => res.json())
      .then(tracks => setData(tracks))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  const handleTransferToPlaylist = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (!selectedTarget || selectedRows.length === 0) return
    const uris = selectedRows.map(r => r.original.uri)
    fetch(`${API_BASE}/api/playlist/${selectedTarget}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris })
    }).then(res => res.json())
      .then(resData => {
        console.log("MOCK: 空投至指定歌單 Payload:", uris, "Response:", resData)
        setRowSelection({})
      }).catch(console.error)
  }

  const handleRemoveFromLiked = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (selectedRows.length === 0) return
    const ids = selectedRows.map(r => r.original.id)
    fetch(`${API_BASE}/api/liked/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    }).then(res => res.json())
      .then(resData => {
        console.log("MOCK: 自按讚庫移除 Payload:", ids, "Response:", resData)
        // 樂觀 UI 更新
        setData(prev => prev.filter(t => !ids.includes(t.id)))
        setRowSelection({})
      }).catch(console.error)
  }

  const table = useReactTable({
    data,
    columns, // 借用 PlaylistDetails 封裝好的高度重用欄位元件
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
    initialState: { pagination: { pageSize: 5 } }
  })

  const records = table.getRowModel().rows
  const pageSize = table.getState().pagination.pageSize
  const emptyRows = records.length > 0 ? Math.max(0, pageSize - records.length) : pageSize - 1

  return (
    <Card className="flex-1 shadow-sm h-full flex flex-col border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3 flex-none">
        <CardTitle className="text-lg">我按讚的極品歌曲庫</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { table.resetColumnFilters(); table.resetSorting() }}>清除排序與過濾</Button>
          <Button variant="secondary" size="sm" onClick={loadLikedSongs} disabled={isLoading}>
            {isLoading ? "全力下載中..." : "自 Spotify 下載按讚歌曲"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 h-[90px]">
          <label className="text-sm font-medium leading-none">右側控制列：選擇目標歌單並把歌曲空投過去</label>
          <div className="flex gap-2 items-start h-full pb-1">
            <Select value={selectedTarget} onValueChange={(val) => setSelectedTarget(val || "")}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="請先點擊展開並選擇要空投的清單名稱..." />
              </SelectTrigger>
              <SelectContent>
                {playlists.length === 0 ? (
                  <SelectItem value="none" disabled>請先從上方區域載入歌單</SelectItem>
                ) : (
                  playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-2 pt-0.5 min-w-[160px]">
              <Button size="sm" disabled={!selectedTarget || Object.keys(rowSelection).length === 0} className="h-9" onClick={handleTransferToPlaylist}>
                ← 空投至左側清單
              </Button>
              <Button variant="destructive" size="sm" className="h-9" disabled={Object.keys(rowSelection).length === 0} onClick={handleRemoveFromLiked}>
                🗑️ 移除我按的讚
              </Button>
            </div>

          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const widthClass = header.id === "select" ? "w-[40px]" : header.id === "id" ? "w-[80px]" : "w-[25%]"
                    return (
                      <TableHead key={header.id} className={`align-top pb-3 px-3 ${widthClass}`}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {records.length ? (
                records.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="h-14">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2 px-3 truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-14">
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isLoading ? "⏳ 向 Spotify 總部抓取中..." : "👉 點擊右上角從 Spotify 拉取您最愛的百大歌曲！"}
                  </TableCell>
                </TableRow>
              )}
              {emptyRows > 0 && Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="h-14 hover:bg-transparent">
                  <TableCell colSpan={6} className="border-0" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end space-x-2">
          <div className="flex-1 text-sm text-muted-foreground font-mono">
            已精準勾選 {Object.keys(rowSelection).length} 筆 / 總共挖掘 {data.length} 首極品
          </div>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一頁</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一頁</Button>
        </div>
      </CardContent>
    </Card>
  )
}
