const API_URL = 'http://localhost:3001';

function getToken(): string {
  return localStorage.getItem('token') ?? '';
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options?.headers ?? {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

// Auth
export const signup = (email: string, username: string, password: string) =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, username, password }) });
export const login = (email: string, password: string) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

// Servers
export const getServers = () => request('/servers');
export const createServer = (name: string) =>
  request('/servers', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteServer = (serverId: number) =>
  request(`/servers/${serverId}`, { method: 'DELETE' });
export const leaveServer = (serverId: number) =>
  request(`/servers/${serverId}/leave`, { method: 'DELETE' });
export const joinServer = (inviteCode: string) =>
  request('/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });

// Members
export const getMembers = (serverId: number) => request(`/servers/${serverId}/members`);
export const updateMemberRole = (serverId: number, userId: number, role: string) =>
  request(`/servers/${serverId}/members/${userId}/role`, {
    method: 'PATCH', body: JSON.stringify({ role })
  });
export const transferOwnership = (serverId: number, userId: number) =>
  request(`/servers/${serverId}/transfer`, { method: 'POST', body: JSON.stringify({ userId }) });
export const kickMember = (serverId: number, userId: number) =>
  request(`/servers/${serverId}/members/${userId}/kick`, { method: 'DELETE' });
export const banMember = (serverId: number, userId: number, duration?: number | null) =>
  request(`/servers/${serverId}/members/${userId}/ban`, {
    method: 'POST', body: JSON.stringify({ duration: duration ?? null })
  });
export const unbanMember = (serverId: number, userId: number) =>
  request(`/servers/${serverId}/bans/${userId}`, { method: 'DELETE' });
export const getBans = (serverId: number) => request(`/servers/${serverId}/bans`);

// Channels
export const createChannel = (serverId: number, name: string) =>
  request(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify({ name }) });
export const deleteChannel = (channelId: number) =>
  request(`/channels/${channelId}`, { method: 'DELETE' });

// GIF
export const searchGifs = (query: string) =>
  request(`/gif/search?q=${encodeURIComponent(query)}&limit=20`);

// Messages
export const getMessages = (channelId: number) => request(`/channels/${channelId}/messages`);
export const editMessage = (messageId: number, content: string) =>
  request(`/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) });
export const deleteMessage = (messageId: number) =>
  request(`/messages/${messageId}`, { method: 'DELETE' });

// Reactions
export const toggleReaction = (messageId: number, emoji: string) =>
  request(`/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });

// Users
export const getUsers = () => request('/users');

// Direct Messages
export const getDMMessages = (userId: number) => request(`/dm/${userId}/messages`);
export const editDMMessage = (messageId: number, content: string) =>
  request(`/dm/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) });
export const deleteDMMessage = (messageId: number) =>
  request(`/dm/messages/${messageId}`, { method: 'DELETE' });
