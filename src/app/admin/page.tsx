"use client";

import { AuthGate } from "@/components/AuthGate";
import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <AuthGate requireAdmin>
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <AdminPanel />
        </div>
      </main>
    </AuthGate>
  );
}
