import type { AuthProvider, VerifyResult } from "@/lib/auth/provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { type ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber, signOut } from "firebase/auth";

export class FirebasePhoneProvider implements AuthProvider {
  provider = "firebase" as const;
  private confirmation: ConfirmationResult | null = null;
  private recaptcha: RecaptchaVerifier | null = null;
  private lastPhone: string | null = null;

  private getAuthWithRecaptcha() {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error("Firebase 설정이 없습니다.");
    }

    if (!this.recaptcha) {
      this.recaptcha = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }

    return { auth, recaptcha: this.recaptcha };
  }

  async signInWithPhone(phone: string) {
    const { auth, recaptcha } = this.getAuthWithRecaptcha();
    this.confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
    this.lastPhone = phone;
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyResult> {
    if (!this.confirmation) {
      throw new Error("OTP를 먼저 요청하세요.");
    }

    const credential = await this.confirmation.confirm(code);
    const idToken = await credential.user.getIdToken();
    this.lastPhone = credential.user.phoneNumber ?? phone;

    return {
      provider: this.provider,
      phone: this.lastPhone,
      idToken,
    };
  }

  async getSession() {
    const auth = getFirebaseAuth();
    const phone = auth?.currentUser?.phoneNumber ?? this.lastPhone;
    return { phone: phone ?? null };
  }

  async signOut() {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }

    this.confirmation = null;
    this.lastPhone = null;
  }

  async getUserPhone() {
    const session = await this.getSession();
    return session?.phone ?? null;
  }
}
