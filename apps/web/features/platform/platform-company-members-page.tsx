"use client"

import Link from "next/link"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Add01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons"
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
import { PlatformMembershipFormDialog } from "@/features/platform/platform-membership-form-dialog"
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
import {
  deletePlatformCompanyMembership,
  getPlatformCompanyById,
  listPlatformCompanyMemberships,
  listPlatformCompanyTeams,
  listPlatformUsers,
} from "@/features/platform/api"
import type { PlatformCompanyMembership } from "@/features/platform/types"
import { formatPlatformDate } from "@/features/platform/utils"
import { useAuthStore } from "@/lib/auth/store"

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export function PlatformCompanyMembersPage({
  companyId,
  companyName,
  embedded = false,
}: {
  companyId: string
  companyName?: string
  embedded?: boolean
}) {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)
  const [search, setSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingMembership, setEditingMembership] =
    useState<PlatformCompanyMembership | null>(null)

  const companyQuery = useQuery({
    queryKey: ["platform", "companies", "detail", companyId, accessToken],
    queryFn: () => getPlatformCompanyById(accessToken ?? "", companyId),
    enabled: Boolean(accessToken && companyId && !companyName),
  })

  const membershipsQuery = useQuery({
    queryKey: ["platform", "companies", "memberships", companyId, accessToken],
    queryFn: () => listPlatformCompanyMemberships(accessToken ?? "", companyId),
    enabled: Boolean(accessToken && companyId),
    placeholderData: keepPreviousData,
  })

  const usersQuery = useQuery({
    queryKey: ["platform", "users", accessToken],
    queryFn: () => listPlatformUsers(accessToken ?? ""),
    enabled: Boolean(accessToken),
  })

  const teamsQuery = useQuery({
    queryKey: ["platform", "companies", "teams", companyId, accessToken],
    queryFn: () => listPlatformCompanyTeams(accessToken ?? "", companyId),
    enabled: Boolean(accessToken && companyId),
  })

  const filteredMemberships = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return membershipsQuery.data ?? []
    }

    return (membershipsQuery.data ?? []).filter((membership) =>
      [
        membership.name,
        membership.email ?? "",
        membership.phone ?? "",
        membership.role,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    )
  }, [membershipsQuery.data, search])

  const availableUsers = useMemo(() => {
    const currentUserIds = new Set(
      (membershipsQuery.data ?? []).map((membership) => membership.user_id).filter(Boolean)
    )

    return (usersQuery.data ?? []).filter((user) => !currentUserIds.has(user.id))
  }, [membershipsQuery.data, usersQuery.data])

  const teamNameMap = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name])),
    [teamsQuery.data]
  )

  const totalPages = Math.max(1, Math.ceil(filteredMemberships.length / pageSize))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const paginatedMemberships = filteredMemberships.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  )

  const deleteMutation = useMutation({
    mutationFn: async (membership: PlatformCompanyMembership) => {
      if (!accessToken) {
        throw new Error("Sem sessao ativa.")
      }

      await deletePlatformCompanyMembership(accessToken, membership.id)
      return membership
    },
    onSuccess: async (membership) => {
      await queryClient.invalidateQueries({ queryKey: ["platform"] })
      toast.success(`Membership de "${membership.name}" apagada com sucesso.`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nao foi possivel apagar a membership.")
    },
  })

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessao em falta</CardTitle>
          <CardDescription>Faz login novamente antes de gerir members.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-[#dfd7c0] bg-[#fbf8ef]">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle>Membros da empresa</CardTitle>
            <CardDescription>
              {companyName ?? companyQuery.data?.name ?? "Empresa"} - garante sempre
              pelo menos um admin ativo.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageIndex(0)
              }}
              placeholder="Pesquisar nome, email ou role"
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
            <Button
              className="bg-[#215442] text-white hover:bg-[#183b2f]"
              onClick={() => setCreateOpen(true)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Adicionar membership
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!embedded ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/platform/companies/${companyId}`}>Voltar ao detalhe</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/platform/companies/${companyId}/edit`}>Editar empresa</Link>
            </Button>
          </div>
        ) : null}

        <div className="hidden overflow-hidden rounded-2xl border border-[#dfd7c0] bg-white md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Equipas</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membershipsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    A carregar memberships...
                  </TableCell>
                </TableRow>
              ) : paginatedMemberships.length ? (
                paginatedMemberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium text-[#1f2f27]">{membership.name}</TableCell>
                    <TableCell>{membership.email ?? "-"}</TableCell>
                    <TableCell className="capitalize">{membership.role}</TableCell>
                    <TableCell>{membership.active ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal">
                      {membership.team_ids.length
                        ? membership.team_ids
                            .map((teamId) => teamNameMap.get(teamId))
                            .filter(Boolean)
                            .join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell>{formatPlatformDate(membership.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setEditingMembership(membership)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                          <span className="sr-only">Editar membership</span>
                        </Button>
                        <DeleteConfirmDialog
                          title="Apagar membership"
                          description={`Tens a certeza que queres apagar a membership de ${membership.name}?`}
                          onConfirm={() => deleteMutation.mutate(membership)}
                          isPending={deleteMutation.isPending}
                          srLabel="Apagar membership"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhuma membership encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {membershipsQuery.isLoading ? (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              A carregar memberships...
            </div>
          ) : paginatedMemberships.length ? (
            paginatedMemberships.map((membership) => (
              <article
                key={membership.id}
                className="rounded-2xl border border-[#dfd7c0] bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="font-medium text-[#1f2f27]">{membership.name}</h3>
                  <p className="text-sm text-muted-foreground">{membership.email ?? "-"}</p>
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="capitalize">{membership.role}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>{membership.active ? "Ativo" : "Inativo"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Equipas</dt>
                    <dd>
                      {membership.team_ids.length
                        ? membership.team_ids
                            .map((teamId) => teamNameMap.get(teamId))
                            .filter(Boolean)
                            .join(", ")
                        : "-"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setEditingMembership(membership)}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                    <span className="sr-only">Editar membership</span>
                  </Button>
                  <DeleteConfirmDialog
                    title="Apagar membership"
                    description={`Tens a certeza que queres apagar a membership de ${membership.name}?`}
                    onConfirm={() => deleteMutation.mutate(membership)}
                    isPending={deleteMutation.isPending}
                    srLabel="Apagar membership"
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma membership encontrada.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredMemberships.length} registo(s) no total. Pagina {safePageIndex + 1} de{" "}
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

        <PlatformMembershipFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          companyId={companyId}
          users={availableUsers}
          teams={teamsQuery.data ?? []}
        />
        <PlatformMembershipFormDialog
          open={Boolean(editingMembership)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingMembership(null)
            }
          }}
          mode="edit"
          companyId={companyId}
          membership={editingMembership}
          users={availableUsers}
          teams={teamsQuery.data ?? []}
        />
      </CardContent>
    </Card>
  )
}
