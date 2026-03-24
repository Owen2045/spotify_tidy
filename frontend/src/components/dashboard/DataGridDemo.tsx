import { useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type Track = {
  id: string
  title: string
  artist: string
  album: string
  streams: number
}

const mockData: Track[] = [
  { id: "1", title: "Yellow", artist: "Coldplay", album: "Parachutes", streams: 1542000000 },
  { id: "2", title: "Shape of You", artist: "Ed Sheeran", album: "Divide", streams: 3670000000 },
  { id: "3", title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", streams: 4200000000 },
  { id: "4", title: "Watermelon Sugar", artist: "Harry Styles", album: "Fine Line", streams: 2500000000 },
  { id: "5", title: "As It Was", artist: "Harry Styles", album: "Harry's House", streams: 1800000000 },
  { id: "6", title: "Levitating", artist: "Dua Lipa", album: "Future Nostalgia", streams: 2300000000 },
  { id: "7", title: "Someone You Loved", artist: "Lewis Capaldi", album: "Divinely Uninspired", streams: 3100000000 },
  { id: "8", title: "Bad Guy", artist: "Billie Eilish", album: "When We All Fall Asleep", streams: 2450000000 },
  { id: "9", title: "Señorita", artist: "Shawn Mendes", album: "Shawn Mendes", streams: 2600000000 },
  { id: "10", title: "Perfect", artist: "Ed Sheeran", album: "Divide", streams: 2700000000 },
]

export const columns: ColumnDef<Track>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-full justify-start px-0 font-bold"
          >
            歌曲名稱
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input
            placeholder="過濾歌曲..."
            value={(column.getFilterValue() as string) ?? ""}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className="h-8 shadow-none"
          />
        </div>
      )
    },
    cell: ({ row }) => <div className="font-medium text-primary">{row.getValue("title")}</div>,
  },
  {
    accessorKey: "artist",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-full justify-start px-0 font-bold"
          >
            歌手藝人
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input
            placeholder="過濾歌手..."
            value={(column.getFilterValue() as string) ?? ""}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className="h-8 shadow-none"
          />
        </div>
      )
    },
  },
  {
    accessorKey: "album",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-full justify-start px-0 font-bold"
          >
            所屬專輯
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input
            placeholder="過濾專輯..."
            value={(column.getFilterValue() as string) ?? ""}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className="h-8 shadow-none"
          />
        </div>
      )
    },
  },
  {
    accessorKey: "streams",
    header: ({ column }) => {
      return (
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="w-full justify-start px-0 font-bold"
          >
            播放次數
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Input
            placeholder="過濾次數..."
            value={(column.getFilterValue() as string) ?? ""}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className="h-8 shadow-none"
          />
        </div>
      )
    },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("streams"))
      const formatted = new Intl.NumberFormat("en-US").format(amount)
      return <div className="font-mono text-muted-foreground">{formatted}</div>
    },
  },
]

export function DataGridDemo() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        // 設定每頁 5 筆，加上高度補償機制，防止跨頁高度跳動
        pageSize: 5
      }
    }
  })

  // 取得當前真實顯示的資料與可視空位
  const records = table.getRowModel().rows
  const pageSize = table.getState().pagination.pageSize
  // 計算出缺少的幾列數量，稍後用隱形行填補，達成固定高度
  const emptyRows = records.length > 0 ? Math.max(0, pageSize - records.length) : pageSize - 1

  return (
    <Card className="mb-4 shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">資料分析網格 (Shadcn + TanStack Table 展示)</CardTitle>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            table.resetColumnFilters()
            table.resetSorting()
          }}
        >
          清除所有條件
        </Button>
      </CardHeader>
      <CardContent>
        {/* 加上 table-fixed 以免遇到長字串時表格寬度亂跳 */}
        <div className="rounded-md border overflow-hidden">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="align-top pb-3 px-4 w-1/4">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {records.length ? (
                records.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="h-14">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2 px-4 truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-14">
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    找不到符合的資料...
                  </TableCell>
                </TableRow>
              )}
              {/* 這裡就是解決垂直高度跳動的關鍵：輸出隱形的空行來填補表格高度 */}
              {emptyRows > 0 && Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="h-14 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="border-0" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 pt-4">
          <div className="flex-1 text-sm text-muted-foreground font-mono">
            總計篩選出 {table.getFilteredRowModel().rows.length} 筆項目。
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            上一頁
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            下一頁
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
