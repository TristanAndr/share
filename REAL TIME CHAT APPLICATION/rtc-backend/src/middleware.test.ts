import jwt from 'jsonwebtoken';
import { authMiddleware, getUserRole } from './middleware';
import prisma from './db';

jest.mock('./db', () => ({
  member: {
    findFirst: jest.fn()
  }
}));

const SECRET = process.env.JWT_SECRET || 'MON_SECRET_SUPER_SECURE';

describe('authMiddleware', () => {
  // ... existing tests
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  it('should return 401 if no authorization header is present', async () => {
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and set req.user if token is valid', async () => {
    const payload = { userId: 123 };
    const token = jwt.sign(payload, SECRET);
    req.headers.authorization = `Bearer ${token}`;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject(payload);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getUserRole', () => {
  it('should return the role if member exists', async () => {
    (prisma.member.findFirst as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
    const role = await getUserRole(1, 1);
    expect(role).toBe('ADMIN');
    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { userId: 1, serverId: 1 } });
  });

  it('should return null if member does not exist', async () => {
    (prisma.member.findFirst as jest.Mock).mockResolvedValue(null);
    const role = await getUserRole(1, 1);
    expect(role).toBeNull();
  });
});
