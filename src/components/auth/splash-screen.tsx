import { Logo } from "@/components/layout/logo";

export function SplashScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-dvh items-center justify-center">
      <Logo withWordmark={false} className="animate-pulse [&>span:first-child]:size-12 [&>span:first-child]:rounded-2xl" />
    </div>
  );
}
