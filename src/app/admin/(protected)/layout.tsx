import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/admin-nav";

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
      <header className="border-b border-[#c2a06a]/70 bg-[#f5eee6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tide-house-logo-horizontal.png"
              alt="The Tide House"
              className="block h-8 w-auto md:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tide-house-logo-only.png"
              alt="The Tide House"
              className="hidden h-12 w-auto md:block"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Admin
            </span>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
