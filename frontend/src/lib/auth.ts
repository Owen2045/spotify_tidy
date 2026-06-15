export const getToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("jwt")
}

export const setToken = (token: string): void => {
  localStorage.setItem("jwt", token)
}

export const removeToken = (): void => {
  localStorage.removeItem("jwt")
}

export const fetchWithAuth = (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}
