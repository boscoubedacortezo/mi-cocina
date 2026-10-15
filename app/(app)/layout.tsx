import { ChefHat, LogOut } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-heading font-semibold">
            <ChefHat className="size-5 text-primary" aria-hidden />
            Mi Cocina
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
              <LogOut />
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
