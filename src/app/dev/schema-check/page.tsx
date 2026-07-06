import { tenant } from "@/config/tenant.config";
import {
  formatPrice,
  needsWaiver,
  bookedSpaces,
  remainingSpaces,
  type Session,
  type Customer,
  type Booking,
  type Waiver,
} from "@/engine";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";

/**
 * Internal Stage 3 proof — NOT part of the booking journey. It exercises the
 * domain types, tenant config, and engine helpers with mock data so the
 * schema wiring can be verified end to end without a live database. Safe to
 * delete once real data flows in a later stage.
 */

// Mock rows, typed against the domain contracts (compile-time proof).
const mockSession: Session = {
  id: "sess_1",
  serviceId: "svc_1",
  startsAt: "2026-07-10T07:00:00.000Z",
  capacity: 6,
  priceMinor: 2500, // £25.00 — the session's own editable price
  isActive: true,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const mockCustomer: Customer = {
  id: "cus_1",
  email: "swimmer@example.com",
  firstName: "Sam",
  lastName: null,
  phone: null,
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

// Bookings on the session: 2 confirmed + 1 pending consume spots; the
// cancelled booking (3 spots) must NOT consume any capacity.
const mockBookings: Pick<Booking, "quantity" | "status">[] = [
  { quantity: 2, status: "confirmed" },
  { quantity: 1, status: "pending" },
  { quantity: 3, status: "cancelled" },
];

// This customer signed v1 only.
const mockWaivers: Waiver[] = [
  {
    id: "wav_1",
    customerId: mockCustomer.id,
    version: 1,
    signedAt: "2026-07-01T00:00:00.000Z",
    signatureName: "Sam",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function SchemaCheckPage() {
  const signedVersions = mockWaivers.map((w) => w.version);
  const mustSign = needsWaiver(signedVersions, tenant.waiver.version);

  return (
    <main className="min-h-dvh py-12">
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Stage 3 · schema wiring
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Data model check</h1>
        </header>

        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Session price</h2>
          <Row label="priceMinor (stored)" value={String(mockSession.priceMinor)} />
          <Row label="currency (tenant config)" value={tenant.currency} />
          <Row
            label="formatPrice()"
            value={formatPrice(mockSession.priceMinor, tenant.currency)}
          />
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Session capacity</h2>
          <Row label="capacity (max)" value={String(mockSession.capacity)} />
          <Row label="booked (excl. cancelled)" value={String(bookedSpaces(mockBookings))} />
          <Row
            label="remainingSpaces()"
            value={String(remainingSpaces(mockSession.capacity, mockBookings))}
          />
          <p className="pt-1 text-xs text-muted">
            Cancelled booking of 3 spots is ignored — 6 − 3 = 3 remaining.
          </p>
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Waiver policy</h2>
          <Row label="active version (config)" value={String(tenant.waiver.version)} />
          <Row label="customer signed" value={signedVersions.join(", ") || "none"} />
          <Row label="needsWaiver()" value={mustSign ? "true — must sign" : "false — valid"} />
        </Card>
      </Container>
    </main>
  );
}
