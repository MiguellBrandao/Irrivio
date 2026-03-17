"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { SessionLoadingScreen } from "@/components/session-loading-screen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { loginFormSchema, type LoginFormValues } from "@/features/auth/login-form-schema"
import { login } from "@/lib/auth/api"
import { getAuthenticatedHomePath } from "@/lib/auth/routes"
import { useAuthStore } from "@/lib/auth/store"
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const setSession = useAuthStore((state) => state.setSession)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      setIsRedirecting(true)
      setSession(session)
      router.replace(getAuthenticatedHomePath(session.user))
    },
  })

  function onSubmit(values: LoginFormValues) {
    loginMutation.mutate(values)
  }

  if (isRedirecting) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="border-white/70 bg-white/80 shadow-[0_30px_80px_-40px_rgba(31,47,39,0.55)] backdrop-blur">
          <CardContent className="py-10">
            <SessionLoadingScreen compact />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-white/70 bg-white/80 shadow-[0_30px_80px_-40px_rgba(31,47,39,0.55)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl text-[#1f2f27]">
            Entrar na intranet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id="login-form"
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup className="gap-5">
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="miguellbwork@gmail.com"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {loginMutation.isError ? (
                <FieldError>
                  {loginMutation.error.message}
                </FieldError>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 border-t">
          <Button
            type="submit"
            form="login-form"
            size="lg"
            disabled={loginMutation.isPending || isRedirecting}
            className="w-full bg-[#215442] text-white hover:bg-[#183b2f]"
          >
            {loginMutation.isPending || isRedirecting ? "A entrar..." : "Entrar"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
