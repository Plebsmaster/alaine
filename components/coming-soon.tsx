import { PageHeader, Panel } from "./ui";

export function ComingSoon({ title, phase, children }: { title: string; phase: number; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <Panel className="space-y-2 text-sm">
        <p className="font-medium">Komt in fase {phase}</p>
        <div className="text-muted">{children}</div>
      </Panel>
    </>
  );
}
