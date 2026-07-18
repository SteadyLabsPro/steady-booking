import type { Metadata } from "next";
import { tenant } from "@/config/tenant.config";
import { formatPrice } from "@/engine";
import { LegalShell, LegalSection } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  const pass = tenant.bundles[0];
  const sessionPrice = formatPrice(
    tenant.pricing.sessionPriceMinor,
    tenant.currency,
  );

  return (
    <LegalShell title="Terms & Conditions" updated="July 2026">
      <p>
        These terms apply to bookings and passes at {tenant.name},{" "}
        {tenant.address}. By booking with us you agree to them.
      </p>

      <LegalSection heading="Bookings & payment">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Sessions are priced from {sessionPrice} per person.</li>
          <li>Your space is confirmed once payment is received.</li>
          <li>
            You must be able to use the facilities safely — please read the
            waiver before booking.
          </li>
        </ul>
      </LegalSection>

      {pass && (
        <LegalSection heading={`${pass.sessions}-visit pass`}>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              A pass costs {formatPrice(pass.priceMinor, tenant.currency)} for{" "}
              {pass.sessions} visits (1 credit = 1 person per session).
            </li>
            {pass.validityMonths > 0 && (
              <li>
                Credits are valid for {pass.validityMonths} months from the date
                of purchase, after which any unused credits expire.
              </li>
            )}
            <li>Passes are non-refundable and non-transferable.</li>
          </ul>
        </LegalSection>
      )}

      <LegalSection heading="Cancellations & refunds">
        <p>
          Bookings are non-refundable. Refunds are only given where agreed with a
          manager. If you need to change or cancel a booking, or wish to request
          a refund, please write to us at{" "}
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="font-medium text-accent hover:underline"
          >
            {tenant.contactEmail}
          </a>{" "}
          and we will consider your request.
        </p>
      </LegalSection>

      <LegalSection heading="Health, safety & conduct">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            All guests must read and agree to our{" "}
            <a
              href={tenant.waiver.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent hover:underline"
            >
              waiver
            </a>{" "}
            before their first visit.
          </li>
          <li>
            When you book for more than one person, you confirm you have shown
            the waiver to everyone in your group and have their consent.
          </li>
          <li>
            We reserve the right to refuse entry or end a session on health,
            safety or conduct grounds, as set out in the waiver.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Liability">
        <p>
          Use of the sauna and cold plunge is at your own risk on the terms set
          out in the waiver, which forms part of these conditions.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
