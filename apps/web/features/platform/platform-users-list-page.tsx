"use client"

import Link from "next/link"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Add01Icon, PencilEdit02Icon, ViewIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Badge } from "@/components/ui/badge"
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
import { deletePlatformUser, listPlatformUsers } from "@/features/platform/api"
import { formatPlatformDate } from "@/features/platform/utils"
import { useAuthStore } from "@/lib/auth/store"

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export function PlatformUsersListPage() {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)
  const [search, setSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const usersQuery = useQuery({
    queryKey: ["platform", "users", accessToken],
    queryFn: () => listPlatformUsers(accessToken ?? ""),
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
  })

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return usersQuery.data ?? []
    }

    return (usersQuery.data ?? []).filter((user) =>
      user.email.toLowerCase().includes(normalizedSearch)
    )
  }, [search, usersQuery.data])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const paginatedUsers = filteredUsers.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  )

  const deleteMutation = useMutation({
    mutationFn: async (user: { id: string; email: string }) => {
      if (!accessToken) {
        throw new Error("Sem sessao ativa.")
      }

      await deletePlatformUser(accessToken, user.id)
      return user
    },
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["platform"] })
      toast.success(`Utilizador "${user.email}" apagado com sucesso.`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nao foi possivel apagar o utilizador.")
    },
  })

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessao em falta</CardTitle>
          <CardDescription>Faz login novamente antes de gerir utilizadores.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-[#dfd7c0] bg-[#fbf8ef]">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle>Utilizadores</CardTitle>
            <CardDescription>
              Gere contas globais da plataforma e os acessos de super admin.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageIndex(0)
              }}
              placeholder="Pesquisar por email"
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
              <Link href="/platform/users/new">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                Novo utilizador
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="hidden overflow-hidden rounded-2xl border border-[#dfd7c0] bg-white md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Memberships</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    A carregar utilizadores...
                  </TableCell>
                </TableRow>
              ) : paginatedUsers.length ? (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-[#1f2f27]">{user.email}</TableCell>
                    <TableCell>
                      <UserTypeBadge isSuperAdmin={user.is_super_admin} />
                    </TableCell>
                    <TableCell>{user.membership_count}</TableCell>
                    <TableCell>{formatPlatformDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="icon-sm">
                          <Link href={`/platform/users/${user.id}`}>
                            <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                            <span className="sr-only">Ver utilizador</span>
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon-sm">
                          <Link href={`/platform/users/${user.id}/edit`}>
                            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                            <span className="sr-only">Editar utilizador</span>
                          </Link>
                        </Button>
                        <DeleteConfirmDialog
                          title="Apagar utilizador"
                          description={`Tens a certeza que queres apagar ${user.email}?`}
                          onConfirm={() => deleteMutation.mutate({ id: user.id, email: user.email })}
                          isPending={deleteMutation.isPending}
                          srLabel="Apagar utilizador"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum utilizador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {usersQuery.isLoading ? (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              A carregar utilizadores...
            </div>
          ) : paginatedUsers.length ? (
            paginatedUsers.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-[#dfd7c0] bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="font-medium text-[#1f2f27]">{user.email}</h3>
                  <UserTypeBadge isSuperAdmin={user.is_super_admin} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Memberships</dt>
                    <dd>{user.membership_count}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Criado</dt>
                    <dd>{formatPlatformDate(user.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex justify-end gap-2">
                  <Button asChild variant="outline" size="icon-sm">
                    <Link href={`/platform/users/${user.id}`}>
                      <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                      <span className="sr-only">Ver utilizador</span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="icon-sm">
                    <Link href={`/platform/users/${user.id}/edit`}>
                      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      <span className="sr-only">Editar utilizador</span>
                    </Link>
                  </Button>
                  <DeleteConfirmDialog
                    title="Apagar utilizador"
                    description={`Tens a certeza que queres apagar ${user.email}?`}
                    onConfirm={() => deleteMutation.mutate({ id: user.id, email: user.email })}
                    isPending={deleteMutation.isPending}
                    srLabel="Apagar utilizador"
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-[#dfd7c0] bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum utilizador encontrado.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredUsers.length} registo(s) no total. Pagina {safePageIndex + 1} de{" "}
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

function UserTypeBadge({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean
}) {
  return <Badge variant={isSuperAdmin ? "default" : "secondary"}>{isSuperAdmin ? "Super Admin" : "User"}</Badge>
}
