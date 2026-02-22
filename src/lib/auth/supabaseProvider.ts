import type { AuthProvider, VerifyResult } from "@/lib/auth/provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export class SupabasePhoneProvider implements AuthProvider {
  provider = "supabase" as const;
  private lastPhone: string | null = null;

  async signInWithPhone(phone: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase 브라우저 설정이 없습니다.");
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      throw new Error(error.message);
    }

    this.lastPhone = phone;
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyResult> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase 브라우저 설정이 없습니다.");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? "OTP 인증 실패");
    }

    this.lastPhone = data.user?.phone ?? phone;

    return {
      provider: this.provider,
      phone: this.lastPhone,
      accessToken: data.session.access_token,
    };
  }

  async getSession() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }

    const { data } = await supabase.auth.getSession();
    return { phone: data.session?.user.phone ?? null };
  }

  async signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }

    this.lastPhone = null;
  }

  async getUserPhone() {
    const session = await this.getSession();
    return session?.phone ?? this.lastPhone;
  }
}
