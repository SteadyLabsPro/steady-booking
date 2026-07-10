import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Shown after a successful Stripe pass purchase. The pass itself is created by
 * the webhook; this page just confirms and points the buyer back to booking. */
export default function PassConfirmedPage() {
  const bundle = tenant.bundles[0];
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5eee6] p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight/15 text-highlight">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Payment received — thank you
          </h1>
          <p className="text-sm text-muted">
            Your {bundle ? `${bundle.sessions}-visit ` : ""}pass is ready. We&rsquo;ve
            emailed your confirmation. To use it, book a session with the same
            email and choose &ldquo;Use pass&rdquo;.
          </p>
        </div>
        <Link href="/" className="w-full">
          <Button fullWidth size="lg">
            Book a session
          </Button>
        </Link>
      </div>
    </div>
  );
}
