import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { logout } from "@/lib/admin/actions";

export const metadata: Metadata = {
  title: "Admin · The Tide House",
  robots: { index: false, follow: false },
};

// Guarded admin shell. Every protected page renders inside this, so the auth
// check runs on all of them. The login page lives outside this group.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <span className="font-serif text-lg tracking-wide">
            The Tide House · Admin
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
