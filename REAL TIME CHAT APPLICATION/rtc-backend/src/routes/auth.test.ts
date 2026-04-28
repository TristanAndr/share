import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import authRouter from './auth';

jest.mock('../db', () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn()
  }
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

import prisma from '../db';

function getHandler(router: any, method: string, path: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route.stack[0].handle;
}

const signupHandler = getHandler(authRouter, 'post', '/auth/signup');
const loginHandler = getHandler(authRouter, 'post', '/auth/login');

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── signup ───────────────────────────────────────────────────────────────────

describe('POST /auth/signup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 if fields are missing', async () => {
    const req: any = { body: { email: 'a@a.com' } };
    const res = makeRes();
    await signupHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing fields' });
  });

  it('returns token and user on success', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 1, username: 'alice' });
    (jwt.sign as jest.Mock).mockReturnValue('tok123');

    const req: any = { body: { email: 'a@a.com', username: 'alice', password: 'pass' } };
    const res = makeRes();
    await signupHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      token: 'tok123',
      user: { id: 1, username: 'alice' }
    });
  });

  it('returns 400 if email already exists', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (prisma.user.create as jest.Mock).mockRejectedValue(new Error('unique constraint'));

    const req: any = { body: { email: 'dup@a.com', username: 'bob', password: 'pass' } };
    const res = makeRes();
    await signupHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already exists' });
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if user does not exist', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req: any = { body: { email: 'x@x.com', password: 'pass' } };
    const res = makeRes();
    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 401 if password is wrong', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, username: 'alice', password: 'hashed' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const req: any = { body: { email: 'a@a.com', password: 'wrong' } };
    const res = makeRes();
    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns token and user on success', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, username: 'alice', password: 'hashed' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('tok456');

    const req: any = { body: { email: 'a@a.com', password: 'pass' } };
    const res = makeRes();
    await loginHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      token: 'tok456',
      user: { id: 1, username: 'alice' }
    });
  });
});
