import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
