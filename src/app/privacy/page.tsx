import type { Metadata } from "next";
import { tenant } from "@/config/tenant.config";
import { LegalShell, LegalSection } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: `Privacy Policy · ${tenant.name}`,
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
      <p>
        This policy explains how {tenant.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects and uses your personal information when you book and use our
        sauna and cold plunge facilities at {tenant.address}.
      </p>

      <LegalSection heading="Information we collect">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Your name, email address and phone number.</li>
          <li>Your booking details (date, time, number of guests).</li>
          <li>
            Your acknowledgement of our health &amp; safety waiver, and the name
            you sign it with.
          </li>
          <li>
            Payment is processed by Stripe. We do not see or store your full card
            details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use it">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>To manage your booking and hold your space.</li>
          <li>To send you booking and purchase confirmations by email.</li>
          <li>To keep a record that you have agreed to the waiver terms.</li>
          <li>To contact you about your booking if we need to.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <p>
          We only share your information with the service providers that make
          this booking service work:
        </p>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
          <li>Stripe — to take payment securely.</li>
          <li>Resend — to send confirmation emails.</li>
          <li>Supabase — to host our booking data.</li>
        </ul>
        <p className="mt-1">We do not sell your information to anyone.</p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          We keep your booking and waiver records for as long as needed to run
          the business and meet our legal and insurance obligations, after which
          they are securely deleted.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can ask us for a copy of the information we hold about you, ask us
          to correct it, or ask us to delete it. To do so, or if you have any
          questions about this policy, contact us at{" "}
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="font-medium text-accent hover:underline"
          >
            {tenant.contactEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
