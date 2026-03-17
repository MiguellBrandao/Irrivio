"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPlatformUserById } from "@/features/platform/api"
import { formatPlatformDate } from "@/features/platform/utils"
import { useAuthStore } from "@/lib/auth/store"

export function PlatformUserDetailPage({
  userId,
}: {
  userId: string
}) {
  const accessToken = useAuthStore((state) => state.accessToken)

  const userQuery = useQuery({
    queryKey: ["platform", "users", "detail", userId, accessToken],
    queryFn: () => getPlatformUserById(accessToken ?? "", userId),
    enabled: Boolean(accessToken && userId),
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

  if (userQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>A carregar utilizador...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!userQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Utilizador nao encontrado</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const user = userQuery.data

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={user.is_super_admin ? "default" : "secondary"}
              className="shrink-0"
            >
              {user.is_super_admin ? "Super Admin" : "User"}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1f2f27]">
              {user.email}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Conta global da plataforma criada em {formatPlatformDate(user.created_at)}.
          </p>
        </div>
        <div className="flex justify-start lg:justify-end">
          <Button asChild variant="outline" size="icon-sm">
            <Link href={`/platform/users/${user.id}/edit`}>
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
              <span className="sr-only">Editar utilizador</span>
            </Link>
          </Button>
        </div>
      </section>

      <Card className="border-[#dfd7c0] bg-[#fbf8ef]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Memberships</CardTitle>
              <CardDescription>
                Empresas onde esta conta tem acesso e o respetivo role.
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {user.membership_count} acesso(s)
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-[#dfd7c0] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.memberships.length ? (
                  user.memberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell className="font-medium text-[#1f2f27]">
                        {membership.company_name}
                      </TableCell>
                      <TableCell>{membership.name}</TableCell>
                      <TableCell className="capitalize">{membership.role}</TableCell>
                      <TableCell>{membership.active ? "Ativo" : "Inativo"}</TableCell>
                      <TableCell>{formatPlatformDate(membership.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/platform/companies/${membership.company_id}`}>
                            Abrir empresa
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Este utilizador ainda nao pertence a nenhuma empresa.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
