import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Gym SaaS <onboarding@example.com>";

  if (!apiKey) {
    console.log("\n📧 EMAIL (dev fallback, RESEND_API_KEY not set):");
    console.log(`  From:    ${from}`);
    console.log(`  To:      ${input.to}`);
    console.log(`  Subject: ${input.subject}`);
    console.log(`  Text:\n${input.text}\n`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export function buildActivationEmail(params: {
  recipientName: string;
  activationUrl: string;
}): { subject: string; html: string; text: string } {
  const { recipientName, activationUrl } = params;
  const subject = "Activez votre compte Gym SaaS";
  const text = `Bonjour ${recipientName},

Votre organisation a été validée. Pour finaliser votre compte, définissez votre mot de passe en cliquant sur le lien ci-dessous :

${activationUrl}

Ce lien expire dans 7 jours.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
  const html = `<p>Bonjour ${recipientName},</p>
<p>Votre organisation a été validée. Pour finaliser votre compte, définissez votre mot de passe :</p>
<p><a href="${activationUrl}">Activer mon compte</a></p>
<p>Ce lien expire dans 7 jours.</p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;
  return { subject, html, text };
}

export function buildRejectionEmail(params: {
  recipientName: string;
  organizationName: string;
  reason: string;
}): { subject: string; html: string; text: string } {
  const subject = "Votre demande Gym SaaS a été refusée";
  const text = `Bonjour ${params.recipientName},

Votre demande d'inscription pour "${params.organizationName}" a été refusée.

Raison : ${params.reason}

Vous pouvez nous contacter pour plus d'informations.`;
  const html = `<p>Bonjour ${params.recipientName},</p>
<p>Votre demande d'inscription pour <strong>${params.organizationName}</strong> a été refusée.</p>
<p>Raison : ${params.reason}</p>`;
  return { subject, html, text };
}
