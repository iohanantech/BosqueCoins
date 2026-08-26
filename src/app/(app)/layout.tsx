import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopHeader } from "@/components/layout/top-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-neutral-50 pb-20 dark:bg-graphite">
      <TopHeader nome={session.user.name ?? ""} papel={session.user.papel} />
      <main className="px-4 py-4">{children}</main>
      <BottomNav papel={session.user.papel} />
    </div>
  );
}
