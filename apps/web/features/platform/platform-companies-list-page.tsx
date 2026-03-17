"use client"

import Link from "next/link"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Add01Icon, PencilEdit02Icon, ViewIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deletePlatformCompany, listPlatformCompanies } from "@/features/platform/api"
import { formatPlatformDate } from "@/features/platform/utils"
import { useAuthStore } from "@/lib/auth/store"

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export function PlatformCompaniesListPage() {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)
  const [search, setSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const companiesQuery = useQuery({
    queryKey: ["platform", "companies", accessToken],
    queryFn: () => listPlatformCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
  })

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return companiesQuery.data ?? []
    }

    return (companiesQuery.data ?? []).filter((company) =>
      [
        company.name,
        company.slug,
        company.email,
        company.nif,
        company.mobile_phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    )
  }, [companiesQuery.data, search])

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const paginatedCompanies = filteredCompanies.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  )

  const deleteMutation = useMutation({
    mutationFn: async (company: { id: string; name: string }) => {
      if (!accessToken) {
        throw new Error("Sem sessao ativa.")
      }

      await deletePlatformCompany(accessToken, company.id)
      return company
    },
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "companies"] })
      toast.success(`Empresa "${company.name}" apagada com sucesso.`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nao foi possivel apagar a empresa.")
    },
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

  return (
    <Card className="border-[#dfd7c0] bg-[#fbf8ef]">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle>Empresas</CardTitle>
            <CardDescription>
              Gere a estrutura base da plataforma e o admin inicial de cada empresa.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageIndex(0)
              }}
              placeholder="Pesquisar nome, slug, email, NIF"
              className="w-full min-w-64 bg-white"
            />
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPageIndex(0)
              }}
            >
              <SelectTrigger className="w-full bg-white sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}/pag.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild className="bg-[#215442] text-white hover:bg-[#183b2f]">
              <Link href="/platform/companies/new">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                Nova empresa
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {companiesQuery.isLoading ? (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              A carregar empresas...
            </div>
          ) : paginatedCompanies.length ? (
            paginatedCompanies.map((company) => (
              <article
                key={company.id}
                className="rounded-2xl border border-[#dfd7c0] bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="font-medium text-[#1f2f27]">{company.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {company.slug} · {company.email}
                  </p>
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Membros</dt>
                    <dd>{company.member_count}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Admins ativos</dt>
                    <dd>{company.active_admin_count}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Criada</dt>
                    <dd>{formatPlatformDate(company.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button asChild variant="outline" size="icon-sm">
                    <Link href={`/platform/companies/${company.id}`}>
                      <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                      <span className="sr-only">Ver empresa</span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="icon-sm">
                    <Link href={`/platform/companies/${company.id}/edit`}>
                      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      <span className="sr-only">Editar empresa</span>
                    </Link>
                  </Button>
                  <DeleteConfirmDialog
                    title="Apagar empresa"
                    description={`Tens a certeza que queres apagar ${company.name}? Esta acao remove tambem membros, equipas e dados ligados a esta empresa.`}
                    onConfirm={() =>
                      deleteMutation.mutate({
                        id: company.id,
                        name: company.name,
                      })
                    }
                    isPending={deleteMutation.isPending}
                    srLabel="Apagar empresa"
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa encontrada.
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-[#dfd7c0] bg-white md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Admins ativos</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companiesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    A carregar empresas...
                  </TableCell>
                </TableRow>
              ) : paginatedCompanies.length ? (
                paginatedCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium text-[#1f2f27]">{company.name}</TableCell>
                    <TableCell>{company.slug}</TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.member_count}</TableCell>
                    <TableCell>{company.active_admin_count}</TableCell>
                    <TableCell>{formatPlatformDate(company.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="icon-sm">
                          <Link href={`/platform/companies/${company.id}`}>
                            <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                            <span className="sr-only">Ver empresa</span>
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon-sm">
                          <Link href={`/platform/companies/${company.id}/edit`}>
                            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                            <span className="sr-only">Editar empresa</span>
                          </Link>
                        </Button>
                        <DeleteConfirmDialog
                          title="Apagar empresa"
                          description={`Tens a certeza que queres apagar ${company.name}? Esta acao remove tambem membros, equipas e dados ligados a esta empresa.`}
                          onConfirm={() =>
                            deleteMutation.mutate({
                              id: company.id,
                              name: company.name,
                            })
                          }
                          isPending={deleteMutation.isPending}
                          srLabel="Apagar empresa"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhuma empresa encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredCompanies.length} registo(s) no total. Pagina {safePageIndex + 1} de{" "}
            {totalPages}.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
              disabled={safePageIndex === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((value) => Math.min(totalPages - 1, value + 1))}
              disabled={safePageIndex >= totalPages - 1}
            >
              Seguinte
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
