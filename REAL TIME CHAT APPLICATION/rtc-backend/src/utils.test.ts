import { dmRoom, getUniqueOnlineUsers } from './utils';

describe('dmRoom', () => {
  it('should format the room name correctly with sorted IDs', () => {
    expect(dmRoom(1, 2)).toBe('dm:1-2');
    expect(dmRoom(10, 5)).toBe('dm:5-10');
  });

  it('should return the same room name regardless of the order of arguments', () => {
    const roomA = dmRoom(123, 456);
    const roomB = dmRoom(456, 123);
    expect(roomA).toBe(roomB);
    expect(roomA).toBe('dm:123-456');
  });

  it('should work with same IDs', () => {
    expect(dmRoom(1, 1)).toBe('dm:1-1');
  });
});

describe('getUniqueOnlineUsers', () => {
  it('should return an empty array if server is not in map', () => {
    const map = new Map();
    expect(getUniqueOnlineUsers(map, 1)).toEqual([]);
  });

  it('should return unique users for a given server', () => {
    const map = new Map<number, Map<string, { userId: number; username: string }>>();
    const server1Map = new Map();
    server1Map.set('socket1', { userId: 1, username: 'user1' });
    server1Map.set('socket2', { userId: 1, username: 'user1' });
    server1Map.set('socket3', { userId: 2, username: 'user2' });
    map.set(1, server1Map);

    const users = getUniqueOnlineUsers(map, 1);
    expect(users).toHaveLength(2);
    expect(users).toContainEqual({ userId: 1, username: 'user1' });
    expect(users).toContainEqual({ userId: 2, username: 'user2' });
  });

  it('should not return users from other servers', () => {
    const map = new Map<number, Map<string, { userId: number; username: string }>>();
    const server1Map = new Map();
    server1Map.set('socket1', { userId: 1, username: 'user1' });
    map.set(1, server1Map);

    const server2Map = new Map();
    server2Map.set('socket2', { userId: 2, username: 'user2' });
    map.set(2, server2Map);

    const users = getUniqueOnlineUsers(map, 1);
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({ userId: 1, username: 'user1' });
  });
});
