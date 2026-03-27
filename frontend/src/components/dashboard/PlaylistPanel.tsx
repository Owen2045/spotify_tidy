"use client"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE, type Playlist } from "@/app/page"

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
      <div className="pt-4 px-1">
        <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="px-1">
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <div className="flex flex-col gap-2 pt-2">
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold h-7">
          名稱 <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Input placeholder="過濾..." value={(column.getFilterValue() as string) ?? ""} onChange={(e) => column.setFilterValue(e.target.value)} className="h-7 shadow-none text-xs" />
      </div>
    ),
    cell: ({ row }) => <div className="font-medium text-primary truncate max-w-[150px]" title={row.getValue("name")}>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "artist",
    header: ({ column }) => (
      <div className="flex flex-col gap-2 pt-2">
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold h-7">
          藝人 <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Input placeholder="過濾..." value={(column.getFilterValue() as string) ?? ""} onChange={(e) => column.setFilterValue(e.target.value)} className="h-7 shadow-none text-xs" />
      </div>
    ),
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("artist")}>{row.getValue("artist")}</div>
  },
  {
    accessorKey: "album",
    header: ({ column }) => (
      <div className="flex flex-col gap-2 pt-2">
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="w-full justify-start px-0 font-bold h-7">
          專輯 <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Input placeholder="過濾..." value={(column.getFilterValue() as string) ?? ""} onChange={(e) => column.setFilterValue(e.target.value)} className="h-7 shadow-none text-xs" />
      </div>
    ),
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("album")}>{row.getValue("album")}</div>
  },
  {
    accessorKey: "id",
    header: () => <div className="pt-4 font-bold text-center text-xs">ID</div>,
    cell: ({ row }) => <div className="font-mono text-muted-foreground text-[10px] text-center truncate w-[60px]" title={row.getValue("id")}>{row.getValue("id")}</div>,
  },
]

export function PlaylistPanel({ side, isActive, playlist, targetPlaylist, onClick }: {
  side: "left" | "right",
  isActive: boolean,
  playlist: Playlist | null,
  targetPlaylist: Playlist | null,
  onClick: () => void
}) {
  const [data, setData] = useState<TrackItem[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const loadTracks = () => {
    if (!playlist) return
    setIsLoading(true)
    const endpoint = playlist.id === "liked" ? `${API_BASE}/api/liked` : `${API_BASE}/api/playlist/${playlist.id}/tracks`
    fetch(endpoint)
      .then(res => res.json())
      .then(tracks => setData(tracks))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    setData([])
    setRowSelection({})
    loadTracks()
  }, [playlist])

  const handleTransfer = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (!targetPlaylist || selectedRows.length === 0) return

    let endpoint = ""
    let payload = {}
    if (targetPlaylist.id === "liked") {
      endpoint = `${API_BASE}/api/liked/add`
      payload = { ids: selectedRows.map(r => r.original.id) }
    } else {
      endpoint = `${API_BASE}/api/playlist/${targetPlaylist.id}/add`
      payload = { uris: selectedRows.map(r => r.original.uri) }
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(resData => {
      console.log(`MOCK API (對象: ${targetPlaylist.name})`, payload, "回應:", resData)
      setRowSelection({})
    }).catch(console.error)
  }

  const handleDelete = () => {
    const selectedRows = table.getSelectedRowModel().rows
    if (!playlist || selectedRows.length === 0) return

    let endpoint = ""
    let payload = {}
    let keysToRemove: string[] = []

    if (playlist.id === "liked") {
      endpoint = `${API_BASE}/api/liked/remove`
      keysToRemove = selectedRows.map(r => r.original.id)
      payload = { ids: keysToRemove }
    } else {
      endpoint = `${API_BASE}/api/playlist/${playlist.id}/remove`
      keysToRemove = selectedRows.map(r => r.original.uri)
      payload = { uris: keysToRemove }
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(resData => {
      console.log(`MOCK API 移除 (來源: ${playlist.name})`, payload, "回應:", resData)

      if (playlist.id === "liked") {
        setData(prev => prev.filter(t => !keysToRemove.includes(t.id)))
      } else {
        setData(prev => prev.filter(t => !keysToRemove.includes(t.uri)))
      }
      setRowSelection({})
    }).catch(console.error)
  }

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
    <Card
      onClick={onClick}
      className={`flex-1 overflow-hidden shadow-sm h-full flex flex-col transition-all cursor-default ${isActive ? "border-primary border-2 shadow-md bg-card" : "border-border bg-muted/20 opacity-80"} `}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 flex-none border-b">
        <CardTitle className={`text-base flex items-center ${isActive ? "text-primary font-black" : "text-muted-foreground font-bold"}`}>
          {isActive ? "🔵 選中：" : "⚪ 待選："}
          {playlist ? playlist.name : "請於上方點選清單"}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { table.resetColumnFilters(); table.resetSorting() }}>重置篩選</Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={loadTracks} disabled={!playlist || isLoading}>
            🔄
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 overflow-hidden pt-3 px-3 gap-3">
        {/* 固定在最方的操作按鈕 */}
        <div className={`flex-none flex w-full items-center gap-2 h-[45px] p-2 rounded-md border ${isActive ? "bg-muted/80 shadow-inner" : "bg-transparent"}`}>
          <Button
            size="sm"
            className="flex-1 transition-all"
            disabled={!targetPlaylist || Object.keys(rowSelection).length === 0}
            onClick={handleTransfer}
          >
            {side === "left" ? "→ 新增至右側" : "← 新增至左側"}
            {targetPlaylist && ` [${targetPlaylist.name.slice(0, 9)}...]`}
          </Button>

          <Button variant="destructive" size="sm" className="min-w-[80px]" disabled={Object.keys(rowSelection).length === 0} onClick={handleDelete}>
            🗑️ 拋棄
          </Button>
        </div>

        {/* 中間可以自由滾動的表格區域 */}
        <div className="flex-1 rounded-md border overflow-y-auto relative min-h-0">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const widthClass = header.id === "select" ? "w-[30px]" : header.id === "id" ? "w-[60px]" : "w-[30%]"
                    return (
                      <TableHead key={header.id} className={`align-top pb-3 px-1 ${widthClass}`}>
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
                      <TableCell key={cell.id} className="py-1 px-1">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-14">
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                    {playlist ? (isLoading ? "讀取片段中..." : "找不到對應的資料") : "請先點擊此面板外框以啟用，再點選上方歌單..."}
                  </TableCell>
                </TableRow>
              )}
              {emptyRows > 0 && Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="h-14 hover:bg-transparent">
                  <TableCell colSpan={5} className="border-0" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 固定在最下方的分頁區塊 */}
        <div className="flex-none flex items-center justify-end space-x-2 pb-2 mt-auto pt-1 border-t border-transparent">
          <div className="flex-1 text-[11px] text-muted-foreground font-mono">
            選:{Object.keys(rowSelection).length} / 尋:{table.getFilteredRowModel().rows.length} / 總:{data.length}
          </div>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一頁</Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一頁</Button>
        </div>
      </CardContent>
    </Card>
  )
}
