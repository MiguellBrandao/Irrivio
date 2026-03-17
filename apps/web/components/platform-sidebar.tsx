"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building06Icon,
  ShieldUserIcon,
} from "@hugeicons/core-free-icons"

import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/lib/auth/store"

const platformItems = [
  {
    name: "Empresas",
    url: "/platform/companies",
    icon: <HugeiconsIcon icon={Building06Icon} strokeWidth={2} />,
  },
  {
    name: "Utilizadores",
    url: "/platform/users",
    icon: <HugeiconsIcon icon={ShieldUserIcon} strokeWidth={2} />,
  },
]

export function PlatformSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const user = useAuthStore((state) => state.user)

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="px-2 py-2">
          <div className="text-xs uppercase tracking-[0.24em] text-[#215442]/70">
            Floripa
          </div>
          <div className="mt-1 text-lg font-semibold text-[#1f2f27]">Platform</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={platformItems} title="Plataforma" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? "Super Admin",
            email: user?.email ?? "sem-login@floripa.local",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
