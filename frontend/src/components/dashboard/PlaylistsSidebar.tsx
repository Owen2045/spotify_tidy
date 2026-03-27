"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Playlist } from "@/app/page"

interface Props {
  playlists: Playlist[];
  leftPlaylist: Playlist | null;
  rightPlaylist: Playlist | null;
  activePanel: "left" | "right";
  onSelect: (p: Playlist) => void;
}

export function PlaylistsSidebar({ playlists, leftPlaylist, rightPlaylist, activePanel, onSelect }: Props) {
  return (
    <Card className="flex-1 shadow-sm w-full border-border bg-card">
      <CardHeader className="py-2 px-4 flex-none border-b mb-2 bg-muted/10">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="text-secondary-foreground font-bold">
            選擇清單 (寫入對象：{activePanel === "left" ? "🟢 左側面板" : "🟢 右側面板"})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[140px] overflow-y-auto px-4 pb-3">
        <div className="flex flex-wrap gap-2">
          {playlists.length === 1 ? (
            <span className="text-sm text-muted-foreground font-medium pl-1">
              尚未收到 Spotify 歌單資料，請確認登入狀態並點擊右上角重新載入。
            </span>
          ) : (
            playlists.map((p) => {
              const isLeft = leftPlaylist?.id === p.id;
              const isRight = rightPlaylist?.id === p.id;
              let variant: "default" | "secondary" | "outline" | "ghost" = "outline";
              let ring = "";

              if (isLeft && isRight) { variant = "default"; }
              else if (isLeft) { variant = "default"; }
              else if (isRight) { variant = "secondary"; }
              else { variant = "outline"; }

              if (p.id === "liked") {
                ring = "border-primary/50 font-bold shadow-sm";
                // 若被選中 (variant === "default") 會自帶白字，因此我們不硬塞 text-primary 蓋掉它
                if (variant !== "default") {
                  ring += " text-primary";
                }
              }

              return (
                <Button
                  key={p.id}
                  variant={variant}
                  size="sm"
                  onClick={() => onSelect(p)}
                  className={`justify-start truncate max-w-[250px] ${ring}`}
                >
                  {isLeft && "←左: "}{isRight && "右→: "}{p.name}
                </Button>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
