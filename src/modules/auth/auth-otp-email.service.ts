import nodemailer from "nodemailer";
import type {
  AuthOtpEmailPayload,
  AuthOtpType,
  EmailMessage,
} from "../../types/authOtp.js";

export type {
  AuthOtpEmailPayload,
  AuthOtpType,
  EmailMessage,
} from "../../types/authOtp.js";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;
const smtpSecure =
  process.env.SMTP_SECURE === undefined
    ? smtpPort === 465
    : process.env.SMTP_SECURE === "true";

let smtpTransporter: nodemailer.Transporter | null = null;

function getOtpCopy(type: AuthOtpType) {
  switch (type) {
    case "email-verification":
      return {
        subject: "Kode verifikasi email LaporPak",
        title: "Verifikasi email kamu",
        description:
          "Masukkan kode berikut di halaman verifikasi untuk mengaktifkan akun LaporPak kamu.",
      };
    case "forget-password":
      return {
        subject: "Kode reset password LaporPak",
        title: "Reset password akun",
        description:
          "Masukkan kode berikut untuk melanjutkan proses reset password akun LaporPak kamu.",
      };
    case "change-email":
      return {
        subject: "Konfirmasi perubahan email LaporPak",
        title: "Konfirmasi email baru",
        description:
          "Masukkan kode berikut untuk menyelesaikan perubahan alamat email akun LaporPak kamu.",
      };
    case "sign-in":
      return {
        subject: "Kode login LaporPak",
        title: "Kode login sekali pakai",
        description:
          "Masukkan kode berikut untuk login ke akun LaporPak kamu.",
      };
    default:
      return {
        subject: "Kode keamanan LaporPak",
        title: "Kode keamanan akun",
        description: "Masukkan kode berikut untuk melanjutkan proses autentikasi akun kamu.",
      };
  }
}

function buildEmailMessage(payload: AuthOtpEmailPayload): EmailMessage {
  const copy = getOtpCopy(payload.type);

  return {
    to: payload.email,
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.description}\n\nKode verifikasi: ${payload.otp}\nKode ini berlaku selama 5 menit.\n\nJika kamu tidak merasa meminta kode ini, abaikan email ini.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
        <h1 style="font-size: 24px; margin-bottom: 12px;">${copy.title}</h1>
        <p style="margin: 0 0 16px;">${copy.description}</p>
        <div style="margin: 24px 0; padding: 16px; border-radius: 12px; background: #f3f4f6; text-align: center;">
          <span style="font-size: 32px; letter-spacing: 8px; font-weight: 700;">${payload.otp}</span>
        </div>
        <p style="margin: 0 0 8px;">Kode ini berlaku selama 5 menit.</p>
        <p style="margin: 0; color: #6b7280;">Jika kamu tidak merasa meminta kode ini, abaikan email ini.</p>
      </div>
    `.trim(),
  };
}

function getSmtpTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return null;
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return smtpTransporter;
}

async function sendViaSmtp(message: EmailMessage) {
  const transporter = getSmtpTransporter();

  if (!transporter) {
    throw new Error("Konfigurasi SMTP belum lengkap.");
  }

  await transporter.sendMail({
    from: smtpFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export async function sendAuthOtpEmail(payload: AuthOtpEmailPayload) {
  if (payload.type === "sign-in") {
    console.warn(
      "[AUTH OTP] Permintaan OTP untuk passwordless sign-in diabaikan karena flow tersebut tidak diaktifkan.",
      JSON.stringify({
        email: payload.email,
        type: payload.type,
      }),
    );
    return;
  }

  const message = buildEmailMessage(payload);

  await sendViaSmtp(message);
}
