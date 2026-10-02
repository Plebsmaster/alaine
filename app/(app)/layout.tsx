import { BottomNav, SideNav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { signOut } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return (
    <div className="flex min-h-dvh">
      <SideNav signOut={signOut} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
