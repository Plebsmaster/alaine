import { FocusBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";

// Focusmodus: geen bovenbalk, subnavigatie of onderbalk (docs/design/README.md, "Focusmodus").
// Casussessie, proeftoets en pretest; URL's zijn gelijk aan die in app/(app).
export default async function FocusLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="min-h-dvh">
      <div data-focus-bar className="mx-auto w-full max-w-[1120px] px-4 md:px-7">
        <FocusBar />
      </div>
      <main data-focus-main className="mx-auto w-full max-w-[820px] px-4 pb-12 pt-2 md:px-6">
        {children}
      </main>
    </div>
  );
}
