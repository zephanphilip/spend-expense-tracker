import { Logo } from "@/components/layout/logo";

export function SplashScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-dvh items-center justify-center">
      <Logo withWordmark={false} size="lg" className="animate-pulse" />
    </div>
  );
}
