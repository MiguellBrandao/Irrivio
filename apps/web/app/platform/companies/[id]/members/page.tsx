import { redirect } from "next/navigation"

export default async function PlatformCompanyMembersRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  redirect(`/platform/companies/${id}`)
}
