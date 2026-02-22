"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/types";

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  onUser?: (user: SessionUser) => void;
};

export function AuthGate({ children, requireAdmin = false, onUser }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const response = await fetch("/api/auth/allowlist", { cache: "no-store" });
      if (!mounted) {
        return;
      }

      if (!response.ok) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const payload = (await response.json()) as { user: SessionUser };
      if (requireAdmin && !payload.user.isAdmin) {
        router.replace("/app");
        return;
      }

      onUser?.(payload.user);
      setReady(true);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [onUser, pathname, requireAdmin, router]);

  if (!ready) {
    return <div className="min-h-screen p-6 text-sm text-slate-600">권한 확인 중...</div>;
  }

  return <>{children}</>;
}
