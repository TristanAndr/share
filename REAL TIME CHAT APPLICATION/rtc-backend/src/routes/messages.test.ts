import messagesRouter from './messages';

jest.mock('../db', () => ({
  message: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  reaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  }
}));
jest.mock('../middleware', () => ({
  authMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
  getUserRole: jest.fn()
}));
jest.mock('../io', () => ({
  getIo: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }))
}));

import prisma from '../db';
import { getUserRole } from '../middleware';

// Routes avec authMiddleware ont 2 handlers dans le stack : on prend le dernier
function getHandler(router: any, method: string, path: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  const stack = layer?.route.stack ?? [];
  return stack[stack.length - 1].handle;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const getMessages  = getHandler(messagesRouter, 'get',    '/channels/:id/messages');
const editMessage  = getHandler(messagesRouter, 'put',    '/messages/:id');
const deleteMessage = getHandler(messagesRouter, 'delete', '/messages/:id');
const toggleReaction = getHandler(messagesRouter, 'post',  '/messages/:id/reactions');

// ─── GET /channels/:id/messages ───────────────────────────────────────────────

describe('GET /channels/:id/messages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the list of messages', async () => {
    const fakeMessages = [{ id: 1, content: 'hello' }];
    (prisma as any).message.findMany.mockResolvedValue(fakeMessages);

    const req: any = { params: { id: '1' }, user: { userId: 1 } };
    const res = makeRes();
    await getMessages(req, res);

    expect(res.json).toHaveBeenCalledWith(fakeMessages);
  });

  it('returns 500 on db error', async () => {
    (prisma as any).message.findMany.mockRejectedValue(new Error('db error'));

    const req: any = { params: { id: '1' }, user: { userId: 1 } };
    const res = makeRes();
    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── PUT /messages/:id ────────────────────────────────────────────────────────

describe('PUT /messages/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 if content is missing', async () => {
    const req: any = { params: { id: '1' }, body: {}, user: { userId: 1 } };
    const res = makeRes();
    await editMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Content required' });
  });

  it('returns 404 if message does not exist', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);

    const req: any = { params: { id: '99' }, body: { content: 'edited' }, user: { userId: 1 } };
    const res = makeRes();
    await editMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 if user does not own the message', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: 2, channelId: 10 });

    const req: any = { params: { id: '1' }, body: { content: 'edited' }, user: { userId: 1 } };
    const res = makeRes();
    await editMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('updates and returns the message if user owns it', async () => {
    const updated = { id: 1, content: 'edited', isEdited: true };
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: 1, channelId: 10 });
    (prisma.message.update as jest.Mock).mockResolvedValue(updated);

    const req: any = { params: { id: '1' }, body: { content: 'edited' }, user: { userId: 1 } };
    const res = makeRes();
    await editMessage(req, res);
    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

// ─── DELETE /messages/:id ─────────────────────────────────────────────────────

describe('DELETE /messages/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 if message does not exist', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);

    const req: any = { params: { id: '99' }, user: { userId: 1 } };
    const res = makeRes();
    await deleteMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 if user does not own the message and is not admin/owner', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: 1, userId: 2, channelId: 10, channel: { serverId: 5 }
    });
    (getUserRole as jest.Mock).mockResolvedValue('MEMBER');

    const req: any = { params: { id: '1' }, user: { userId: 1 } };
    const res = makeRes();
    await deleteMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows owner to delete their own message', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: 1, userId: 1, channelId: 10, channel: { serverId: 5 }
    });
    (getUserRole as jest.Mock).mockResolvedValue('MEMBER');
    (prisma as any).reaction.deleteMany.mockResolvedValue({});
    (prisma.message.delete as jest.Mock).mockResolvedValue({});

    const req: any = { params: { id: '1' }, user: { userId: 1 } };
    const res = makeRes();
    await deleteMessage(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('allows ADMIN to delete someone else\'s message', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: 1, userId: 2, channelId: 10, channel: { serverId: 5 }
    });
    (getUserRole as jest.Mock).mockResolvedValue('ADMIN');
    (prisma as any).reaction.deleteMany.mockResolvedValue({});
    (prisma.message.delete as jest.Mock).mockResolvedValue({});

    const req: any = { params: { id: '1' }, user: { userId: 1 } };
    const res = makeRes();
    await deleteMessage(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

// ─── POST /messages/:id/reactions ─────────────────────────────────────────────

describe('POST /messages/:id/reactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 if emoji is missing', async () => {
    const req: any = { params: { id: '1' }, body: {}, user: { userId: 1 } };
    const res = makeRes();
    await toggleReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 if message does not exist', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);

    const req: any = { params: { id: '99' }, body: { emoji: '👍' }, user: { userId: 1 } };
    const res = makeRes();
    await toggleReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the reaction if it already exists', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({ id: 1, channelId: 10 });
    (prisma as any).reaction.findUnique.mockResolvedValue({ id: 5 });
    (prisma as any).reaction.delete.mockResolvedValue({});
    (prisma as any).reaction.findMany.mockResolvedValue([]);

    const req: any = { params: { id: '1' }, body: { emoji: '👍' }, user: { userId: 1 } };
    const res = makeRes();
    await toggleReaction(req, res);

    expect((prisma as any).reaction.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(res.json).toHaveBeenCalledWith({ reactions: [] });
  });

  it('adds the reaction if it does not exist', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({ id: 1, channelId: 10 });
    (prisma as any).reaction.findUnique.mockResolvedValue(null);
    (prisma as any).reaction.create.mockResolvedValue({});
    (prisma as any).reaction.findMany.mockResolvedValue([{ emoji: '👍' }]);

    const req: any = { params: { id: '1' }, body: { emoji: '👍' }, user: { userId: 1 } };
    const res = makeRes();
    await toggleReaction(req, res);

    expect((prisma as any).reaction.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ reactions: [{ emoji: '👍' }] });
  });
});
