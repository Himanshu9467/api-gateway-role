import net from "node:net";
import tls from "node:tls";
import { env } from "../config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      JSON.stringify({
        event: "email.sent.console",
        provider: "console",
        to: message.to,
        subject: message.subject,
        text: message.text
      })
    );
  }
}

export class SMTPEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (!env.SMTP_HOST) {
      throw new Error("SMTP_HOST is required when EMAIL_PROVIDER=smtp");
    }
    const socket = await connectSmtp(env.SMTP_HOST, env.SMTP_PORT, env.SMTP_SECURE);
    try {
      await expectLine(socket);
      await writeCommand(socket, `EHLO ${hostname()}`);
      if (env.SMTP_USER && env.SMTP_PASSWORD) {
        await writeCommand(socket, "AUTH LOGIN");
        await writeCommand(socket, Buffer.from(env.SMTP_USER).toString("base64"));
        await writeCommand(socket, Buffer.from(env.SMTP_PASSWORD).toString("base64"));
      }
      await writeCommand(socket, `MAIL FROM:<${env.EMAIL_FROM}>`);
      await writeCommand(socket, `RCPT TO:<${message.to}>`);
      await writeCommand(socket, "DATA");
      socket.write(renderMime(message));
      await expectLine(socket);
      await writeCommand(socket, "QUIT");
    } finally {
      socket.destroy();
    }
  }
}

export class SESEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (!env.SES_REGION) {
      throw new Error("SES_REGION is required when EMAIL_PROVIDER=ses");
    }
    console.log(
      JSON.stringify({
        event: "email.sent.ses.requested",
        provider: "ses",
        region: env.SES_REGION,
        to: message.to,
        subject: message.subject
      })
    );
  }
}

export function createEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "smtp") return new SMTPEmailProvider();
  if (env.EMAIL_PROVIDER === "ses") return new SESEmailProvider();
  return new ConsoleEmailProvider();
}

export const emailProvider = createEmailProvider();

export async function sendVerificationEmail(input: { email: string; name: string; token: string }): Promise<void> {
  const url = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(input.token)}`;
  await emailProvider.send({
    to: input.email,
    subject: "Verify your email",
    text: `Hi ${input.name}, verify your email: ${url}`,
    html: `<p>Hi ${escapeHtml(input.name)},</p><p><a href="${url}">Verify your email</a></p>`
  });
}

export async function sendPasswordResetEmail(input: { email: string; name: string; token: string }): Promise<void> {
  const url = `${env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(input.token)}`;
  await emailProvider.send({
    to: input.email,
    subject: "Reset your password",
    text: `Hi ${input.name}, reset your password: ${url}`,
    html: `<p>Hi ${escapeHtml(input.name)},</p><p><a href="${url}">Reset your password</a></p>`
  });
}

export async function sendOperationalNotification(input: { to: string; subject: string; text: string }): Promise<void> {
  await emailProvider.send(input);
}

function renderMime(message: EmailMessage): string {
  const headers = [
    `From: ${env.EMAIL_FROM}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    message.html ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8"
  ];
  return `${headers.join("\r\n")}\r\n\r\n${message.html ?? message.text}\r\n.\r\n`;
}

function connectSmtp(host: string, port: number, secure: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect(port, host) : net.connect(port, host);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function writeCommand(socket: net.Socket, command: string): Promise<string> {
  socket.write(`${command}\r\n`);
  return expectLine(socket);
}

function expectLine(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (data: Buffer) => {
      cleanup();
      resolve(data.toString("utf8"));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.once("data", onData);
    socket.once("error", onError);
  });
}

function hostname(): string {
  return env.SERVICE_NAME.replace(/[^a-zA-Z0-9.-]/g, "") || "api-gateway";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return replacements[char] ?? char;
  });
}
