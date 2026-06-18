"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { fetchWithAuth, getToken, removeToken } from "@/lib/auth"

export default function Lobby() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [spotifyDisplayName, setSpotifyDisplayName] = useState("")

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
        if (res.status === 403) { setSpotifyConnected(false); return null }
        setSpotifyConnected(true)
        return res.json()
      })
      .then(data => { if (data?.display_name) setSpotifyDisplayName(data.display_name) })
      .catch(() => {})
  }, [])

  const handleLogout = () => { removeToken(); router.push("/login") }

  const handleConnectSpotify = async () => {
    try {
      const res = await fetchWithAuth("/auth/spotify/connect")
      const data = await res.json()
      window.location.href = data.auth_url
    } catch {
      alert("無法連接後端 API")
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col">
      <div className="flex-none">
        <Header username={email} onLogout={handleLogout} />
        <hr className="my-3 border-border" />
      </div>

      <div className="flex-1 p-4">
        <h2 className="text-lg font-semibold mb-6">服務</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${spotifyConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
              <span className="font-medium">Spotify Tidy</span>
            </div>
            {spotifyConnected && spotifyDisplayName && (
              <p className="text-sm text-muted-foreground">{spotifyDisplayName}</p>
            )}
            {spotifyConnected ? (
              <Button onClick={() => router.push("/services/spotify")}>進入</Button>
            ) : (
              <Button onClick={handleConnectSpotify}>連結 Spotify</Button>
            )}
          </div>

          <div className="border border-border rounded-lg p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="font-medium">Studio</span>
            </div>
            <p className="text-sm text-muted-foreground">後台資料管理</p>
            <Button variant="outline" onClick={() => router.push("/services/studio")}>進入</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
