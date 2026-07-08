"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/admin/actions";
import { Icon } from "@/components/icons";

/** Admin nav: inline links on desktop, a hamburger dropdown on mobile. */
export function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-5 text-sm md:flex">
        <Link
          href="/admin/tools/qr"
          className="text-muted transition-colors hover:text-foreground"
        >
          QR codes
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-muted transition-colors hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </nav>

      {/* Mobile */}
      <div className="relative md:hidden">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-foreground"
        >
          <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
              <Link
                href="/admin/tools/qr"
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-sm transition-colors hover:bg-subtle"
              >
                QR codes
              </Link>
              <form action={logout} className="border-t border-border">
                <button
                  type="submit"
                  className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-subtle"
                >
                  Log out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}
