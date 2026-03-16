"use client"

import { create } from "zustand"

import {
  ACTIVE_COMPANY_FAVICON_COOKIE_NAME,
  ACTIVE_COMPANY_ID_COOKIE_NAME,
  ACTIVE_COMPANY_NAME_COOKIE_NAME,
  normalizeCompanyAssetPath,
} from "@/lib/auth/company-assets"
import type { AuthCompany, AuthUser } from "@/lib/auth/types"

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  companies: AuthCompany[]
  activeCompanyId: string | null
  isRefreshing: boolean
  setSession: (session: {
    accessToken: string
    user: AuthUser
    companies: AuthCompany[]
  }) => void
  setUser: (user: AuthUser) => void
  setActiveCompany: (companyId: string) => void
  setRefreshing: (value: boolean) => void
  clearSession: () => void
}

const COMPANY_PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null
  }

  const cookieEntry = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))

  return cookieEntry ? decodeURIComponent(cookieEntry.split("=").slice(1).join("=")) : null
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COMPANY_PREFERENCE_COOKIE_MAX_AGE}; SameSite=Lax`
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function syncActiveCompanyCookies(companies: AuthCompany[], activeCompanyId: string | null) {
  const activeCompany =
    companies.find((company) => company.id === activeCompanyId) ?? null

  if (!activeCompany) {
    deleteCookie(ACTIVE_COMPANY_ID_COOKIE_NAME)
    deleteCookie(ACTIVE_COMPANY_NAME_COOKIE_NAME)
    deleteCookie(ACTIVE_COMPANY_FAVICON_COOKIE_NAME)
    return
  }

  writeCookie(ACTIVE_COMPANY_ID_COOKIE_NAME, activeCompany.id)
  writeCookie(ACTIVE_COMPANY_NAME_COOKIE_NAME, activeCompany.name)
  writeCookie(
    ACTIVE_COMPANY_FAVICON_COOKIE_NAME,
    normalizeCompanyAssetPath(activeCompany.favicon_path)
  )
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  companies: [],
  activeCompanyId: null,
  isRefreshing: false,
  setSession: ({ accessToken, user, companies }) =>
    set((state) => {
      const storedCompanyId = readCookie(ACTIVE_COMPANY_ID_COOKIE_NAME)
      const preservedCompanyId = companies.some(
        (company) => company.id === state.activeCompanyId
      )
        ? state.activeCompanyId
        : companies.some((company) => company.id === storedCompanyId)
          ? storedCompanyId
        : null

      const activeCompanyId = preservedCompanyId ?? companies[0]?.id ?? null

      syncActiveCompanyCookies(companies, activeCompanyId)

      return {
        accessToken,
        user,
        companies,
        activeCompanyId,
      }
    }),
  setUser: (user) => set({ user }),
  setActiveCompany: (companyId) =>
    set((state) => {
      if (!state.companies.some((company) => company.id === companyId)) {
        return state
      }

      syncActiveCompanyCookies(state.companies, companyId)

      return { activeCompanyId: companyId }
    }),
  setRefreshing: (value) => set({ isRefreshing: value }),
  clearSession: () => {
    syncActiveCompanyCookies(get().companies, null)

    set({
      accessToken: null,
      user: null,
      companies: [],
      activeCompanyId: null,
      isRefreshing: false,
    })
  },
}))
