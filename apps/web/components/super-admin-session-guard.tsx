"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { SessionLoadingScreen } from "@/components/session-loading-screen"
import { ensureSession } from "@/lib/auth/session"
import { useAuthStore } from "@/lib/auth/store"

export function SuperAdminSessionGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [checked, setChecked] = useState(false)
  const isAuthorized = Boolean(accessToken && user?.is_super_admin)

  useEffect(() => {
    let active = true

    async function validate() {
      if (accessToken && user) {
        if (!user.is_super_admin) {
          router.replace("/dashboard")
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

      const currentUser = useAuthStore.getState().user

      if (token && currentUser?.is_super_admin) {
        setChecked(true)
        return
      }

      if (token && currentUser && !currentUser.is_super_admin) {
        router.replace("/dashboard")
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
