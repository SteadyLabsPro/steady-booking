import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Internal design-system preview. Not part of the booking journey — it
 * exists so primitives can be reviewed on a real device. Safe to remove
 * or relocate once the design system stabilises.
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPreviewPage() {
  return (
    <main className="min-h-dvh py-12">
      <Container className="flex flex-col gap-10">
        <header className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Steady Labs · Design system
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Primitives</h1>
        </header>

        <Section title="Button · variants">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </Section>

        <Section title="Button · sizes">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        <Section title="Button · full width & states">
          <div className="flex flex-col gap-3">
            <Button fullWidth>Book now</Button>
            <Button fullWidth variant="outline" disabled>
              Unavailable
            </Button>
          </div>
        </Section>

        <Section title="Card">
          <div className="flex flex-col gap-3">
            <Card>
              <h3 className="text-base font-medium">Static surface</h3>
              <p className="mt-1 text-sm text-muted">
                Groups content — summaries, forms, details.
              </p>
            </Card>
            <Card interactive>
              <h3 className="text-base font-medium">Interactive surface</h3>
              <p className="mt-1 text-sm text-muted">
                Hover / press affordance for selectable options.
              </p>
            </Card>
          </div>
        </Section>
      </Container>
    </main>
  );
}
