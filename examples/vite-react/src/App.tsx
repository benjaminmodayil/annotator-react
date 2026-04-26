const activities = [
  { label: "Design review", value: "3 open notes" },
  { label: "Checkout flow", value: "Needs copy pass" },
  { label: "Dashboard", value: "Ready for QA" },
];

export function App() {
  return (
    <main className="app-shell">
      <HeroSection />
      <section className="content-grid" aria-label="Example content">
        <ReviewQueue />
        <ValidationChecklist />
      </section>
    </main>
  );
}

function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">Source-aware annotations</p>
      <h1 id="hero-title">Mark up live React UI, then paste context into your agent.</h1>
      <p className="lede">
        Use the floating annotator to hover this page, select an element, write a note, and copy a
        source-linked Markdown + JSON payload.
      </p>
      <div className="actions">
        <ActionButton variant="primary">Start annotation pass</ActionButton>
        <ActionButton variant="secondary">Read docs</ActionButton>
      </div>
    </section>
  );
}

function ActionButton({ children, variant }: { children: string; variant: "primary" | "secondary" }) {
  return (
    <button className={variant === "primary" ? "primary-cta" : "secondary-cta"} type="button">
      {children}
    </button>
  );
}

function ReviewQueue() {
  return (
    <article className="card">
      <h2>Review queue</h2>
      <p>Try selecting this card title, body copy, or one of the status rows below.</p>
      <ul className="activity-list">
        {activities.map((activity) => (
          <StatusRow key={activity.label} label={activity.label} value={activity.value} />
        ))}
      </ul>
    </article>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function ValidationChecklist() {
  return (
    <article className="card muted-card">
      <h2>What to verify</h2>
      <ol>
        <ChecklistItem>The register import appears before React imports in src/main.tsx.</ChecklistItem>
        <ChecklistItem>Hovering highlights elements without selecting the overlay itself.</ChecklistItem>
        <ChecklistItem>Saving a note captures source when the React hook is available.</ChecklistItem>
        <ChecklistItem>Collect copies Markdown plus structured JSON.</ChecklistItem>
      </ol>
    </article>
  );
}

function ChecklistItem({ children }: { children: string }) {
  return <li>{children}</li>;
}
