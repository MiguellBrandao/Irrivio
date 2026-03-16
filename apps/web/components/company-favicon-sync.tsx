"use client"

import { useEffect } from "react"

import { buildApplicationTitle, normalizeCompanyAssetPath } from "@/lib/auth/company-assets"
import { useAuthStore } from "@/lib/auth/store"

function resolveIconType(path: string) {
  if (path.endsWith(".png")) {
    return "image/png"
  }

  if (path.endsWith(".svg")) {
    return "image/svg+xml"
  }

  if (path.endsWith(".ico")) {
    return "image/x-icon"
  }

  return undefined
}

function upsertFaviconLink(rel: "icon" | "shortcut icon", href: string) {
  const existingManagedLink = document.head.querySelector<HTMLLinkElement>(
    `link[data-company-favicon="true"][rel="${rel}"]`
  )
  const link = existingManagedLink ?? document.createElement("link")
  const iconType = resolveIconType(href)

  link.setAttribute("data-company-favicon", "true")
  link.setAttribute("rel", rel)
  link.setAttribute("href", href)

  if (iconType) {
    link.setAttribute("type", iconType)
  } else {
    link.removeAttribute("type")
  }

  if (!existingManagedLink) {
    document.head.appendChild(link)
  }
}

export function CompanyFaviconSync() {
  const activeCompany = useAuthStore((state) =>
    state.companies.find((company) => company.id === state.activeCompanyId) ?? null
  )
  const faviconPath = normalizeCompanyAssetPath(activeCompany?.favicon_path)

  useEffect(() => {
    const staleLinks = document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"]:not([data-company-favicon="true"]), link[rel="shortcut icon"]:not([data-company-favicon="true"])'
    )

    staleLinks.forEach((link) => {
      link.remove()
    })

    upsertFaviconLink("icon", faviconPath)
    upsertFaviconLink("shortcut icon", faviconPath)
  }, [faviconPath])

  useEffect(() => {
    document.title = buildApplicationTitle(activeCompany?.name)
  }, [activeCompany?.name])

  return null
}
