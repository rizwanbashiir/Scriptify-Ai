import { Resend } from "resend";

let resend;

/**
 * Send an email
 * @param {{ to: string, subject: string, html: string }} options
 */
export const sendEmail = async ({ to, subject, html }) => {
  console.log("at line 10")
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  console.log("at line 14")
  const { data, error } = await resend.emails.send({
    // from: `Scriptify AI <${process.env.EMAIL_USER}>`,
    //from: "Scriptify AI <onboarding@resend.dev>",
    from: `Scriptify AI <${process.env.EMAIL_FROM}>`,

    to,
    subject,
    html,
  });
  console.log("at line 21")

  if (error) {
    console.error("Failed to send email:", error);
    throw new Error(error.message);
  }

  return data;
};