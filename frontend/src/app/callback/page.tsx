"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { fetchWithAuth, getToken } from "@/lib/auth"

type Status = "loading" | "error" | "success"

export default function CallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const state = params.get("state")
    const err = params.get("error")

    if (err) {
      setErrorMsg(`Spotify 授權失敗：${err}`)
      setStatus("error")
      return
    }

    if (!code || !state || !getToken()) {
      router.push("/login")
      return
    }

    fetchWithAuth("/auth/spotify/exchange", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    })
      .then(res => {
        if (!res.ok) throw new Error()
        setStatus("success")
        router.push("/")
      })
      .catch(() => {
        setErrorMsg("Spotify 連結失敗，請重試")
        setStatus("error")
      })
  }, [])

  if (status === "error") return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <div className="text-center space-y-3">
        <h2 className="text-xl font-bold text-destructive">❌ {errorMsg}</h2>
        <a href="/" className="block text-primary underline">返回首頁</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">
          {status === "success" ? "✅ 連結成功！跳轉中..." : "正在連結 Spotify..."}
        </h2>
      </div>
    </div>
  )
}
