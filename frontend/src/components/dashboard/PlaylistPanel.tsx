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
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchWithAuth } from "@/lib/auth"
import { type Playlist } from "@/app/services/spotify/page"

export type TrackItem = {
  id: string
  name: string
  artists: string
  album: string
  uri: string
}

const DataTableColumnHeader = ({ column, title }: { column: any; title: string }) => {
  if (!column.getCanSort()) {
    return <div className="text-xs font-bold text-muted-foreground">{title}</div>
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-bold text-xs text-muted-foreground">{title}</span>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none shadow-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}


export const columns: ColumnDef<TrackItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="px-1 py-2">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="px-1">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="名稱" />,
    cell: ({ row }) => <div className="font-medium text-primary truncate max-w-[150px]" title={row.getValue("name")}>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "artists",
    header: ({ column }) => <DataTableColumnHeader column={column} title="藝人" />,
    cell: ({ row }) => (
      <div className="truncate max-w-[150px]" title={row.getValue("artists")}>
        {row.getValue("artists")}
      </div>
    ),
  },
  {
    accessorKey: "album",
    header: ({ column }) => <DataTableColumnHeader column={column} title="專輯" />,
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("album")}>{row.getValue("album")}</div>
  },
  {
    accessorKey: "id",
    header: () => <div className="font-bold text-center text-xs text-muted-foreground mr-1">ID</div>,
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
    const endpoint = playlist.id === "liked" ? `/spotify/liked` : `/spotify/playlist/${playlist.id}/tracks`
    fetchWithAuth(endpoint)
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
      endpoint = `/spotify/liked/add`
      payload = { ids: selectedRows.map(r => r.original.id) }
    } else {
      endpoint = `/spotify/playlist/${targetPlaylist.id}/add`
      payload = { uris: selectedRows.map(r => r.original.uri) }
    }

    fetchWithAuth(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(() => {
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
      endpoint = `/spotify/liked/remove`
      keysToRemove = selectedRows.map(r => r.original.id)
      payload = { ids: keysToRemove }
    } else {
      endpoint = `/spotify/playlist/${playlist.id}/remove`
      keysToRemove = selectedRows.map(r => r.original.uri)
      payload = { uris: keysToRemove }
    }

    fetchWithAuth(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(() => {
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
    initialState: { pagination: { pageSize: 15 } }
  })

  const records = table.getRowModel().rows

  return (
    <Card
      onClick={onClick}
      className={`flex-1 overflow-hidden shadow-sm h-full flex flex-col transition-all cursor-default ${isActive ? "border-primary border-2 shadow-[0_0_15px_rgba(29,185,84,0.1)] bg-card" : "border-border bg-muted/20 opacity-80"} `}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 flex-none border-b bg-muted/10">
        <CardTitle className={`text-base flex items-center ${isActive ? "text-primary font-black" : "text-muted-foreground font-bold"}`}>
          {isActive ? "🔵 選中：" : "⚪ 待選："}
          {playlist ? playlist.name : "請於上方點選清單"}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="h-7 text-xs shadow-sm hover:shadow" onClick={loadTracks} disabled={!playlist || isLoading}>
            🔄 重整
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 overflow-hidden pt-3 px-3 gap-3">

        {/* === 操作按鈕 (Transfer & Delete) === */}
        <div className={`flex-none flex w-full items-center gap-2 h-[45px] p-2 rounded-md border ${isActive ? "bg-primary/5 shadow-inner border-primary/20" : "bg-transparent"}`}>
          <Button
            size="sm"
            className="flex-1 transition-all font-medium"
            disabled={!targetPlaylist || Object.keys(rowSelection).length === 0}
            onClick={handleTransfer}
          >
            {side === "left" ? "→ 新增至右側" : "← 新增至左側"}
            {targetPlaylist && ` [${targetPlaylist.name.slice(0, 9)}...]`}
          </Button>

          <Button variant="destructive" size="sm" className="min-w-[80px]" disabled={Object.keys(rowSelection).length === 0} onClick={handleDelete}>
            🗑️ 刪除
          </Button>
        </div>

        <div className="flex-1 rounded-md border overflow-y-auto relative min-h-0 bg-background/50 shadow-sm">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-md">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const widthClass = header.id === "select" ? "w-[40px]" : header.id === "id" ? "w-[60px]" : "w-[30%]"
                    return (
                      <TableHead key={header.id} className={`align-middle h-9 px-2 ${widthClass}`}>
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
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="h-12 border-b/50">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-1 px-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                    {playlist ? (isLoading ? "讀取片段中..." : "沒有找到符合的歌曲。") : "請先點擊此外框以啟用面板，再於上方點選清單..."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex-none flex items-center justify-between px-1 py-1 mt-auto">
          <div className="flex-1 text-[13px] font-medium text-muted-foreground">
            已選 {Object.keys(rowSelection).length} / {table.getFilteredRowModel().rows.length} 筆
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-[13px] font-medium hidden lg:block text-muted-foreground">每頁列數</p>
              <select
                className="h-8 w-[65px] rounded-md border border-input bg-transparent px-2 py-1 text-[13px] shadow-sm hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value))
                }}
              >
                {[10, 15, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize} className="bg-background text-foreground">
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[80px] items-center justify-center text-[13px] font-medium text-muted-foreground">
              第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1} 頁
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">回到第一頁</span>
                <ChevronsLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">上一頁</span>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">下一頁</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">前往最後一頁</span>
                <ChevronsRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
