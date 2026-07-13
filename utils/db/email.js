import { Resend } from "resend";

let resend;

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error("sendEmail requires 'to', 'subject', and 'html'");
  }

  // In dev, skip Resend entirely — OTP is logged by the caller
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] Skipping email to <${to}> | Subject: "${subject}"`);
    return { skipped: true };
  }

  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not set");
  }

  const { data, error } = await resend.emails.send({
    from: `Scriptify AI <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend failed to send email:", { to, subject, error });
    throw new Error(error.message || "Failed to send email");
  }

  return data;
};