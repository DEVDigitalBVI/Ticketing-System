import "server-only";

import nodemailer from "nodemailer";

import { getPublicEnvironment } from "@/config/public";
import { getAuthServerEnvironment } from "@/config/server";

type NewAccountEmail = { email: string; displayName: string; temporaryPassword: string };

export async function sendNewAccountEmail(message: NewAccountEmail) {
  const environment = getAuthServerEnvironment();
  const appUrl = getPublicEnvironment().NEXT_PUBLIC_APP_URL;
  const transport = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE,
    requireTLS: !environment.SMTP_SECURE,
    auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transport.sendMail({
    from: environment.SMTP_FROM,
    to: message.email,
    subject: "Your IT Service Desk account",
    text: [
      `Hello ${message.displayName},`,
      "",
      "An IT Service Desk account has been created for you.",
      `Sign in: ${appUrl}/login`,
      `Email: ${message.email}`,
      `Temporary password: ${message.temporaryPassword}`,
      "",
      "Use these credentials for your initial sign-in. You will be required to choose a new password before continuing.",
      "Do not forward this message or share the temporary password.",
    ].join("\n"),
  });
}
