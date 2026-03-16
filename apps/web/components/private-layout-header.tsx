"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuthStore } from "@/lib/auth/store"

const labels: Record<string, string> = {
  dashboard: "Painel",
  calendar: "Calendario",
  gardens: "Jardins",
  employees: "Membros",
  teams: "Equipas",
  stock: "Stock",
  payments: "Pagamentos",
  quotes: "Orcamentos",
  profile: "Perfil",
}

export function PrivateLayoutHeader() {
  const pathname = usePathname()
  const activeCompany = useAuthStore((state) =>
    state.companies.find((company) => company.id === state.activeCompanyId) ?? null
  )
  const segments = pathname.split("/").filter(Boolean)
  const current = segments.at(-1) ?? "dashboard"
  const previous = segments.at(-2)
  const isGardenRoute = segments[0] === "gardens"
  const isGardenScopedRoute =
    isGardenRoute && segments.length >= 2 && segments[1] !== "new"
  const isGardenDetailsRoute = isGardenScopedRoute && segments.length === 2
  const isGardenProductsRoute = isGardenScopedRoute && current === "products"
  const isGardenExpensesRoute = isGardenScopedRoute && current === "expenses"
  const isGardenIrrigationRoute = isGardenScopedRoute && current === "irrigation"
  const isGardenEditRoute = isGardenScopedRoute && current === "edit"
  const isStockRuleRoute = segments[0] === "stock" && segments.includes("rules")
  const isCalendarTaskRoute = segments[0] === "calendar" && segments[1] === "tasks"
  const isCalendarTaskCreateRoute = isCalendarTaskRoute && current === "new"
  const isCalendarTaskEditRoute = isCalendarTaskRoute && current === "edit"
  const isCalendarTaskDetailsRoute =
    isCalendarTaskRoute && !isCalendarTaskCreateRoute && !isCalendarTaskEditRoute
  const currentLabel =
    isCalendarTaskCreateRoute
      ? "Nova tarefa"
      : isCalendarTaskEditRoute
        ? "Editar tarefa"
      : isCalendarTaskDetailsRoute
        ? "Detalhes da tarefa"
      : isGardenDetailsRoute
        ? "Detalhes do jardim"
      : isGardenProductsRoute
        ? "Produtos utilizados"
      : isGardenExpensesRoute
        ? "Despesas"
      : isGardenIrrigationRoute
        ? "Sistema de irrigacao"
      : isGardenEditRoute
        ? "Editar jardim"
      : current === "new" && isStockRuleRoute
        ? "Nova regra de stock"
      : current === "new" && previous === "gardens"
        ? "Novo jardim"
      : current === "new" && previous === "employees"
        ? "Novo membro"
      : current === "new" && previous === "quotes"
        ? "Novo orcamento"
      : current === "new" && previous === "stock"
        ? "Novo produto"
      : current === "edit" && isStockRuleRoute
        ? "Editar regra de stock"
      : current === "edit" && previous
        ? previous === "employees"
          ? "Editar membro"
          : previous === "quotes"
            ? "Editar orcamento"
          : previous === "stock"
            ? "Editar produto"
          : "Editar jardim"
        : labels[current] ?? current

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 text-[#215442] hover:bg-[#215442]/8" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link href="/dashboard">{activeCompany?.name ?? "Irrivio"}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
