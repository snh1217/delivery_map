"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ExtractorApp } from "@/components/extractor/ExtractorApp";
import type { SessionUser } from "@/types";

export default function ExtractorPage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  return (
    <AuthGate onUser={setUser}>
      <div className="space-y-3">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-end gap-2 px-4 pt-4 sm:px-6">
          <Link
            href="/install/extractor-android"
            className="inline-flex h-10 items-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-900"
          >
            구역 추출기 APK 설치
          </Link>
        </div>
        <ExtractorApp user={user} />
      </div>
    </AuthGate>
  );
}
