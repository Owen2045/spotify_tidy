"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Header,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  GripVertical,
} from "lucide-react"
import { Header as PageHeader } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { fetchWithAuth, getToken, removeToken } from "@/lib/auth"

type Track = {
  id: string
  name: string
  artist_names: string[]
  album_name: string | null
  release_date: string | null
  duration_ms: number | null
  explicit: boolean
  added_at: string | null
  description: string | null
}

const COLUMN_LABELS: Record<string, string> = {
  name: "歌名",
  artist_names: "歌手",
  album_name: "專輯",
  release_date: "發行日期",
  duration_ms: "時長",
  explicit: "限制級",
  added_at: "加入時間",
  description: "描述",
}

const INITIAL_COLUMN_ORDER = ["name", "artist_names", "album_name", "release_date", "duration_ms", "explicit", "added_at", "description"]

function fmtDuration(ms: number | null) {
  if (!ms) return "-"
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")
  return `${m}:${s}`
}

function fmtDate(s: string | null) {
  if (!s) return "-"
  return s.slice(0, 10)
}

const SortHeader = ({ column, title }: { column: any; title: string }) => (
  <div className="flex items-center gap-1">
    <span className="font-bold text-xs text-muted-foreground">{title}</span>
    {column.getCanSort() && (
      <button
        className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {column.getIsSorted() === "desc" ? <ArrowDown className="h-3 w-3" /> :
          column.getIsSorted() === "asc" ? <ArrowUp className="h-3 w-3" /> :
          <ArrowUpDown className="h-3 w-3" />}
      </button>
    )}
  </div>
)

function DraggableHeader({ header }: { header: Header<Track, unknown> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <th
      ref={setNodeRef}
      style={style}
      className="h-9 px-3 text-left align-middle border-b bg-muted/80 sticky top-0 z-10 whitespace-nowrap"
    >
      <div className="flex items-center gap-1">
        <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground">
          <GripVertical className="h-3 w-3" />
        </span>
        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
      </div>
    </th>
  )
}

const columns: ColumnDef<Track>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader column={column} title="歌名" />,
    cell: ({ row }) => <div className="font-medium truncate max-w-[180px]" title={row.getValue("name")}>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "artist_names",
    header: ({ column }) => <SortHeader column={column} title="歌手" />,
    cell: ({ row }) => {
      const v = row.getValue("artist_names") as string[]
      const s = Array.isArray(v) ? v.join(", ") : String(v)
      return <div className="truncate max-w-[150px]" title={s}>{s}</div>
    },
  },
  {
    accessorKey: "album_name",
    header: ({ column }) => <SortHeader column={column} title="專輯" />,
    cell: ({ row }) => <div className="truncate max-w-[150px]" title={row.getValue("album_name") ?? ""}>{row.getValue("album_name") ?? "-"}</div>,
  },
  {
    accessorKey: "release_date",
    header: ({ column }) => <SortHeader column={column} title="發行日期" />,
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{fmtDate(row.getValue("release_date"))}</div>,
  },
  {
    accessorKey: "duration_ms",
    header: ({ column }) => <SortHeader column={column} title="時長" />,
    cell: ({ row }) => <div className="text-sm text-muted-foreground font-mono">{fmtDuration(row.getValue("duration_ms"))}</div>,
  },
  {
    accessorKey: "explicit",
    header: ({ column }) => <SortHeader column={column} title="限制級" />,
    cell: ({ row }) => row.getValue("explicit") ? <span className="text-xs bg-red-500/20 text-red-500 px-1 rounded">E</span> : <span className="text-muted-foreground/40">-</span>,
  },
  {
    accessorKey: "added_at",
    header: ({ column }) => <SortHeader column={column} title="加入時間" />,
    cell: ({ row }) => <div className="text-sm text-muted-foreground">{fmtDate(row.getValue("added_at"))}</div>,
  },
  {
    accessorKey: "description",
    header: ({ column }) => <SortHeader column={column} title="描述" />,
    cell: ({ row }) => <div className="truncate max-w-[200px] text-sm text-muted-foreground" title={row.getValue("description") ?? ""}>{row.getValue("description") ?? "-"}</div>,
  },
]

export default function StudioPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [data, setData] = useState<Track[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ description: false })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(INITIAL_COLUMN_ORDER)
  const [showColPicker, setShowColPicker] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return }
    fetchWithAuth("/auth/me")
      .then(res => { if (res.status === 401) { removeToken(); router.push("/login"); return null } return res.json() })
      .then(d => { if (d) setEmail(d.email) })
      .catch(() => {})
    loadTracks()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadTracks = () => {
    setIsLoading(true)
    fetchWithAuth("/nlp/tracks")
      .then(res => res.json())
      .then(d => { setData(d.items); setTotal(d.total) })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder(prev => arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)))
    }
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    state: { sorting, columnVisibility, columnOrder, globalFilter: search },
    initialState: { pagination: { pageSize: 20 } },
  })

  const handleLogout = () => { removeToken(); router.push("/login") }

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col h-screen overflow-hidden">
      <div className="flex-none">
        <PageHeader username={email} onLogout={handleLogout} />
        <hr className="my-3 border-border" />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden gap-3">
        {/* Toolbar */}
        <div className="flex-none flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Studio</h2>
            <span className="text-sm text-muted-foreground">{isLoading ? "載入中..." : `${total} 首`}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜尋歌名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 px-3 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-48"
            />
            {/* 欄位控制 */}
            <div ref={colPickerRef} className="relative">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowColPicker(v => !v)}>
                欄位
              </Button>
              {showColPicker && (
                <div className="absolute right-0 top-9 z-30 bg-background border border-border rounded-md shadow-lg p-2 min-w-[130px]">
                  {table.getAllLeafColumns().map(col => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted rounded text-sm select-none">
                      <input type="checkbox" className="accent-primary" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
                      {COLUMN_LABELS[col.id] ?? col.id}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={loadTracks} disabled={isLoading}>
              🔄 重整
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 rounded-md border overflow-auto min-h-0 bg-background shadow-sm">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <SortableContext key={hg.id} items={columnOrder} strategy={horizontalListSortingStrategy}>
                    <tr>
                      {hg.headers.map(header => <DraggableHeader key={header.id} header={header} />)}
                    </tr>
                  </SortableContext>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-3 py-2 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      {isLoading ? "載入中..." : "沒有資料"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* 分頁 */}
        <div className="flex-none flex items-center justify-between px-1 py-1">
          <div className="text-sm text-muted-foreground">
            共 {table.getFilteredRowModel().rows.length} 筆
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              每頁
              <select
                className="h-7 w-[60px] rounded border border-input bg-transparent px-1 text-sm focus:outline-none"
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
              >
                {[20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1} 頁
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="h-7 w-7 p-0" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}><ChevronsLeft className="h-4 w-4" /></Button>
              <Button variant="outline" className="h-7 w-7 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" className="h-7 w-7 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" className="h-7 w-7 p-0" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}><ChevronsRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
