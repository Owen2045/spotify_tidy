"use client"
import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, Play, Monitor, Smartphone, Speaker } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { fetchWithAuth, getToken, removeToken } from "@/lib/auth"

type SearchTrack = {
  id: string
  name: string
  artist_names: string[]
  album_name: string | null
  release_date: string | null
  description: string | null
}

type Device = {
  id: string
  name: string
  type: string
  is_active: boolean
}

function DeviceIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case "computer": return <Monitor className="h-3.5 w-3.5 flex-none" />
    case "smartphone": return <Smartphone className="h-3.5 w-3.5 flex-none" />
    default: return <Speaker className="h-3.5 w-3.5 flex-none" />
  }
}

export default function SearchPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [showDevicePicker, setShowDevicePicker] = useState(false)
  const [playError, setPlayError] = useState("")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlayingAll, setIsPlayingAll] = useState(false)
  const pendingUrisRef = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return }
    fetchWithAuth("/auth/me")
      .then(res => { if (res.status === 401) { removeToken(); router.push("/login"); return null } return res.json() })
      .then(d => { if (d) setEmail(d.email) })
      .catch(() => {})
    inputRef.current?.focus()
  }, [])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q || isSearching) return
    setIsSearching(true)
    setSearched(false)
    setShowDevicePicker(false)
    setPlayError("")
    try {
      const res = await fetchWithAuth(`/nlp/search?q=${encodeURIComponent(q)}&limit=20`)
      const d = await res.json()
      setResults(d.items ?? [])
      setSearched(true)
    } catch {
      setResults([])
      setSearched(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  const handleLogout = () => { removeToken(); router.push("/login") }

  const playUris = async (uris: string[], deviceId: string) => {
    await fetchWithAuth("/spotify/player/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris, device_id: deviceId }),
    })
    setShowDevicePicker(false)
    setPlayError("")
  }

  const startPlay = async (uris: string[]) => {
    setPlayError("")
    try {
      const res = await fetchWithAuth("/spotify/player/devices")
      const devs: Device[] = await res.json()
      if (!Array.isArray(devs) || devs.length === 0) {
        setPlayError("找不到播放裝置，請先開啟 Spotify")
        return
      }
      const active = devs.find(d => d.is_active)
      if (active || devs.length === 1) {
        await playUris(uris, (active ?? devs[0]).id)
      } else {
        pendingUrisRef.current = uris
        setDevices(devs)
        setShowDevicePicker(true)
      }
    } catch {
      setPlayError("播放失敗，請稍後再試")
    }
  }

  const handlePlayAll = async () => {
    if (results.length === 0 || isPlayingAll) return
    setIsPlayingAll(true)
    try {
      await startPlay(results.map(t => `spotify:track:${t.id}`))
    } finally {
      setIsPlayingAll(false)
    }
  }

  const handlePlayOne = async (track: SearchTrack) => {
    if (playingId) return
    setPlayingId(track.id)
    try {
      await startPlay([`spotify:track:${track.id}`])
    } finally {
      setPlayingId(null)
    }
  }

  const handleDeviceSelect = async (deviceId: string) => {
    try {
      await playUris(pendingUrisRef.current, deviceId)
    } catch {
      setPlayError("播放失敗，請稍後再試")
    } finally {
      pendingUrisRef.current = []
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col">
      <div className="flex-none">
        <Header username={email} onLogout={handleLogout} />
        <hr className="my-3 border-border" />
      </div>

      <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pt-8">
        <div>
          <h2 className="text-base font-semibold mb-1">語意搜尋</h2>
          <p className="text-sm text-muted-foreground">描述你想聽的氛圍或情境，找出最符合的歌曲</p>
        </div>

        {/* 搜尋框 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="例：輕鬆午後咖啡廳、深夜獨自開車、雨天想家..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button onClick={handleSearch} disabled={!query.trim() || isSearching} className="h-10 px-5">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜尋"}
          </Button>
        </div>

        {/* 搜尋中 */}
        {isSearching && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            向量搜尋中...
          </div>
        )}

        {/* 無結果 */}
        {!isSearching && searched && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">找不到符合的歌曲</div>
        )}

        {/* 結果 */}
        {!isSearching && results.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* 結果標頭 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">找到 {results.length} 首相關歌曲</p>
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePlayAll}
                  disabled={isPlayingAll}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  {isPlayingAll
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Play className="h-3 w-3 fill-current" />
                  }
                  播放全部
                </Button>

                {/* 裝置選擇器 */}
                {showDevicePicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDevicePicker(false)} />
                    <div className="absolute right-0 top-9 z-20 min-w-52 bg-popover border border-border rounded-md shadow-md py-1">
                      <p className="text-xs text-muted-foreground px-3 py-1.5">選擇播放裝置</p>
                      {devices.map(d => (
                        <button
                          key={d.id}
                          onClick={() => handleDeviceSelect(d.id)}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          <DeviceIcon type={d.type} />
                          <span className="truncate">{d.name}</span>
                          {d.is_active && <span className="ml-auto text-xs text-green-500 flex-none">●</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 播放錯誤提示 */}
            {playError && (
              <p className="text-xs text-destructive">{playError}</p>
            )}

            {/* 歌曲列表 */}
            {results.map((track, i) => (
              <div
                key={track.id}
                className="group border border-border rounded-lg p-4 flex gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="w-6 flex-none flex items-start justify-end pt-0.5 relative">
                  <span className="text-xl font-mono text-muted-foreground/30 group-hover:hidden">{i + 1}</span>
                  <button
                    className="hidden group-hover:flex items-center justify-center w-full h-full absolute inset-0"
                    onClick={() => handlePlayOne(track)}
                    disabled={!!playingId}
                    title="播放此曲"
                  >
                    {playingId === track.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      : <Play className="h-3.5 w-3.5 fill-current" />
                    }
                  </button>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="font-medium truncate" title={track.name}>{track.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {track.artist_names?.join(", ")}
                    {track.album_name && <span className="text-muted-foreground/60"> · {track.album_name}</span>}
                  </div>
                  {track.description && (
                    <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed line-clamp-2">{track.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
