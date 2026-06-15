"use client"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  user: { display_name?: string } | null
  spotifyConnected: boolean
  onConnectSpotify: () => void
  onDisconnectSpotify: () => void
  onLogout: () => void
  onRefresh: () => void
}

export function Header({ user, spotifyConnected, onConnectSpotify, onDisconnectSpotify, onLogout, onRefresh }: HeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-2xl font-bold tracking-tight">Spotify 歌單整理</h3>
      <div className="flex items-center gap-4">
        {!spotifyConnected ? (
          <Button onClick={onConnectSpotify} variant="default">
            連結 Spotify
          </Button>
        ) : (
          <>
            <span className="text-sm font-medium">
              歡迎回到控制台, {user?.display_name}
            </span>
            <Button variant="outline" size="sm" onClick={onDisconnectSpotify}>
              斷開 Spotify
            </Button>
          </>
        )}
        <Button variant="outline" onClick={onRefresh} disabled={!spotifyConnected}>
          自 Spotify 更新播放清單
        </Button>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          登出
        </Button>
      </div>
    </div>
  )
}
