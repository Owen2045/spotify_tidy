"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  username: string
  onLogout: () => void
  children?: React.ReactNode
}

export function Header({ username, onLogout, children }: HeaderProps) {
  const router = useRouter()
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3
        className="text-2xl font-bold tracking-tight cursor-pointer hover:opacity-70 transition-opacity"
        onClick={() => router.push("/")}
      >
        CEREMONY
      </h3>
      <div className="flex items-center gap-4">
        {children}
        <span className="text-sm text-muted-foreground">{username}</span>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          登出
        </Button>
      </div>
    </div>
  )
}
