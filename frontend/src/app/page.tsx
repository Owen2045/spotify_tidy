"use client"
import { useEffect, useState } from "react"
import Split from "react-split"
import { Header } from "@/components/layout/Header"
import { PlaylistsSidebar } from "@/components/dashboard/PlaylistsSidebar"
import { PlaylistPanel } from "@/components/dashboard/PlaylistPanel"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export type Playlist = {
  id: string
  name: string
}

export const LIKED_PLAYLIST: Playlist = {
  id: "liked",
  name: "⭐ 我的歌單"
}

export default function Dashboard() {
  const [user, setUser] = useState<{ display_name?: string } | null>(null)

  const [playlists, setPlaylists] = useState<Playlist[]>([])

  // 雙開管理員共用狀態
  const [leftPlaylist, setLeftPlaylist] = useState<Playlist | null>(null)
  const [rightPlaylist, setRightPlaylist] = useState<Playlist | null>(null)
  const [activePanel, setActivePanel] = useState<"left" | "right">("left")

  useEffect(() => {
    fetch(`${API_BASE}/api/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
  }, [])

  const fetchPlaylists = () => {
    if (!user) return
    fetch(`${API_BASE}/api/playlists`)
      .then(res => res.json())
      .then(data => setPlaylists(data))
      .catch(console.error)
  }

  useEffect(() => {
    if (user) {
      fetchPlaylists()
    }
  }, [user])

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/login`)
      const data = await res.json()
      window.location.href = data.auth_url
    } catch (err) {
      console.error(err)
      alert("無法連接後端 API")
    }
  }

  const handleSelectPlaylist = (p: Playlist) => {
    if (activePanel === "left") setLeftPlaylist(p)
    else setRightPlaylist(p)
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col h-screen overflow-hidden">
      <div className="flex-none">
        <Header user={user} onLogin={handleLogin} onRefresh={fetchPlaylists} />
        <hr className="my-3 border-border" />
      </div>

      <div className="mb-3 flex-none">
        <PlaylistsSidebar
          playlists={[LIKED_PLAYLIST, ...playlists]}
          leftPlaylist={leftPlaylist}
          rightPlaylist={rightPlaylist}
          activePanel={activePanel}
          onSelect={handleSelectPlaylist}
        />
      </div>

      {/* 雙開對稱式通用轉移儀表版 */}
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
    </div>
  )
}
