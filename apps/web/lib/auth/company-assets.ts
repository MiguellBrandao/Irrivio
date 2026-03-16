export const ACTIVE_COMPANY_ID_COOKIE_NAME = "active_company_id"
export const ACTIVE_COMPANY_NAME_COOKIE_NAME = "active_company_name"
export const ACTIVE_COMPANY_FAVICON_COOKIE_NAME = "active_company_favicon_path"
export const DEFAULT_COMPANY_FAVICON_PATH = "/companies/floripa-jardins-favicon.png"
export const APPLICATION_NAME = "Irrivio"

export function buildApplicationTitle(companyName: string | null | undefined) {
  const normalizedCompanyName = companyName?.trim()

  return normalizedCompanyName
    ? `${APPLICATION_NAME} | ${normalizedCompanyName}`
    : APPLICATION_NAME
}

export function normalizeCompanyAssetPath(path: string | null | undefined) {
  if (!path) {
    return DEFAULT_COMPANY_FAVICON_PATH
  }

  try {
    const decodedPath = decodeURIComponent(path)
    return decodedPath.startsWith("/") ? decodedPath : DEFAULT_COMPANY_FAVICON_PATH
  } catch {
    return path.startsWith("/") ? path : DEFAULT_COMPANY_FAVICON_PATH
  }
}
