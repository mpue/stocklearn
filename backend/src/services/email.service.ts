import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EmailSettings {
  appUrl: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpFromEmail?: string;
  smtpFromName?: string;
}

async function getEmailSettings(): Promise<EmailSettings> {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password',
          'smtp_secure', 'smtp_from_email', 'smtp_from_name', 'app_url'
        ]
      }
    }
  });

  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  return {
    appUrl: settingsMap['app_url'] || process.env.FRONTEND_URL || 'http://localhost:3005',
    smtpHost: settingsMap['smtp_host'],
    smtpPort: settingsMap['smtp_port'] ? parseInt(settingsMap['smtp_port']) : undefined,
    smtpUser: settingsMap['smtp_user'],
    smtpPassword: settingsMap['smtp_password'],
    smtpSecure: settingsMap['smtp_secure'] === 'true',
    smtpFromEmail: settingsMap['smtp_from_email'],
    smtpFromName: settingsMap['smtp_from_name'] || 'StockLearn',
  };
}

async function createTransporter(): Promise<nodemailer.Transporter> {
  const settings = await getEmailSettings();

  // Check if SMTP is configured in database settings
  if (settings.smtpHost && settings.smtpPort) {
    // Use configured SMTP server
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } else {
    // Fallback: Use Ethereal Email for testing
    console.log('⚠️  SMTP not configured in settings, using Ethereal Email for testing');
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

export async function sendMagicLink(email: string, token: string, username: string) {
  const settings = await getEmailSettings();
  const transporter = await createTransporter();

  const magicLink = `${settings.appUrl}/auth/verify?token=${token}`;

  const mailOptions = {
    from: `"${settings.smtpFromName}" <${settings.smtpFromEmail || settings.smtpUser || 'noreply@stocklearn.com'}>`,
    to: email,
    subject: '🔐 Dein Magic Link für StockLearn',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 10px;
              padding: 40px;
              text-align: center;
            }
            .content {
              background: white;
              border-radius: 8px;
              padding: 30px;
              margin-top: 20px;
            }
            h1 {
              color: white;
              margin: 0 0 10px 0;
            }
            .chess-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              text-decoration: none;
              padding: 15px 40px;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
              font-size: 16px;
            }
            .button:hover {
              background: #5568d3;
            }
            .footer {
              color: rgba(255, 255, 255, 0.8);
              font-size: 14px;
              margin-top: 20px;
            }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 6px;
              padding: 15px;
              margin-top: 20px;
              font-size: 14px;
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="chess-icon">♟️</div>
            <h1>StockLearn</h1>
            <div class="content">
              <h2>Hallo ${username}! 👋</h2>
              <p>Du hast einen Magic Link für StockLearn angefordert.</p>
              <p>Klicke auf den Button unten, um dich anzumelden:</p>
              <a href="${magicLink}" class="button">
                🔐 Jetzt anmelden
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Oder kopiere diesen Link in deinen Browser:
              </p>
              <p style="word-break: break-all; color: #667eea; font-size: 12px;">
                ${magicLink}
              </p>
              <div class="warning">
                ⏰ Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.
              </div>
            </div>
            <div class="footer">
              <p>Du hast diesen Link nicht angefordert? Ignoriere diese E-Mail einfach.</p>
              <p style="margin-top: 10px; font-size: 12px;">
                © 2026 StockLearn - Schach lernen mit KI
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hallo ${username}!

Du hast einen Magic Link für StockLearn angefordert.

Klicke auf diesen Link, um dich anzumelden:
${magicLink}

Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.

Du hast diesen Link nicht angefordert? Ignoriere diese E-Mail einfach.

© 2026 StockLearn - Schach lernen mit KI
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // Log preview URL for Ethereal Email (testing)
  if (!settings.smtpHost) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  SMTP NICHT KONFIGURIERT - Magic Link für Development:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Benutzer:', username, `(${email})`);
    console.log('🔐 Magic Link URL:');
    console.log('   ', magicLink);
    console.log('');
    console.log('📬 Ethereal Email Vorschau:');
    console.log('   ', nodemailer.getTestMessageUrl(info));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.log('📧 Magic Link Email gesendet an:', email);
  }

  return info;
}
