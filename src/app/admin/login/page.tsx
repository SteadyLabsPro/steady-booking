"use client";

import { useActionState } from "react";
import { login } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form
        action={action}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">
            The Tide House · Admin
          </h1>
          <p className="text-sm text-muted">
            Enter the admin password to continue.
          </p>
        </div>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          className="h-11 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent"
        />
        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
