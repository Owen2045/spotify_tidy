import { useEffect, useState } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE, type Playlist } from "@/pages/Dashboard"

export type TrackItem = {
  id: string
  name: string
  artist: string
  album: string
  uri: string
}

export const columns: ColumnDef<TrackItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="pt-4 px-2">
        <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="px-2">
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold">
            歌曲名稱
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input placeholder="過濾名稱..." value={(column.getFilterValue() as string) ?? ""} onChange={(event) => column.setFilterValue(event.target.value)} className="h-8 shadow-none" />
        </div>
      )
    },
    cell: ({ row }) => <div className="font-medium text-primary truncate max-w-[200px]" title={row.getValue("name")}>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "artist",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold">
            藝人
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input placeholder="過濾藝人..." value={(column.getFilterValue() as string) ?? ""} onChange={(event) => column.setFilterValue(event.target.value)} className="h-8 shadow-none" />
        </div>
      )
    },
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("artist")}>{row.getValue("artist")}</div>
  },
  {
    accessorKey: "album",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold">
            專輯
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input placeholder="過濾專輯..." value={(column.getFilterValue() as string) ?? ""} onChange={(event) => column.setFilterValue(event.target.value)} className="h-8 shadow-none" />
        </div>
      )
    },
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("album")}>{row.getValue("album")}</div>
  },
  {
    accessorKey: "id",
    header: () => <div className="pt-4 font-bold text-right">ID</div>,
    cell: ({ row }) => <div className="font-mono text-muted-foreground text-xs text-right truncate w-[80px]" title={row.getValue("id")}>{row.getValue("id")}</div>,
  },
]

export function PlaylistDetails({ selectedPlaylist }: { selectedPlaylist: Playlist | null }) {
  const [data, setData] = useState<TrackItem[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [trackInput, setTrackInput] = useState("")

  const loadTracks = () => {
    if (!selectedPlaylist) return
    setIsLoading(true)
    fetch(`${API_BASE}/api/playlist/${selectedPlaylist.id}/tracks`)
      .then(res => res.json())
      .then(tracks => setData(tracks))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  const handleTransferToLiked = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (!selectedPlaylist || selectedRows.length === 0) return
    const ids = selectedRows.map(r => r.original.id)
    fetch(`${API_BASE}/api/liked/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    }).then(res => res.json())
      .then(resData => {
        console.log("MOCK: 轉移至按讚歌單 Payload:", ids, "Response:", resData)
        setRowSelection({})
      }).catch(console.error)
  }

  const handleRemoveFromPlaylist = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (!selectedPlaylist || selectedRows.length === 0) return
    const uris = selectedRows.map(r => r.original.uri)
    fetch(`${API_BASE}/api/playlist/${selectedPlaylist.id}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris })
    }).then(res => res.json())
      .then(resData => {
        console.log("MOCK: 從此歌單移除 Payload:", uris, "Response:", resData)
        // 樂觀 UI 更新：成功發送請求即刻移除節點，消滅延遲感
        setData(prev => prev.filter(t => !uris.includes(t.uri)))
        setRowSelection({})
      }).catch(console.error)
  }

  // 監聽歌單變更：一換歌單就清空並自動抓取該歌單曲目
  useEffect(() => {
    setData([])
    setRowSelection({})
    loadTracks()
  }, [selectedPlaylist])

  const table = useReactTable({
    data,
    columns,
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
        <CardTitle className="text-lg">
          {selectedPlaylist ? `✅ 正在檢視: ${selectedPlaylist.name}` : "尚未選取歌單，請由上方標籤選擇"}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { table.resetColumnFilters(); table.resetSorting() }}>清除篩選</Button>
          <Button variant="secondary" size="sm" onClick={loadTracks} disabled={!selectedPlaylist || isLoading}>
            {isLoading ? "努力讀取 API 中..." : "緊急重新載入 (Sync)"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 h-[90px]">
          <label className="text-sm font-medium leading-none">
            左側控制列：勾選下方歌曲後，進行向右轉移或刪除
          </label>
          <div className="flex gap-2 h-full">
            <div className="flex-1 border rounded-md bg-muted/30 p-3 text-sm flex items-center text-muted-foreground">
              📝 轉移操作皆已切換為 Mock 測試模式。API 皆可於 Console 與終端機檢視真實 Payload 回傳。
            </div>
            <div className="flex flex-col gap-2 justify-center min-w-[140px]">
              <Button size="sm" disabled={!selectedPlaylist || Object.keys(rowSelection).length === 0} onClick={handleTransferToLiked}>
                → 轉移至按讚歌單
              </Button>
              <Button variant="destructive" size="sm" disabled={!selectedPlaylist || Object.keys(rowSelection).length === 0} onClick={handleRemoveFromPlaylist}>
                🗑️ 自本歌單移除
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
                      <TableCell key={cell.id} className="py-2 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-14">
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {selectedPlaylist ? (isLoading ? "⏳ 爬取雲端真實資料中..." : "這份歌單的資料似乎不存在！") : "👈👈 點擊上面任一按鈕，開始檢視歌單..."}
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
            已勾選 {Object.keys(rowSelection).length} 筆 / 總計 {data.length} 首真實曲目
          </div>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一頁</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一頁</Button>
        </div>
      </CardContent>
    </Card>
  )
}
