"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { SessionLoadingScreen } from "@/components/session-loading-screen"
import { ensureSession } from "@/lib/auth/session"
import { useAuthStore } from "@/lib/auth/store"

export function AuthSessionGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [checked, setChecked] = useState(false)
  const isAuthorized = Boolean(accessToken && user && !user.is_super_admin)

  useEffect(() => {
    let active = true

    async function validate() {
      if (accessToken && user) {
        if (user.is_super_admin) {
          router.replace("/platform")
          return
        }

        if (active) {
          setChecked(true)
        }
        return
      }

      const token = await ensureSession()

      if (!active) {
        return
      }

      if (token && useAuthStore.getState().user) {
        if (useAuthStore.getState().user?.is_super_admin) {
          router.replace("/platform")
          return
        }

        setChecked(true)
        return
      }

      router.replace("/auth/login")
    }

    void validate()

    return () => {
      active = false
    }
  }, [accessToken, router, user])

  if (!checked || !isAuthorized) {
    return <SessionLoadingScreen />
  }

  return <>{children}</>
}
