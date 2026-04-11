"use client";

import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ExtractorApp } from "@/components/extractor/ExtractorApp";
import type { SessionUser } from "@/types";

export default function ExtractorPage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  return (
    <AuthGate onUser={setUser}>
      <ExtractorApp user={user} />
    </AuthGate>
  );
}
