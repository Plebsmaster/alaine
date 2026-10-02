import { BottomNav, MobileWorkspaceSwitch, SubNav, TopBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { loadShellData } from "@/lib/data/shell";

// App-shell: bovenbalk + subnavigatie op laptop, onderbalk op telefoon (docs/design/README.md, 1b).
// Schermen zonder navigatie staan in app/(focus); /vandaag zet de focusmodus zelf aan.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase } = await requireUser();
  const shell = await loadShellData(supabase, await getSettings(supabase));
  return (
    <div className="min-h-dvh">
      <TopBar today={shell.today} exam={shell.exam} />
      <SubNav drafts={shell.drafts} />
      <main data-shell-main className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        <MobileWorkspaceSwitch drafts={shell.drafts} />
        {children}
      </main>
      <BottomNav today={shell.today} />
    </div>
  );
}
