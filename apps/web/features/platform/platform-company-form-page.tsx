"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createPlatformCompany,
  getPlatformCompanyById,
  listPlatformUsers,
  updatePlatformCompany,
} from "@/features/platform/api"
import {
  platformCompanyFormDefaults,
  platformCompanyFormSchema,
  type PlatformCompanyFormValues,
} from "@/features/platform/schema"
import {
  toCreatePlatformCompanyPayload,
  toPlatformCompanyFormValues,
  toUpdatePlatformCompanyPayload,
} from "@/features/platform/utils"
import { useAuthStore } from "@/lib/auth/store"

type PlatformCompanyFormPageProps = {
  mode: "create" | "edit"
  companyId?: string
}

export function PlatformCompanyFormPage({
  mode,
  companyId,
}: PlatformCompanyFormPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)

  const form = useForm<PlatformCompanyFormValues>({
    resolver: zodResolver(
      platformCompanyFormSchema.superRefine((values, context) => {
        if (mode !== "create") {
          return
        }

        if (values.initial_admin_mode === "existing") {
          if (!values.initial_admin_user_id.trim()) {
            context.addIssue({
              code: "custom",
              path: ["initial_admin_user_id"],
              message: "Escolhe o admin inicial.",
            })
          }
          return
        }

        if (!values.initial_admin_email.trim()) {
          context.addIssue({
            code: "custom",
            path: ["initial_admin_email"],
            message: "Indica o email do admin inicial.",
          })
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.initial_admin_email.trim())) {
          context.addIssue({
            code: "custom",
            path: ["initial_admin_email"],
            message: "Indica um email valido.",
          })
        }

        if (!values.initial_admin_password.trim()) {
          context.addIssue({
            code: "custom",
            path: ["initial_admin_password"],
            message: "Indica a password do admin inicial.",
          })
        } else if (values.initial_admin_password.trim().length < 8) {
          context.addIssue({
            code: "custom",
            path: ["initial_admin_password"],
            message: "A password deve ter pelo menos 8 caracteres.",
          })
        }
      })
    ),
    defaultValues: platformCompanyFormDefaults,
  })

  const initialAdminMode = useWatch({
    control: form.control,
    name: "initial_admin_mode",
  })
  const initialAdminUserId = useWatch({
    control: form.control,
    name: "initial_admin_user_id",
  })
  const logoPath = useWatch({
    control: form.control,
    name: "logo_path",
  })
  const faviconPath = useWatch({
    control: form.control,
    name: "favicon_path",
  })

  const companyQuery = useQuery({
    queryKey: ["platform", "companies", "detail", companyId, accessToken],
    queryFn: () => getPlatformCompanyById(accessToken ?? "", companyId ?? ""),
    enabled: Boolean(accessToken && companyId && mode === "edit"),
  })

  const usersQuery = useQuery({
    queryKey: ["platform", "users", accessToken],
    queryFn: () => listPlatformUsers(accessToken ?? ""),
    enabled: Boolean(accessToken && mode === "create"),
  })

  const existingAdminUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => !user.is_super_admin),
    [usersQuery.data]
  )

  useEffect(() => {
    if (mode === "edit" && companyQuery.data) {
      form.reset(toPlatformCompanyFormValues(companyQuery.data))
    }
  }, [companyQuery.data, form, mode])

  useEffect(() => {
    if (mode !== "create" || initialAdminMode !== "existing" || !initialAdminUserId) {
      return
    }

    const userStillAvailable = existingAdminUsers.some((user) => user.id === initialAdminUserId)

    if (!userStillAvailable) {
      form.setValue("initial_admin_user_id", "", {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [existingAdminUsers, form, initialAdminMode, initialAdminUserId, mode])

  const saveMutation = useMutation({
    mutationFn: async (values: PlatformCompanyFormValues) => {
      if (!accessToken) {
        throw new Error("Sem sessao ativa.")
      }

      if (mode === "edit" && companyId) {
        return updatePlatformCompany(
          accessToken,
          companyId,
          toUpdatePlatformCompanyPayload(values)
        )
      }

      return createPlatformCompany(accessToken, toCreatePlatformCompanyPayload(values))
    },
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "companies"] })
      await queryClient.invalidateQueries({ queryKey: ["platform", "users"] })
      toast.success(
        mode === "edit"
          ? "Empresa atualizada com sucesso."
          : "Empresa criada com sucesso."
      )
      router.push(company?.id ? `/platform/companies/${company.id}` : "/platform/companies")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nao foi possivel guardar a empresa.")
    },
  })

  async function handleAssetSelection(
    fieldName: "logo_path" | "favicon_path",
    files: FileList | null
  ) {
    const file = files?.[0]
    if (!file) {
      return
    }

    try {
      const value = await readFileAsDataUrl(file)
      form.setValue(fieldName, value, {
        shouldDirty: true,
        shouldValidate: true,
      })
    } catch {
      toast.error("Nao foi possivel ler a imagem selecionada.")
    }
  }

  function onSubmit(values: PlatformCompanyFormValues) {
    saveMutation.mutate(values)
  }

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
    <Card className="mx-auto w-full max-w-5xl border-[#dfd7c0] bg-white">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{mode === "edit" ? "Editar empresa" : "Criar empresa"}</CardTitle>
            <CardDescription>
              {mode === "edit"
                ? "Atualiza os dados base da empresa."
                : "Cria uma empresa e define logo o primeiro admin ativo."}
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/platform/companies">Voltar a listagem</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "edit" && companyQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-[#dfd7c0] bg-[#fbf8ef] p-5 text-sm text-muted-foreground">
            A carregar empresa...
          </div>
        ) : (
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-5">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#215442]">
                  Dados da empresa
                </h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <CompanyField control={form.control} name="name" label="Nome" />
                  <CompanyField control={form.control} name="slug" label="Slug" />
                  <CompanyField control={form.control} name="email" label="Email" type="email" />
                  <CompanyField
                    control={form.control}
                    name="mobile_phone"
                    label="Telemovel"
                  />
                  <CompanyField control={form.control} name="nif" label="NIF" />
                  <CompanyField control={form.control} name="iban" label="IBAN" />
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <CompanyAssetField
                    id="company-logo"
                    label="Logo"
                    value={logoPath}
                    error={form.formState.errors.logo_path}
                    onClear={() => {
                      form.setValue("logo_path", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    onFileChange={(files) => handleAssetSelection("logo_path", files)}
                  />
                  <CompanyAssetField
                    id="company-favicon"
                    label="Favicon"
                    value={faviconPath}
                    error={form.formState.errors.favicon_path}
                    onClear={() => {
                      form.setValue("favicon_path", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    onFileChange={(files) => handleAssetSelection("favicon_path", files)}
                  />
                </div>

                <div className="mt-5">
                  <CompanyField control={form.control} name="address" label="Morada" />
                </div>
              </div>

              {mode === "create" ? (
                <div className="space-y-4 rounded-2xl border border-[#dfd7c0] bg-[#fbf8ef] p-5">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#215442]">
                      Administrador inicial
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Cada empresa tem de nascer com pelo menos um admin ativo.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="initial_admin_mode"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Origem</FieldLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-invalid={fieldState.invalid}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="existing">Utilizador existente</SelectItem>
                              <SelectItem value="new">Criar novo utilizador</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                    <CompanyField
                      control={form.control}
                      name="initial_admin_name"
                      label="Nome na empresa"
                    />
                  </div>

                  {initialAdminMode === "existing" ? (
                    <Controller
                      control={form.control}
                      name="initial_admin_user_id"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Utilizador existente</FieldLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-invalid={fieldState.invalid}>
                              <SelectValue placeholder="Seleciona um utilizador" />
                            </SelectTrigger>
                            <SelectContent>
                              {existingAdminUsers.length ? (
                                existingAdminUsers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.email}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__empty" disabled>
                                  Sem utilizadores disponiveis
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      <CompanyField
                        control={form.control}
                        name="initial_admin_email"
                        label="Email"
                        type="email"
                      />
                      <CompanyField
                        control={form.control}
                        name="initial_admin_password"
                        label="Password"
                        type="password"
                      />
                    </div>
                  )}

                  <CompanyField
                    control={form.control}
                    name="initial_admin_phone"
                    label="Telefone"
                  />
                </div>
              ) : null}

              {saveMutation.isError ? (
                <FieldError>{saveMutation.error.message}</FieldError>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  className="bg-[#215442] text-white hover:bg-[#183b2f]"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? "A guardar..."
                    : mode === "edit"
                      ? "Guardar alteracoes"
                      : "Criar empresa"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    form.reset(
                      mode === "edit" && companyQuery.data
                        ? toPlatformCompanyFormValues(companyQuery.data)
                        : platformCompanyFormDefaults
                    )
                  }
                >
                  Limpar formulario
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function CompanyField({
  control,
  name,
  label,
  type,
}: {
  control: ReturnType<typeof useForm<PlatformCompanyFormValues>>["control"]
  name: keyof PlatformCompanyFormValues
  label: string
  type?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={String(name)}>{label}</FieldLabel>
          <Input
            {...field}
            id={String(name)}
            type={type}
            aria-invalid={fieldState.invalid}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function CompanyAssetField({
  id,
  label,
  value,
  error,
  onFileChange,
  onClear,
}: {
  id: string
  label: string
  value: string
  error?: { message?: string }
  onFileChange: (files: FileList | null) => void
  onClear: () => void
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="file"
        accept="image/*"
        onChange={(event) => {
          onFileChange(event.target.files)
          event.currentTarget.value = ""
        }}
        aria-invalid={Boolean(error)}
      />
      <FieldDescription>
        A imagem fica guardada diretamente na base de dados em base64.
      </FieldDescription>
      {value ? (
        <div className="space-y-3 rounded-2xl border border-[#dfd7c0] bg-[#fbf8ef] p-4">
          <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#dfd7c0] bg-white p-4">
            <img
              src={value}
              alt={label}
              className="max-h-20 max-w-full object-contain"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Remover imagem
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#dfd7c0] bg-[#fbf8ef] px-4 py-6 text-sm text-muted-foreground">
          Nenhuma imagem selecionada.
        </div>
      )}
      <FieldError errors={[error]} />
    </Field>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Nao foi possivel ler o ficheiro."))
    reader.readAsDataURL(file)
  })
}
