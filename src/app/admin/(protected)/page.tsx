/**
 * Admin dashboard. 7a is the auth gate only — bookings, revenue, cancel, and
 * manual add arrive in the following sub-stages (7b–7e).
 */
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted">
        You&rsquo;re signed in. Bookings, revenue totals, cancel, and manual
        booking arrive in the next sub-stages.
      </p>
    </div>
  );
}
