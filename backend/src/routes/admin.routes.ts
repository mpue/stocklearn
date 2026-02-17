import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
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

export default router;
