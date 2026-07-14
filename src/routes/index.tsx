import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Puzzle,
  ShieldCheck,
  Stethoscope,
  Layers,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const modules = [
  "Reception", "OPD", "IPD", "Laboratory", "Radiology", "Pharmacy",
  "Inventory", "Billing", "SHA Claims", "Theatre", "ICU", "Maternity",
  "Dental", "Blood Bank", "Kitchen", "HR", "Finance", "AI Assistant",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Afyacore HMIS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Register hospital</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-secondary/40 to-background">
          <div className="container mx-auto px-4 py-24 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> SHA / DHA-ready · Multi-tenant · Modular
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              One platform for every level of hospital in Kenya
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From a two-room clinic to a national referral hospital — install only
              the modules you need. Same platform, same secure backend.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/onboarding">
                <Button size="lg">Onboard a facility</Button>
              </Link>
              <Link to="/hospital">
                <Button size="lg" variant="outline">Hospital admin</Button>
              </Link>
              <Link to="/admin">
                <Button size="lg" variant="ghost">Platform console</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Layers, title: "Multi-tenant", body: "Every hospital, branch and department fully isolated by design." },
              { icon: Puzzle, title: "Modular", body: "Install Reception, Lab, Pharmacy, Theatre… only what the facility offers." },
              { icon: Zap, title: "Self-updating apps", body: "Mobile and desktop clients update from your own backend, no Play Store." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border bg-card p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-secondary/30">
          <div className="container mx-auto px-4 py-20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Available modules
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {modules.map((m) => (
                <span key={m} className="rounded-full border bg-background px-3 py-1 text-sm">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Afyacore HMIS · Built for SHA-verified deployment
        </div>
      </footer>
    </div>
  );
}
