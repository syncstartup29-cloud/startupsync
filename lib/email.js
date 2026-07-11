export const sendEmail = async (to, subject, html) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "StartupSync", email: "syncstartup29@gmail.com" },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    }),
  });
  return response.json();
};

export function getOtpEmailHtml(otp, type = "signup") {
  const isReset = type === "reset";
  const title   = isReset ? "Password Reset OTP" : "Verify Your Email";
  const subtext = isReset
    ? "You requested a password reset for your StartupSync account."
    : "Welcome to StartupSync! Use the OTP below to verify your email and complete signup.";
  const warning = isReset
    ? "If you did not request a password reset, please ignore this email."
    : "If you did not request this OTP, please ignore this email.";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title></head><body style="margin:0;padding:0;background:#F7F7F8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;padding:40px 0;"><tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #E4E4E7;overflow:hidden;max-width:480px;width:100%;"><tr><td style="background:linear-gradient(90deg,#2563EB,#7C3AED);height:4px;"></td></tr><tr><td align="center" style="padding:32px 40px 0;"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:12px;"><img src="https://startupsync.tech/logo.png" alt="StartupSync" width="130" style="display:block;border:0;outline:none;text-decoration:none;width:130px;height:auto;max-width:130px;"/></td></tr><tr><td align="center"><span style="font-size:20px;font-weight:700;color:#2563EB;letter-spacing:0.04em;">StartupSync™</span></td></tr><tr><td align="center" style="padding-top:4px;"><span style="font-size:11px;color:#9CA3AF;letter-spacing:0.04em;">Where Startups Meet Opportunity</span></td></tr></table></td></tr><tr><td align="center" style="padding:28px 40px 0;"><h1 style="margin:0;font-size:22px;font-weight:700;color:#111118;letter-spacing:0.02em;">${title}</h1><p style="margin:10px 0 0;font-size:13px;color:#6B7280;line-height:1.6;max-width:340px;">${subtext}</p></td></tr><tr><td align="center" style="padding:28px 40px;"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#F0F4FF;border-radius:12px;padding:20px 40px;"><p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6B7280;letter-spacing:0.08em;text-transform:uppercase;">Your OTP Code</p><p style="margin:0;font-size:38px;font-weight:700;color:#2563EB;letter-spacing:0.18em;">${otp}</p><p style="margin:8px 0 0;font-size:11px;color:#9CA3AF;">Expires in <strong>5 minutes</strong></p></td></tr></table></td></tr><tr><td style="padding:0 40px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:10px;padding:16px 20px;"><tr><td style="font-size:12px;color:#6B7280;line-height:1.7;"><strong style="color:#374151;">📌 Tips:</strong><br/>• Do not share this OTP with anyone<br/>• Check Spam / Promotions if not in inbox<br/>• ${warning}</td></tr></table></td></tr><tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #E4E4E7;margin:0;"/></td></tr><tr><td align="center" style="padding:20px 40px 32px;"><p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">This email was sent by <strong style="color:#6B7280;">StartupSync</strong><br/>If you did not request this, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
}
