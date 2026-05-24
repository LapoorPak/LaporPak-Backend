export type AuthOtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

export interface AuthOtpEmailPayload {
  email: string;
  otp: string;
  type: AuthOtpType;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}
