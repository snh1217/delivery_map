import type { AuthProviderType } from "@/types";

export type VerifyResult = {
  provider: AuthProviderType;
  phone: string;
  accessToken?: string;
  idToken?: string;
};

export interface AuthProvider {
  provider: AuthProviderType;
  signInWithPhone(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<VerifyResult>;
  getSession(): Promise<{ phone: string | null } | null>;
  signOut(): Promise<void>;
  getUserPhone(): Promise<string | null>;
}

export function resolveAuthProvider(input?: string): AuthProviderType {
  if (input === "firebase") {
    return "firebase";
  }
  if (input === "supabase") {
    return "supabase";
  }

  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "firebase" || process.env.AUTH_PROVIDER === "firebase"
    ? "firebase"
    : "supabase";
}
