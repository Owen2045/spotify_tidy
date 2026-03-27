"use client"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  user: { display_name?: string } | null;
  onLogin: () => void;
  onRefresh: () => void;
}

export function Header({ user, onLogin, onRefresh }: HeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-2xl font-bold tracking-tight">Spotify 歌單整理</h3>
      <div className="flex items-center gap-4">
        {!user ? (
          <Button onClick={onLogin} variant="default">
            登入 Spotify
          </Button>
        ) : (
          <span className="text-sm font-medium">歡迎回到控制台, {user.display_name}</span>
        )}
        <Button variant="outline" onClick={onRefresh} disabled={!user}>自 Spotify 更新播放清單</Button>
      </div>
    </div>
  )
}
