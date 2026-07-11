import { Resend } from "resend";

let resend;

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error("sendEmail requires 'to', 'subject', and 'html'");
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("⚠️ RESEND_API_KEY is not set. Skipping real email delivery.");
      return { skipped: true, reason: "RESEND_API_KEY_MISSING" };
    }
    if (!process.env.EMAIL_FROM) {
      console.warn("⚠️ EMAIL_FROM is not set. Skipping real email delivery.");
      return { skipped: true, reason: "EMAIL_FROM_MISSING" };
    }

    if (!resend) {
      resend = new Resend(process.env.RESEND_API_KEY);
    }

    const { data, error } = await resend.emails.send({
      from: `Scriptify AI <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("❌ Resend failed to send email:", { to, subject, error });
      return { success: false, error };
    }

    console.log(`📧 Email sent successfully to <${to}> | Subject: "${subject}"`);
    return { success: true, data };
  } catch (err) {
    console.error(`❌ Unexpected error sending email to <${to}>:`, err.message);
    return { success: false, error: err.message };
  }
};