import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const prisma = new PrismaClient();
const router = Router();

// ==================== SETUP (no auth required) ====================

// Check if any admin user exists (public endpoint for installer)
router.get('/setup/status', async (_req, res) => {
  try {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    res.json({ needsSetup: adminCount === 0 });
  } catch (error) {
    console.error('Setup status check error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Create initial admin user (only works if no admin exists yet)
router.post('/setup/create-admin', async (req, res) => {
  try {
    // Guard: only allow if no admin exists
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount > 0) {
      return res.status(403).json({ error: 'Setup already completed. An admin user already exists.' });
    }

    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'E-Mail, Benutzername und Passwort sind erforderlich.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      // If user exists, promote to admin
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { isAdmin: true },
        select: { id: true, email: true, username: true, isAdmin: true }
      });
      return res.json({ message: 'Bestehender Benutzer wurde zum Admin befördert.', user: updatedUser });
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        isAdmin: true,
        isActive: true,
      },
      select: { id: true, email: true, username: true, isAdmin: true }
    });

    console.log(`✅ Initial admin user created: ${user.username} (${user.email})`);
    res.json({ message: 'Admin-Benutzer erfolgreich erstellt.', user });
  } catch (error: any) {
    console.error('Setup create admin error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'E-Mail oder Benutzername ist bereits vergeben.' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen des Admin-Benutzers.' });
  }
});

// ==================== INVITE ACCEPT (public, no auth) ====================

// Validate invite token
router.get('/invite/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: { id: true, username: true, email: true, inviteTokenExpiry: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Ungültiger Einladungslink.' });
    }

    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      return res.status(410).json({ error: 'Der Einladungslink ist abgelaufen.' });
    }

    res.json({ valid: true, username: user.username, email: user.email });
  } catch (error) {
    console.error('Invite validate error:', error);
    res.status(500).json({ error: 'Fehler beim Validieren des Einladungslinks.' });
  }
});

// Accept invite and set password
router.post('/invite/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    }

    // Check password strength: at least one uppercase, one lowercase, one digit
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPassword.test(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.' });
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: token }
    });

    if (!user) {
      return res.status(404).json({ error: 'Ungültiger Einladungslink.' });
    }

    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      return res.status(410).json({ error: 'Der Einladungslink ist abgelaufen.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isActive: true,
        inviteToken: null,
        inviteTokenExpiry: null,
      }
    });

    res.json({ message: 'Passwort erfolgreich gesetzt. Sie können sich jetzt anmelden.' });
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(500).json({ error: 'Fehler beim Setzen des Passworts.' });
  }
});

// All remaining admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ==================== USER MANAGEMENT ====================

// List all users with pagination, filtering, sorting
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          isAdmin: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              gamesAsWhite: true,
              gamesAsBlack: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin: Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user
router.put('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { email, username, password, isAdmin, isActive } = req.body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json(user);
  } catch (error: any) {
    console.error('Admin: Error updating user:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email or username already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Toggle user active status
router.patch('/users/:id/toggle-active', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating yourself
    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Admin: Error toggling user active:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin: Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== GAME MANAGEMENT ====================

// List all games with pagination, filtering, sorting
router.get('/games', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const gameType = (req.query.gameType as string) || '';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (gameType) where.gameType = gameType;
    if (search) {
      where.OR = [
        { whitePlayer: { username: { contains: search, mode: 'insensitive' } } },
        { blackPlayer: { username: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        include: {
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
          _count: { select: { moves: true } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.game.count({ where })
    ]);

    res.json({
      games,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin: Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Delete game (admin)
router.delete('/games/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await prisma.move.deleteMany({ where: { gameId: id } });
    await prisma.game.delete({ where: { id } });

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Admin: Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// ==================== BACKUP / RESTORE ====================

// Create backup (export all data as JSON)
router.post('/backup', async (req: AuthRequest, res) => {
  try {
    const [users, games, moves] = await Promise.all([
      prisma.user.findMany(),
      prisma.game.findMany(),
      prisma.move.findMany()
    ]);

    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      data: {
        users,
        games,
        moves
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=stocklearn-backup-${new Date().toISOString().split('T')[0]}.json`);
    res.json(backup);
  } catch (error) {
    console.error('Admin: Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore from backup
router.post('/restore', async (req: AuthRequest, res) => {
  try {
    const { data } = req.body;

    if (!data || !data.users || !data.games || !data.moves) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    // Clear existing data in reverse order of dependencies
    await prisma.move.deleteMany();
    await prisma.game.deleteMany();
    await prisma.user.deleteMany();

    // Restore data
    if (data.users.length > 0) {
      await prisma.user.createMany({ data: data.users, skipDuplicates: true });
    }
    if (data.games.length > 0) {
      await prisma.game.createMany({ data: data.games, skipDuplicates: true });
    }
    if (data.moves.length > 0) {
      await prisma.move.createMany({ data: data.moves, skipDuplicates: true });
    }

    res.json({
      message: 'Backup restored successfully',
      counts: {
        users: data.users.length,
        games: data.games.length,
        moves: data.moves.length
      }
    });
  } catch (error) {
    console.error('Admin: Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Get database stats
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const [userCount, gameCount, moveCount, activeGames, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.game.count(),
      prisma.move.count(),
      prisma.game.count({ where: { status: 'active' } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      users: userCount,
      games: gameCount,
      moves: moveCount,
      activeGames,
      recentUsers
    });
  } catch (error) {
    console.error('Admin: Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ==================== USER CREATION & INVITATION ====================

// Create new user (admin creates user, inactive by default)
router.post('/users', async (req: AuthRequest, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username) {
      return res.status(400).json({ error: 'E-Mail und Benutzername sind erforderlich.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'E-Mail oder Benutzername ist bereits vergeben.' });
    }

    // Generate a random password placeholder (user will set their own on invite accept)
    const tempPassword = password || crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        isActive: false,
        isAdmin: false,
      },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            gamesAsWhite: true,
            gamesAsBlack: true,
          }
        }
      }
    });

    res.json(user);
  } catch (error: any) {
    console.error('Admin: Error creating user:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'E-Mail oder Benutzername ist bereits vergeben.' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers.' });
  }
});

// Send invitation email to user
router.post('/users/:id/invite', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.user.update({
      where: { id },
      data: {
        inviteToken,
        inviteTokenExpiry,
      }
    });

    // Load email settings
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password',
            'smtp_secure', 'smtp_from_email', 'smtp_from_name',
            'invite_email_subject', 'invite_email_template', 'app_url'
          ]
        }
      }
    });

    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    const appUrl = settingsMap['app_url'] || 'http://localhost:3005';
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;

    // Check if SMTP is configured
    if (!settingsMap['smtp_host'] || !settingsMap['smtp_port']) {
      return res.json({
        message: 'Einladungslink erstellt, aber E-Mail-Versand nicht konfiguriert.',
        inviteUrl,
        emailSent: false
      });
    }

    // Try to send email
    try {
      const smtpPort = parseInt(settingsMap['smtp_port'] || '587');
      const smtpSecure = settingsMap['smtp_secure'] === 'true';
      const transporter = nodemailer.createTransport({
        host: settingsMap['smtp_host'],
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: settingsMap['smtp_user'],
          pass: settingsMap['smtp_password'],
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const subject = settingsMap['invite_email_subject'] || 'Willkommen bei Stocklearn!';
      let template = settingsMap['invite_email_template'] ||
        'Hallo {{username}},\n\nfür dich wurde ein Benutzerkonto bei Stocklearn erstellt.\n\nBitte klicke auf den folgenden Link, um dein Passwort zu setzen und deinen Account zu aktivieren:\n\n{{inviteUrl}}\n\nDer Link ist 7 Tage gültig.\n\nViel Spaß beim Schachspielen!';

      // Replace template variables
      template = template.replace(/\{\{username\}\}/g, user.username);
      template = template.replace(/\{\{email\}\}/g, user.email);
      template = template.replace(/\{\{inviteUrl\}\}/g, inviteUrl);

      await transporter.sendMail({
        from: `"${settingsMap['smtp_from_name'] || 'Stocklearn'}" <${settingsMap['smtp_from_email'] || settingsMap['smtp_user']}>`,
        to: user.email,
        subject,
        text: template,
      });

      res.json({
        message: 'Einladung erfolgreich gesendet.',
        inviteUrl,
        emailSent: true
      });
    } catch (emailError: any) {
      console.error('Email send error:', emailError);
      res.json({
        message: 'Einladungslink erstellt, aber E-Mail konnte nicht gesendet werden: ' + emailError.message,
        inviteUrl,
        emailSent: false
      });
    }
  } catch (error) {
    console.error('Admin: Error inviting user:', error);
    res.status(500).json({ error: 'Fehler beim Einladen des Benutzers.' });
  }
});

// ==================== SETTINGS ====================

// Get all settings
router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' }
    });

    // Convert to key-value map, mask password
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => {
      if (s.key === 'smtp_password') {
        settingsMap[s.key] = s.value ? '********' : '';
      } else {
        settingsMap[s.key] = s.value;
      }
    });

    res.json(settingsMap);
  } catch (error) {
    console.error('Admin: Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (bulk upsert)
router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const settingsData: Record<string, string> = req.body;

    const operations = Object.entries(settingsData).map(([key, value]) => {
      // Don't overwrite password with masked value
      if (key === 'smtp_password' && value === '********') {
        return null;
      }
      return prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }).filter(Boolean);

    await Promise.all(operations as any[]);

    res.json({ message: 'Einstellungen gespeichert.' });
  } catch (error) {
    console.error('Admin: Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test SMTP connection
router.post('/settings/test-email', async (req: AuthRequest, res) => {
  try {
    const { to } = req.body;

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure', 'smtp_from_email', 'smtp_from_name']
        }
      }
    });

    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    if (!settingsMap['smtp_host'] || !settingsMap['smtp_port']) {
      return res.status(400).json({ error: 'SMTP-Server ist nicht konfiguriert.' });
    }

    const smtpPort = parseInt(settingsMap['smtp_port'] || '587');
    const smtpSecure = settingsMap['smtp_secure'] === 'true';
    const transporter = nodemailer.createTransport({
      host: settingsMap['smtp_host'],
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for 587/25 (STARTTLS)
      auth: {
        user: settingsMap['smtp_user'],
        pass: settingsMap['smtp_password'],
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000, // 10s timeout
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Verify connection first
    await transporter.verify();

    await transporter.sendMail({
      from: `"${settingsMap['smtp_from_name'] || 'Stocklearn'}" <${settingsMap['smtp_from_email'] || settingsMap['smtp_user']}>`,
      to: to || settingsMap['smtp_user'],
      subject: 'Stocklearn - Test E-Mail',
      text: 'Dies ist eine Test-E-Mail von Stocklearn. Die SMTP-Konfiguration funktioniert korrekt!',
    });

    res.json({ message: 'Test-E-Mail erfolgreich gesendet.' });
  } catch (error: any) {
    console.error('Admin: Error sending test email:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Test-E-Mail: ' + error.message });
  }
});

export default router;
