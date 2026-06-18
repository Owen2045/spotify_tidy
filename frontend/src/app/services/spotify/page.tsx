"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Split from "react-split"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { PlaylistsSidebar } from "@/components/dashboard/PlaylistsSidebar"
import { PlaylistPanel } from "@/components/dashboard/PlaylistPanel"
import { fetchWithAuth, getToken, removeToken } from "@/lib/auth"

export type Playlist = {
  id: string
  name: string
}

export const LIKED_PLAYLIST: Playlist = {
  id: "liked",
  name: "⭐ 我的歌單"
}

export default function SpotifyDashboard() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [user, setUser] = useState<{ display_name?: string } | null>(null)
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [leftPlaylist, setLeftPlaylist] = useState<Playlist | null>(null)
  const [rightPlaylist, setRightPlaylist] = useState<Playlist | null>(null)
  const [activePanel, setActivePanel] = useState<"left" | "right">("left")

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return }

    fetchWithAuth("/auth/me")
      .then(res => {
        if (res.status === 401) { removeToken(); router.push("/login"); return null }
        return res.json()
      })
      .then(data => { if (data) setEmail(data.email) })
      .catch(() => {})

    fetchWithAuth("/spotify/me")
      .then(res => {
        if (res.status === 401) { removeToken(); router.push("/login"); return null }
        if (res.status === 403) { setSpotifyConnected(false); return null }
        setSpotifyConnected(true)
        return res.json()
      })
      .then(data => { if (data) setUser(data) })
      .catch(() => setUser(null))
  }, [])

  const fetchPlaylists = () => {
    fetchWithAuth("/spotify/playlists")
      .then(res => res.json())
      .then(data => setPlaylists(data))
      .catch(console.error)
  }

  useEffect(() => {
    if (spotifyConnected) fetchPlaylists()
  }, [spotifyConnected])

  const handleConnectSpotify = async () => {
    try {
      const res = await fetchWithAuth("/auth/spotify/connect")
      const data = await res.json()
      window.location.href = data.auth_url
    } catch {
      alert("無法連接後端 API")
    }
  }

  const handleDisconnectSpotify = async () => {
    await fetchWithAuth("/auth/spotify/disconnect", { method: "DELETE" })
    setSpotifyConnected(false)
    setUser(null)
    setPlaylists([])
    setLeftPlaylist(null)
    setRightPlaylist(null)
  }

  const handleLogout = () => { removeToken(); router.push("/login") }

  const handleSelectPlaylist = (p: Playlist) => {
    if (activePanel === "left") setLeftPlaylist(p)
    else setRightPlaylist(p)
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col h-screen overflow-hidden">
      <div className="flex-none">
        <Header username={email} onLogout={handleLogout}>
          {!spotifyConnected ? (
            <Button onClick={handleConnectSpotify} variant="default">
              連結 Spotify
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium">{user?.display_name}</span>
              <Button variant="outline" size="sm" onClick={handleDisconnectSpotify}>
                斷開 Spotify
              </Button>
            </>
          )}
          <Button variant="outline" onClick={fetchPlaylists} disabled={!spotifyConnected}>
            自 Spotify 更新播放清單
          </Button>
        </Header>
        <hr className="my-3 border-border" />
      </div>

      {!spotifyConnected ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          請先連結 Spotify 帳號
        </div>
      ) : (
        <>
          <div className="mb-3 flex-none">
            <PlaylistsSidebar
              playlists={[LIKED_PLAYLIST, ...playlists]}
              leftPlaylist={leftPlaylist}
              rightPlaylist={rightPlaylist}
              activePanel={activePanel}
              onSelect={handleSelectPlaylist}
            />
          </div>
          <Split
            sizes={[50, 50]}
            minSize={300}
            expandToMin={false}
            gutterSize={8}
            gutterAlign="center"
            snapOffset={30}
            dragInterval={1}
            direction="horizontal"
            cursor="col-resize"
            className="flex flex-1 gap-4 overflow-hidden"
          >
            <div className="flex h-full flex-col overflow-hidden rounded-md">
              <PlaylistPanel
                side="left"
                isActive={activePanel === "left"}
                playlist={leftPlaylist}
                targetPlaylist={rightPlaylist}
                onClick={() => setActivePanel("left")}
              />
            </div>
            <div className="flex h-full flex-col overflow-hidden rounded-md">
              <PlaylistPanel
                side="right"
                isActive={activePanel === "right"}
                playlist={rightPlaylist}
                targetPlaylist={leftPlaylist}
                onClick={() => setActivePanel("right")}
              />
            </div>
          </Split>
        </>
      )}
    </div>
  )
}
