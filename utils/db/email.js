import nodemailer from "nodemailer";

let transporter;

/**
 * Send an email
 * @param {{ to: string, subject: string, html: string }} options
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  const mailOptions = {
    from: `"Scriptify AI" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};