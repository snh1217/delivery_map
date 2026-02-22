"use client";

import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { DeliveryMapApp } from "@/components/DeliveryMapApp";
import type { SessionUser } from "@/types";

export default function MainAppPage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  return (
    <AuthGate onUser={setUser}>
      <DeliveryMapApp sessionUser={user} />
    </AuthGate>
  );
}
