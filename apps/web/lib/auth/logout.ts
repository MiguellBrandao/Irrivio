"use client"

const LOGOUT_REDIRECT_MARKER = "auth_logout_redirect"

export function markLogoutRedirect() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(LOGOUT_REDIRECT_MARKER, "1")
}

export function consumeLogoutRedirect() {
  if (typeof window === "undefined") {
    return false
  }

  const hasMarker = window.sessionStorage.getItem(LOGOUT_REDIRECT_MARKER) === "1"

  if (hasMarker) {
    window.sessionStorage.removeItem(LOGOUT_REDIRECT_MARKER)
  }

  return hasMarker
}
