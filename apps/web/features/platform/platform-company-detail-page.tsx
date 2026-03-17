"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PlatformCompanyMembersPage } from "@/features/platform/platform-company-members-page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getPlatformCompanyById } from "@/features/platform/api"
import { useAuthStore } from "@/lib/auth/store"

export function PlatformCompanyDetailPage({
  companyId,
}: {
  companyId: string
}) {
  const accessToken = useAuthStore((state) => state.accessToken)

  const companyQuery = useQuery({
    queryKey: ["platform", "companies", "detail", companyId, accessToken],
    queryFn: () => getPlatformCompanyById(accessToken ?? "", companyId),
    enabled: Boolean(accessToken && companyId),
  })

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessao em falta</CardTitle>
          <CardDescription>Faz login novamente antes de gerir empresas.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (companyQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>A carregar empresa...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!companyQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Empresa nao encontrada</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const company = companyQuery.data

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f2f27]">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.slug} - {company.email}
          </p>
        </div>
        <div className="flex justify-start lg:justify-end">
          <Button asChild variant="outline" size="icon-sm">
            <Link href={`/platform/companies/${company.id}/edit`}>
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
              <span className="sr-only">Editar empresa</span>
            </Link>
          </Button>
        </div>
      </section>

      <Card className="border-[#dfd7c0] bg-[#fbf8ef]">
        <CardHeader>
          <CardTitle>Dados base</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DetailItem label="Morada" value={company.address} />
          <DetailItem label="Telemovel" value={company.mobile_phone} />
          <DetailItem label="Email" value={company.email} />
          <DetailItem label="IBAN" value={company.iban} />
          <DetailItem label="NIF" value={company.nif} />
          <DetailItem label="Slug" value={company.slug} />
          <AssetPreview label="Logo" value={company.logo_path} />
          <AssetPreview label="Favicon" value={company.favicon_path} />
        </CardContent>
      </Card>

      <PlatformCompanyMembersPage
        companyId={company.id}
        companyName={company.name}
        embedded
      />
    </div>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-[#dfd7c0] bg-white p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-[#1f2f27]">{value}</div>
    </div>
  )
}

function AssetPreview({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-[#dfd7c0] bg-white p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      {value ? (
        <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#dfd7c0] bg-[#fbf8ef] p-4">
          <img
            src={value}
            alt={label}
            className="max-h-20 max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#dfd7c0] bg-[#fbf8ef] px-4 py-6 text-sm text-muted-foreground">
          Sem imagem configurada.
        </div>
      )}
    </div>
  )
}
