'use client';
import {
  useState, useEffect, useRef, FormEvent, KeyboardEvent
} from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import {
  getServers, createServer, deleteServer, joinServer, leaveServer,
  createChannel, deleteChannel,
  getMessages, editMessage, deleteMessage,
  getMembers, updateMemberRole, transferOwnership, kickMember,
  banMember, unbanMember, getBans, searchGifs,
  getUsers, getDMMessages, editDMMessage, deleteDMMessage
} from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User { id: number; username: string; }

interface Channel { id: number; name: string; serverId: number; }

interface Server {
  id: number; name: string; inviteCode: string;
  channels: Channel[]; userRole: string;
}

interface Member {
  id: number; role: string; userId: number;
  user: { id: number; username: string };
}

interface Message {
  id: number; content: string; isEdited: boolean; isSystem: boolean;
  createdAt: string; userId: number;
  user: { id: number; username: string };
  channelId: number;
}

interface OnlineUser { userId: number; username: string; }

interface GifResult { id: string; url: string; preview: string; title: string; }

interface DirectMessage {
  id: number; content: string; isEdited: boolean;
  createdAt: string; senderId: number; receiverId: number;
  sender: { id: number; username: string };
  receiver: { id: number; username: string };
}

interface Ban {
  id: number;
  userId: number;
  serverId: number;
  bannedById: number;
  expiresAt: string | null;
  createdAt: string;
  user: { id: number; username: string };
  banner: { id: number; username: string };
}

// ─── Modale générique ─────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Members & online
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [onlineList, setOnlineList] = useState<OnlineUser[]>([]);
  // Menu rôle : position fixed pour éviter le clipping overflow
  const [memberMenu, setMemberMenu] = useState<{
    member: Member; top: number; left: number;
  } | null>(null);

  // Dropdown serveur
  const [showServerMenu, setShowServerMenu] = useState(false);

  // Modales
  type ModalType =
    null | 'createServer' | 'joinServer' | 'createChannel'
    | 'deleteServer' | 'leaveServer' | 'invite' | 'manageMembers' | 'confirmTransfer' | 'confirmKick'
    | 'confirmBan' | 'manageBans';
  const [modal, setModal] = useState<ModalType>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [banTarget, setBanTarget] = useState<Member | null>(null);
  const [banDuration, setBanDuration] = useState<string>(''); // vide = permanent
  const [bans, setBans] = useState<Ban[]>([]);

  // GIF picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DM
  const [viewMode, setViewMode] = useState<'server' | 'dm'>('server');
  const [dmUsersList, setDmUsersList] = useState<User[]>([]);
  const [activeDMUser, setActiveDMUser] = useState<User | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInputValue, setDmInputValue] = useState('');
  const [dmEditingId, setDmEditingId] = useState<number | null>(null);
  const [dmEditValue, setDmEditValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const token = useRef('');

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const tk = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!tk || !u) { router.replace('/login'); return; }
    token.current = tk;
    setCurrentUser(JSON.parse(u));

    getServers().then((data: Server[]) => {
      setServers(data);
      if (data.length > 0) {
        setActiveServer(data[0]);
        if (data[0].channels.length > 0) setActiveChannel(data[0].channels[0]);
      }
    }).catch(() => router.replace('/login'));
  }, [router]);

  // ─── Chargement membres quand serveur change ───────────────────────────────

  useEffect(() => {
    if (!activeServer) { setAllMembers([]); setOnlineList([]); return; }
    getMembers(activeServer.id).then(setAllMembers).catch(console.error);
  }, [activeServer?.id]);

  // ─── Socket principal ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;
    const socket = getSocket();

    socket.on('receive_message', (msg: Message) => {
      if (msg.channelId === activeChannel?.id)
        setMessages(prev => [...prev, msg]);
    });

    socket.on('message_updated', (msg: Message) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    socket.on('message_deleted', ({ messageId }: { messageId: number }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socket.on('channel_created', (ch: Channel) => {
      setServers(prev => prev.map(s =>
        s.id === ch.serverId ? { ...s, channels: [...s.channels, ch] } : s
      ));
      setActiveServer(prev =>
        prev?.id === ch.serverId ? { ...prev, channels: [...prev.channels, ch] } : prev
      );
    });

    socket.on('channel_deleted', ({ channelId, serverId }: { channelId: number; serverId: number }) => {
      setServers(prev => prev.map(s =>
        s.id === serverId ? { ...s, channels: s.channels.filter(c => c.id !== channelId) } : s
      ));
      setActiveServer(prev =>
        prev?.id === serverId
          ? { ...prev, channels: prev.channels.filter(c => c.id !== channelId) }
          : prev
      );
      setActiveChannel(prev => prev?.id === channelId ? null : prev);
    });

    socket.on('server_deleted', ({ serverId }: { serverId: number }) => {
      setServers(prev => prev.filter(s => s.id !== serverId));
      setActiveServer(prev => { if (prev?.id === serverId) { setActiveChannel(null); return null; } return prev; });
    });

    socket.on('online_users', ({ serverId, users }: { serverId: number; users: OnlineUser[] }) => {
      if (serverId === activeServer?.id) setOnlineList(users);
    });

    socket.on('user_online', (u: OnlineUser) => {
      setOnlineList(prev => prev.some(x => x.userId === u.userId) ? prev : [...prev, u]);
    });

    socket.on('user_offline', ({ userId }: { userId: number }) => {
      setOnlineList(prev => prev.filter(u => u.userId !== userId));
    });

    socket.on('user_typing', ({ username, channelId }: { username: string; channelId: number }) => {
      if (channelId !== activeChannel?.id) return;
      setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
    });

    socket.on('user_stopped_typing', ({ username, channelId }: { username: string; channelId: number }) => {
      if (channelId !== activeChannel?.id) return;
      setTypingUsers(prev => prev.filter(u => u !== username));
    });

    socket.on('member_role_updated', ({ serverId, userId, role }: { serverId: number; userId: number; role: string }) => {
      setAllMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m));
      if (userId === currentUser.id) {
        setServers(prev => prev.map(s => s.id === serverId ? { ...s, userRole: role } : s));
        setActiveServer(prev => prev?.id === serverId ? { ...prev, userRole: role } : prev);
      }
    });

    socket.on('user_kicked', ({ serverId, userId }: { serverId: number; userId: number }) => {
      setAllMembers(prev => prev.filter(m => m.userId !== userId));
      setOnlineList(prev => prev.filter(u => u.userId !== userId));
      if (userId === currentUser.id) {
        setServers(prev => {
          const next = prev.filter(s => s.id !== serverId);
          setActiveServer(next[0] ?? null);
          setActiveChannel(next[0]?.channels[0] ?? null);
          setMessages([]);
          return next;
        });
      }
    });

    socket.on('user_banned', ({ serverId, userId }: { serverId: number; userId: number }) => {
      setAllMembers(prev => prev.filter(m => m.userId !== userId));
      setOnlineList(prev => prev.filter(u => u.userId !== userId));
      if (userId === currentUser.id) {
        setServers(prev => {
          const next = prev.filter(s => s.id !== serverId);
          setActiveServer(next[0] ?? null);
          setActiveChannel(next[0]?.channels[0] ?? null);
          setMessages([]);
          return next;
        });
      }
    });

    socket.on('receive_dm', (dm: DirectMessage) => {
      if (
        activeDMUser &&
        ((dm.senderId === activeDMUser.id && dm.receiverId === currentUser.id) ||
          (dm.senderId === currentUser.id && dm.receiverId === activeDMUser.id))
      ) {
        setDmMessages(prev => [...prev, dm]);
      }
    });

    socket.on('dm_updated', (dm: DirectMessage) => {
      setDmMessages(prev => prev.map(m => m.id === dm.id ? dm : m));
    });

    socket.on('dm_deleted', ({ messageId }: { messageId: number }) => {
      setDmMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socket.on('ownership_transferred', ({ serverId, newOwnerId, oldOwnerId }: {
      serverId: number; newOwnerId: number; oldOwnerId: number;
    }) => {
      setAllMembers(prev => prev.map(m => {
        if (m.userId === newOwnerId) return { ...m, role: 'OWNER' };
        if (m.userId === oldOwnerId) return { ...m, role: 'ADMIN' };
        return m;
      }));
      if (newOwnerId === currentUser.id) {
        setServers(prev => prev.map(s => s.id === serverId ? { ...s, userRole: 'OWNER' } : s));
        setActiveServer(prev => prev?.id === serverId ? { ...prev, userRole: 'OWNER' } : prev);
      }
      if (oldOwnerId === currentUser.id) {
        setServers(prev => prev.map(s => s.id === serverId ? { ...s, userRole: 'ADMIN' } : s));
        setActiveServer(prev => prev?.id === serverId ? { ...prev, userRole: 'ADMIN' } : prev);
      }
    });

    return () => {
      socket.off('receive_message');
      socket.off('message_updated');
      socket.off('message_deleted');
      socket.off('channel_created');
      socket.off('channel_deleted');
      socket.off('server_deleted');
      socket.off('online_users');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
      socket.off('member_role_updated');
      socket.off('ownership_transferred');
      socket.off('user_kicked');
      socket.off('user_banned');
      socket.off('receive_dm');
      socket.off('dm_updated');
      socket.off('dm_deleted');
    };
  }, [currentUser, activeChannel, activeServer?.id, activeDMUser]);

  // ─── DM : rejoindre la room et charger les messages ───────────────────────

  useEffect(() => {
    if (!activeDMUser || !currentUser) return;
    const socket = getSocket();
    socket.emit('join_dm', { token: token.current, otherUserId: activeDMUser.id });
    getDMMessages(activeDMUser.id).then(setDmMessages).catch(console.error);
  }, [activeDMUser?.id]);

  // ─── Channel change : messages + socket rooms ──────────────────────────────

  useEffect(() => {
    if (!activeChannel) return;
    const socket = getSocket();
    socket.emit('join_channel', activeChannel.id);
    getMessages(activeChannel.id).then(setMessages).catch(console.error);
    setTypingUsers([]);
  }, [activeChannel]);

  // ─── Server change : rejoindre la room serveur ────────────────────────────

  useEffect(() => {
    if (!activeServer) return;
    const socket = getSocket();
    socket.emit('join_server', { serverId: activeServer.id, token: token.current });
  }, [activeServer?.id]);

  // Scroll bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const isAdmin = activeServer?.userRole === 'OWNER' || activeServer?.userRole === 'ADMIN';
  const isOwner = activeServer?.userRole === 'OWNER';

  function canKick(myRole: string, targetRole: string): boolean {
    const order: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
    return (order[myRole] ?? 0) > (order[targetRole] ?? 0);
  }

  function initials(name: string) { return name.slice(0, 2).toUpperCase(); }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function roleBadge(role: string) {
    if (role === 'OWNER') return <span className="role-badge owner">Owner</span>;
    if (role === 'ADMIN') return <span className="role-badge admin">Admin</span>;
    return null;
  }

  function translateSystemMessage(content: string): string {
    if (content === 'system.joined') return t.system.joined;
    if (content === 'system.kicked') return t.system.kicked;
    if (content === 'system.banned_permanent') return t.system.bannedPermanent;
    if (content.startsWith('system.banned_temporary:')) {
      const isoDate = content.slice('system.banned_temporary:'.length);
      const date = new Date(isoDate).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB');
      return `${t.system.bannedTemporary} ${date}`;
    }
    return content;
  }

  function translateError(error: string): string {
    if (error === 'ban_permanent') return t.errors.banPermanent;
    if (error.startsWith('ban_temporary:')) {
      const isoDate = error.slice('ban_temporary:'.length);
      const date = new Date(isoDate).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB');
      return `${t.errors.banTemporary} ${date}`;
    }
    return error;
  }

  function typingText() {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} ${t.chat.isTyping}`;
    if (typingUsers.length === 2) return `${typingUsers[0]} et ${typingUsers[1]} ${t.chat.areTyping}`;
    return `${typingUsers.length} ${t.chat.manyTyping}`;
  }

  // Membres groupés par rôle pour le panneau
  const roleOrder = ['OWNER', 'ADMIN', 'MEMBER'];
  const membersByRole = roleOrder.map(role => ({
    role,
    members: allMembers.filter(m => m.role === role)
  })).filter(g => g.members.length > 0);

  const onlineSet = new Set(onlineList.map(u => u.userId));

  // ─── Sélection serveur ────────────────────────────────────────────────────

  function selectServer(srv: Server) {
    setViewMode('server');
    setActiveDMUser(null);
    setDmMessages([]);
    setActiveServer(srv);
    setShowServerMenu(false);
    setMessages([]);
    setOnlineList([]);
    if (srv.channels.length > 0) setActiveChannel(srv.channels[0]);
    else setActiveChannel(null);
  }

  // ─── Envoi message ────────────────────────────────────────────────────────

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !activeChannel) return;
    getSocket().emit('send_message', {
      token: token.current,
      content: inputValue.trim(),
      channelId: activeChannel.id
    });
    setInputValue('');
    stopTyping();
  }

  // ─── GIF ──────────────────────────────────────────────────────────────────

  function handleGifQueryChange(val: string) {
    setGifQuery(val);
    if (gifSearchTimerRef.current) clearTimeout(gifSearchTimerRef.current);
    if (!val.trim()) { setGifResults([]); return; }
    gifSearchTimerRef.current = setTimeout(async () => {
      setGifLoading(true);
      try {
        const data = await searchGifs(val.trim());
        setGifResults(data.gifs || []);
      } catch { setGifResults([]); }
      finally { setGifLoading(false); }
    }, 400);
  }

  function sendGif(gif: GifResult) {
    if (!activeChannel) return;
    getSocket().emit('send_message', {
      token: token.current,
      content: `[gif]${gif.url}`,
      channelId: activeChannel.id
    });
    setShowGifPicker(false);
    setGifQuery('');
    setGifResults([]);
  }

  // ─── Typing ───────────────────────────────────────────────────────────────

  function handleInputChange(val: string) {
    setInputValue(val);
    if (!activeChannel || !currentUser) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      getSocket().emit('typing_start', { channelId: activeChannel.id, username: currentUser.username });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    if (!isTypingRef.current || !activeChannel || !currentUser) return;
    isTypingRef.current = false;
    getSocket().emit('typing_stop', { channelId: activeChannel.id, username: currentUser.username });
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  }

  // ─── Edit message ─────────────────────────────────────────────────────────

  function startEdit(msg: Message) { setEditingId(msg.id); setEditValue(msg.content); }

  async function submitEdit(id: number) {
    if (!editValue.trim()) return;
    try {
      const updated = await editMessage(id, editValue.trim());
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    } catch (e) { console.error(e); }
    setEditingId(null);
  }

  function handleEditKey(e: KeyboardEvent<HTMLInputElement>, id: number) {
    if (e.key === 'Enter') submitEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  }

  // ─── Delete message ───────────────────────────────────────────────────────

  async function handleDeleteMessage(id: number) {
    try { await deleteMessage(id); } catch (e) { console.error(e); }
  }

  // ─── DM helpers ───────────────────────────────────────────────────────────

  async function openDMMode() {
    setViewMode('dm');
    setActiveServer(null);
    setActiveChannel(null);
    setMessages([]);
    try {
      const data = await getUsers();
      setDmUsersList(data);
    } catch (e) { console.error(e); }
  }

  function selectDMUser(user: User) {
    setActiveDMUser(user);
    setDmMessages([]);
    setDmEditingId(null);
  }

  function sendDM(e: FormEvent) {
    e.preventDefault();
    if (!dmInputValue.trim() || !activeDMUser) return;
    getSocket().emit('send_dm', {
      token: token.current,
      content: dmInputValue.trim(),
      receiverId: activeDMUser.id
    });
    setDmInputValue('');
  }

  async function submitDMEdit(id: number) {
    if (!dmEditValue.trim()) return;
    try {
      const updated = await editDMMessage(id, dmEditValue.trim());
      setDmMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    } catch (e) { console.error(e); }
    setDmEditingId(null);
  }

  async function handleDeleteDM(id: number) {
    try { await deleteDMMessage(id); } catch (e) { console.error(e); }
  }

  // ─── Modales helpers ──────────────────────────────────────────────────────

  function openModal(type: ModalType) {
    setModal(type);
    setModalInput('');
    setModalError('');
    setShowServerMenu(false);
  }

  // ─── Server actions ───────────────────────────────────────────────────────

  async function handleCreateServer() {
    if (!modalInput.trim()) return;
    try {
      const srv: Server = await createServer(modalInput.trim());
      setServers(prev => [...prev, srv]);
      selectServer(srv);
      setModal(null);
    } catch (err: any) { setModalError(err.message); }
  }

  async function handleJoinServer() {
    if (!modalInput.trim()) return;
    try {
      const srv: Server = await joinServer(modalInput.trim());
      setServers(prev => [...prev, srv]);
      selectServer(srv);
      setModal(null);
    } catch (err: any) { setModalError(translateError(err.message)); }
  }

  async function handleDeleteServer() {
    if (!activeServer) return;
    try {
      await deleteServer(activeServer.id);
      const next = servers.filter(s => s.id !== activeServer.id);
      setServers(next);
      setActiveServer(next[0] ?? null);
      setActiveChannel(next[0]?.channels[0] ?? null);
      setMessages([]);
      setModal(null);
    } catch (err: any) { setModalError(err.message); }
  }

  async function handleLeaveServer() {
    if (!activeServer) return;
    try {
      await leaveServer(activeServer.id);
      const next = servers.filter(s => s.id !== activeServer.id);
      setServers(next);
      setActiveServer(next[0] ?? null);
      setActiveChannel(next[0]?.channels[0] ?? null);
      setMessages([]);
      setModal(null);
    } catch (err: any) { setModalError(err.message); }
  }

  // ─── Channel actions ──────────────────────────────────────────────────────

  async function handleCreateChannel() {
    if (!modalInput.trim() || !activeServer) return;
    try {
      await createChannel(activeServer.id, modalInput.trim());
      setModal(null);
    } catch (err: any) { setModalError(err.message); }
  }

  async function handleDeleteChannel(ch: Channel) {
    try { await deleteChannel(ch.id); } catch (e) { console.error(e); }
  }

  // ─── Role management ──────────────────────────────────────────────────────

  async function handleChangeRole(member: Member, newRole: string) {
    if (!activeServer) return;
    try {
      await updateMemberRole(activeServer.id, member.userId, newRole);
    } catch (e) { console.error(e); }
    setMemberMenu(null);
  }

  async function handleKickMember() {
    if (!activeServer || !kickTarget) return;
    try {
      await kickMember(activeServer.id, kickTarget.userId);
      setModal(null);
      setKickTarget(null);
    } catch (err: any) { setModalError(err.message); }
  }

  async function handleBanMember() {
    if (!activeServer || !banTarget) return;
    try {
      const duration = banDuration.trim() !== '' ? Number(banDuration) : null;
      await banMember(activeServer.id, banTarget.userId, duration);
      setModal(null);
      setBanTarget(null);
      setBanDuration('');
    } catch (err: any) { setModalError(err.message); }
  }

  async function openManageBans() {
    if (!activeServer) return;
    try {
      const data = await getBans(activeServer.id);
      setBans(data);
      openModal('manageBans');
    } catch (e) { console.error(e); }
  }

  async function handleUnban(userId: number) {
    if (!activeServer) return;
    try {
      await unbanMember(activeServer.id, userId);
      setBans(prev => prev.filter(b => b.userId !== userId));
    } catch (err: any) { setModalError(err.message); }
  }

  async function handleTransferOwnership() {
    if (!activeServer || !transferTarget) return;
    try {
      await transferOwnership(activeServer.id, transferTarget.userId);
      setModal(null);
      setTransferTarget(null);
    } catch (err: any) { setModalError(err.message); }
  }

  // ─── Déconnexion ─────────────────────────────────────────────────────────

  function logout() { localStorage.clear(); router.replace('/login'); }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!currentUser) return null;

  return (
    <div className="chat-app">

      {/* ── Col 1 : icônes serveurs ─────────────────────────────────────── */}
      <nav className="server-sidebar">
        <button
          className={`server-icon${viewMode === 'dm' ? ' active' : ''}`}
          onClick={openDMMode}
          title={t.dm.title}
          style={{ fontSize: 16 }}
        >💬</button>
        <div className="server-divider" />
        {servers.map(srv => (
          <button
            key={srv.id}
            className={`server-icon${viewMode === 'server' && activeServer?.id === srv.id ? ' active' : ''}`}
            onClick={() => selectServer(srv)}
            title={srv.name}
          >
            {initials(srv.name)}
          </button>
        ))}
        <div className="server-divider" />
        <button className="server-icon server-icon-add" onClick={() => openModal('createServer')} title={t.chat.createServer}>+</button>
        <button className="server-icon" onClick={() => openModal('joinServer')} title={t.chat.joinServer} style={{ fontSize: 12 }}>🔗</button>
      </nav>

      {/* ── Col 2 : channels / DM list ──────────────────────────────────── */}
      <aside className="channel-sidebar">
        {viewMode === 'dm' ? (
          <>
            <div className="channel-sidebar-header">
              <span className="server-name">{t.dm.title}</span>
            </div>
            <div className="channel-sidebar-body">
              <div className="channel-section-label">
                <span>{t.dm.allUsers}</span>
              </div>
              {dmUsersList.map(u => (
                <div
                  key={u.id}
                  className={`channel-item${activeDMUser?.id === u.id ? ' active' : ''}`}
                  onClick={() => selectDMUser(u)}
                >
                  <div className="member-avatar" style={{ width: 28, height: 28, borderRadius: '50%', background: '#7289da', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {initials(u.username)}
                  </div>
                  <span className="channel-item-name">{u.username}</span>
                </div>
              ))}
              {dmUsersList.length === 0 && (
                <div style={{ padding: '8px 16px', fontSize: 13, color: '#72767d' }}>Aucun autre utilisateur</div>
              )}
            </div>
            <div className="channel-sidebar-footer">
              <div className="user-avatar">{initials(currentUser.username)}</div>
              <div className="user-info">
                <div className="username">{currentUser.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <LanguageSwitcher />
                <button className="btn-logout" onClick={logout} title={t.chat.logout}>⏻</button>
              </div>
            </div>
          </>
        ) : activeServer ? (
          <>
            {/* En-tête serveur */}
            <div
              className="channel-sidebar-header"
              style={{ cursor: 'pointer', position: 'relative' }}
              onClick={e => { e.stopPropagation(); setShowServerMenu(v => !v); }}
            >
              <span className="server-name">{activeServer.name}</span>
              <span style={{ color: '#96989d', fontSize: 12 }}>▼</span>
              {showServerMenu && (
                <div className="server-dropdown" onClick={e => e.stopPropagation()}>
                  {isAdmin && (
                    <button onClick={() => openModal('invite')}>{t.chat.copyInvite}</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => openModal('createChannel')}>{t.chat.createChannel}</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => openModal('manageMembers')}>{t.chat.manageMembers}</button>
                  )}
                  {isAdmin && (
                    <button onClick={openManageBans}>{t.chat.manageBans}</button>
                  )}
                  {!isOwner && (
                    <button className="danger" onClick={() => openModal('leaveServer')}>{t.chat.leaveServer}</button>
                  )}
                  {isAdmin && (
                    <button className="danger" onClick={() => openModal('deleteServer')}>{t.chat.deleteServer}</button>
                  )}
                </div>
              )}
            </div>

            {/* Rôle */}
            <div style={{ padding: '4px 16px 8px', fontSize: 12, color: '#72767d' }}>
              {roleBadge(activeServer.userRole) ?? <span>{t.chat.member}</span>}
            </div>

            {/* Liste channels */}
            <div className="channel-sidebar-body">
              <div className="channel-section-label">
                <span>{t.chat.channels}</span>
                {isAdmin && (
                  <button className="icon-btn" onClick={() => openModal('createChannel')} title={t.chat.create}>+</button>
                )}
              </div>
              {activeServer.channels.map(ch => (
                <div
                  key={ch.id}
                  className={`channel-item${activeChannel?.id === ch.id ? ' active' : ''}`}
                  onClick={() => setActiveChannel(ch)}
                >
                  <span style={{ color: '#96989d' }}>#</span>
                  <span className="channel-item-name">{ch.name}</span>
                  {isAdmin && (
                    <div className="channel-item-actions">
                      <button
                        className="icon-btn danger"
                        onClick={e => { e.stopPropagation(); handleDeleteChannel(ch); }}
                        title={t.chat.deleteChannel}
                      >✕</button>
                    </div>
                  )}
                </div>
              ))}
              {activeServer.channels.length === 0 && (
                <div style={{ padding: '8px 16px', fontSize: 13, color: '#72767d' }}>{t.chat.noChannel}</div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 16, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: '#72767d', textAlign: 'center' }}>
              {t.chat.joinOrCreate}
            </p>
          </div>
        )}

        {/* Pied utilisateur (mode serveur uniquement) */}
        {viewMode === 'server' && (
          <div className="channel-sidebar-footer">
            <div className="user-avatar">{initials(currentUser.username)}</div>
            <div className="user-info">
              <div className="username">{currentUser.username}</div>
              <div className="tag">{activeServer ? roleBadge(activeServer.userRole) ?? t.chat.member : t.chat.online}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <LanguageSwitcher />
              <button className="btn-logout" onClick={logout} title={t.chat.logout}>⏻</button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Col 3 : chat ────────────────────────────────────────────────── */}
      <main className="chat-main">
        {viewMode === 'dm' && activeDMUser ? (
          <>
            <div className="chat-header">
              <span style={{ marginRight: 8 }}>💬</span>
              <span>{activeDMUser.username}</span>
            </div>
            <div className="chat-messages">
              {dmMessages.length === 0 && (
                <div className="empty-state" style={{ flex: 1 }}>
                  <p>{t.dm.noMessages}</p>
                </div>
              )}
              {dmMessages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className="message-group">
                    <div className="message-avatar">{initials(msg.sender.username)}</div>
                    <div className="message-body">
                      <div className="message-header">
                        <span className="message-author">{msg.sender.username}</span>
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                      </div>
                      {dmEditingId === msg.id ? (
                        <>
                          <input
                            className="edit-input"
                            value={dmEditValue}
                            onChange={e => setDmEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitDMEdit(msg.id);
                              if (e.key === 'Escape') setDmEditingId(null);
                            }}
                            autoFocus
                          />
                          <div className="edit-hint">{t.chat.editHint}</div>
                        </>
                      ) : msg.content.startsWith('[gif]') ? (
                        <div className="message-content">
                          <img className="message-gif" src={msg.content.slice(5)} alt="GIF" loading="lazy" />
                        </div>
                      ) : (
                        <div className={`message-content${msg.isEdited ? ' edited' : ''}`}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                    <div className="message-actions">
                      {isMe && dmEditingId !== msg.id && (
                        <button className="icon-btn" title={t.chat.editMessage} onClick={() => { setDmEditingId(msg.id); setDmEditValue(msg.content); }}>✏️</button>
                      )}
                      {isMe && (
                        <button className="icon-btn danger" title={t.chat.deleteMessage} onClick={() => handleDeleteDM(msg.id)}>🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
              <form className="chat-input-wrapper" onSubmit={sendDM}>
                <input
                  className="chat-input"
                  placeholder={`${t.dm.placeholder} ${activeDMUser.username}`}
                  value={dmInputValue}
                  onChange={e => setDmInputValue(e.target.value)}
                  autoComplete="off"
                />
                <button className="btn-send" type="submit">➤</button>
              </form>
            </div>
          </>
        ) : viewMode === 'dm' ? (
          <div className="empty-state">
            <h2>{t.dm.title}</h2>
            <p>{t.dm.sendMessage}</p>
          </div>
        ) : activeChannel ? (
          <>
            <div className="chat-header">
              <span className="hash">#</span>
              <span>{activeChannel.name}</span>
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="empty-state" style={{ flex: 1 }}>
                  <p>{t.chat.firstMessage} <strong>#{activeChannel.name}</strong> !</p>
                </div>
              )}
              {messages.map(msg => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="system-message">
                      <span className="system-message-icon">👋</span>
                      <span>
                        <strong style={{ color: '#b9bbbe' }}>{msg.user.username}</strong>{' '}
                        {translateSystemMessage(msg.content)}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="message-group">
                    <div className="message-avatar">{initials(msg.user.username)}</div>
                    <div className="message-body">
                      <div className="message-header">
                        <span className="message-author">{msg.user.username}</span>
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                      </div>
                      {editingId === msg.id ? (
                        <>
                          <input
                            className="edit-input"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => handleEditKey(e, msg.id)}
                            autoFocus
                          />
                          <div className="edit-hint">{t.chat.editHint}</div>
                        </>
                      ) : msg.content.startsWith('[gif]') ? (
                        <div className="message-content">
                          <img
                            className="message-gif"
                            src={msg.content.slice(5)}
                            alt="GIF"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className={`message-content${msg.isEdited ? ' edited' : ''}`}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                    <div className="message-actions">
                      {msg.userId === currentUser.id && editingId !== msg.id && (
                        <button className="icon-btn" title={t.chat.editMessage} onClick={() => startEdit(msg)}>✏️</button>
                      )}
                      {(msg.userId === currentUser.id || isAdmin) && (
                        <button className="icon-btn danger" title={t.chat.deleteMessage} onClick={() => handleDeleteMessage(msg.id)}>🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="typing-indicator">
              {typingText() && <em>{typingText()}</em>}
            </div>

            <div className="chat-input-area">
              {showGifPicker && (
                <div className="gif-picker">
                  <input
                    className="gif-search-input"
                    placeholder={t.chat.gifSearchPlaceholder}
                    value={gifQuery}
                    onChange={e => handleGifQueryChange(e.target.value)}
                    autoFocus
                  />
                  <div className="gif-grid">
                    {gifLoading && <div className="gif-loading">{t.chat.gifLoading}</div>}
                    {!gifLoading && gifResults.map(gif => (
                      <img
                        key={gif.id}
                        className="gif-item"
                        src={gif.preview}
                        alt={gif.title}
                        title={gif.title}
                        onClick={() => sendGif(gif)}
                        loading="lazy"
                      />
                    ))}
                    {!gifLoading && gifQuery && gifResults.length === 0 && (
                      <div className="gif-empty">{t.chat.gifEmpty}</div>
                    )}
                  </div>
                </div>
              )}
              <form className="chat-input-wrapper" onSubmit={sendMessage}>
                <button
                  type="button"
                  className="btn-gif"
                  title="GIF"
                  onClick={() => { setShowGifPicker(v => !v); setGifQuery(''); setGifResults([]); }}
                >GIF</button>
                <input
                  className="chat-input"
                  placeholder={`${t.chat.messagePlaceholder} #${activeChannel.name}`}
                  value={inputValue}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={stopTyping}
                  autoComplete="off"
                />
                <button className="btn-send" type="submit">➤</button>
              </form>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>{activeServer ? t.chat.selectChannel : t.chat.welcome}</h2>
            <p>
              {activeServer
                ? t.chat.clickToChat
                : t.chat.createOrJoin}
            </p>
          </div>
        )}
      </main>

      {/* ── Col 4 : membres ──────────────────────────────────────────────── */}
      {activeServer && (
        <aside className="members-sidebar">
          <div className="members-sidebar-header">
            {t.chat.members} — {allMembers.length}
          </div>
          <div className="members-list">
            {/* En ligne */}
            {onlineList.length > 0 && (
              <>
                <div className="members-group-label">{t.chat.onlineGroup} — {onlineList.length}</div>
                {onlineList.map(u => {
                  const member = allMembers.find(m => m.userId === u.userId);
                  const isMe = u.userId === currentUser.id;
                  return (
                    <div key={u.userId} className="member-item" style={{ position: 'relative' }}>
                      <div className="member-avatar-wrap">
                        <div className="member-avatar">{initials(u.username)}</div>
                        <div className="online-dot" />
                      </div>
                      <span className={`member-name${isMe ? ' self' : ''}`}>
                        {u.username}
                        {member && roleBadge(member.role)}
                      </span>
                      {!isMe && member && (isOwner || canKick(activeServer!.userRole, member.role)) && (
                        <button
                          className="member-actions-btn"
                          onClick={e => {
                            e.stopPropagation();
                            if (memberMenu?.member.userId === u.userId) {
                              setMemberMenu(null);
                            } else {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setMemberMenu({ member, top: rect.bottom + 4, left: rect.left - 180 });
                            }
                          }}
                        >⚙️</button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Hors ligne */}
            {membersByRole.map(({ role, members }) => {
              const offlineMembers = members.filter(m => !onlineSet.has(m.userId));
              if (offlineMembers.length === 0) return null;
              return (
                <div key={role}>
                  <div className="members-group-label">
                    {role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Admins' : t.chat.members} {t.chat.offlineSuffix}
                  </div>
                  {offlineMembers.map(m => (
                    <div key={m.id} className="member-item" style={{ opacity: .4 }}>
                      <div className="member-avatar-wrap">
                        <div className="member-avatar">{initials(m.user.username)}</div>
                      </div>
                      <span className="member-name">
                        {m.user.username}
                        {roleBadge(m.role)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* ── Modales ───────────────────────────────────────────────────────── */}

      {modal === 'createServer' && (
        <Modal title={t.modal.createServer.title} onClose={() => setModal(null)}>
          <p>{t.modal.createServer.desc}</p>
          <label>{t.modal.createServer.label}</label>
          <input value={modalInput} onChange={e => setModalInput(e.target.value)}
            placeholder={t.modal.createServer.placeholder} onKeyDown={e => e.key === 'Enter' && handleCreateServer()} autoFocus />
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-confirm" onClick={handleCreateServer}>{t.modal.create}</button>
          </div>
        </Modal>
      )}

      {modal === 'joinServer' && (
        <Modal title={t.modal.joinServer.title} onClose={() => setModal(null)}>
          <p>{t.modal.joinServer.desc}</p>
          <label>{t.modal.joinServer.label}</label>
          <input value={modalInput} onChange={e => setModalInput(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            onKeyDown={e => e.key === 'Enter' && handleJoinServer()} autoFocus />
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-confirm" onClick={handleJoinServer}>{t.modal.join}</button>
          </div>
        </Modal>
      )}

      {modal === 'createChannel' && (
        <Modal title={t.modal.createChannel.title} onClose={() => setModal(null)}>
          <p>{t.modal.createChannel.desc} <strong>{activeServer?.name}</strong></p>
          <label>{t.modal.createChannel.label}</label>
          <input value={modalInput} onChange={e => setModalInput(e.target.value)}
            placeholder={t.modal.createChannel.placeholder} onKeyDown={e => e.key === 'Enter' && handleCreateChannel()} autoFocus />
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-confirm" onClick={handleCreateChannel}>{t.modal.create}</button>
          </div>
        </Modal>
      )}

      {modal === 'invite' && activeServer && (
        <Modal title={t.modal.invite.title} onClose={() => setModal(null)}>
          <p>{t.modal.invite.desc} <strong>{activeServer.name}</strong></p>
          <div
            className="invite-code-box"
            onClick={() => navigator.clipboard.writeText(activeServer.inviteCode)}
            title={t.modal.invite.clickToCopy}
            style={{ cursor: 'pointer' }}
          >
            {activeServer.inviteCode}
          </div>
          <div style={{ fontSize: 12, color: '#72767d', marginBottom: 12 }}>{t.modal.invite.clickToCopy}</div>
          <div className="modal-actions">
            <button className="btn-confirm" onClick={() => setModal(null)}>{t.modal.close}</button>
          </div>
        </Modal>
      )}

      {modal === 'leaveServer' && (
        <Modal title={t.modal.leaveServer.title} onClose={() => setModal(null)}>
          <p>{t.chat.leaveServer} <strong>{activeServer?.name}</strong> ? {t.modal.leaveServer.warning}</p>
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-danger" onClick={handleLeaveServer}>{t.modal.leave}</button>
          </div>
        </Modal>
      )}

      {modal === 'deleteServer' && (
        <Modal title={t.modal.deleteServer.title} onClose={() => setModal(null)}>
          <p>{t.modal.delete} <strong>{activeServer?.name}</strong> ? {t.modal.deleteServer.warning}</p>
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-danger" onClick={handleDeleteServer}>{t.modal.delete}</button>
          </div>
        </Modal>
      )}

      {modal === 'manageMembers' && activeServer && (
        <Modal title={t.modal.manageMembers.title} onClose={() => setModal(null)}>
          <p>{t.modal.manageMembers.desc} <strong>{activeServer.name}</strong></p>
          <div style={{ maxHeight: 320, overflowY: 'auto', margin: '8px 0 16px' }}>
            {allMembers.map(m => {
              const isMe = m.userId === currentUser.id;
              const isThisOwner = m.role === 'OWNER';
              const myRole = activeServer.userRole;
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 4px', borderBottom: '1px solid #40444b'
                }}>
                  <div className="member-avatar" style={{ width: 32, height: 32, fontSize: 13, borderRadius: '50%', background: '#7289da', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                    {initials(m.user.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, color: '#dcddde' }}>
                    {m.user.username}
                    {isMe && <span style={{ color: '#72767d', fontSize: 12 }}> {t.chat.you}</span>}
                    {roleBadge(m.role)}
                  </span>
                  {!isMe && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {isOwner && !isThisOwner && (
                        <>
                          {m.role !== 'ADMIN' && (
                            <button
                              className="btn-confirm"
                              style={{ fontSize: 12, padding: '4px 8px' }}
                              onClick={() => handleChangeRole(m, 'ADMIN')}
                            >+Admin</button>
                          )}
                          {m.role !== 'MEMBER' && (
                            <button
                              className="btn-ghost"
                              style={{ fontSize: 12, padding: '4px 8px' }}
                              onClick={() => handleChangeRole(m, 'MEMBER')}
                            >-Admin</button>
                          )}
                          <button
                            className="btn-danger"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => {
                              setTransferTarget(m);
                              setModal('confirmTransfer');
                            }}
                          >👑 Transfer</button>
                        </>
                      )}
                      {canKick(myRole, m.role) && (
                        <>
                          <button
                            className="btn-danger"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => {
                              setKickTarget(m);
                              setModal('confirmKick');
                            }}
                          >🚫 Kick</button>
                          <button
                            className="btn-danger"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => {
                              setBanTarget(m);
                              setBanDuration('');
                              setModal('confirmBan');
                            }}
                          >🔨 Ban</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="modal-actions">
            <button className="btn-confirm" onClick={() => setModal(null)}>{t.modal.close}</button>
          </div>
        </Modal>
      )}

      {/* Overlay transparent pour fermer les dropdowns en cliquant ailleurs */}
      {(showServerMenu || memberMenu) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 198 }}
          onClick={() => { setShowServerMenu(false); setMemberMenu(null); }}
        />
      )}

      {/* Menu rôle en position fixe (évite le clipping overflow des sidebars) */}
      {memberMenu && (
        <div
          className="member-dropdown"
          style={{ position: 'fixed', top: memberMenu.top, left: memberMenu.left, right: 'auto', zIndex: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {isOwner && memberMenu.member.role !== 'ADMIN' && (
            <button onClick={() => handleChangeRole(memberMenu.member, 'ADMIN')}>
              {t.memberMenu.makeAdmin}
            </button>
          )}
          {isOwner && memberMenu.member.role !== 'MEMBER' && (
            <button onClick={() => handleChangeRole(memberMenu.member, 'MEMBER')}>
              {t.memberMenu.removeAdmin}
            </button>
          )}
          {isOwner && (
            <>
              <hr />
              <button
                className="danger"
                onClick={() => {
                  setTransferTarget(memberMenu.member);
                  setMemberMenu(null);
                  setModal('confirmTransfer');
                }}
              >
                {t.memberMenu.transferServer}
              </button>
            </>
          )}
          {canKick(activeServer!.userRole, memberMenu.member.role) && (
            <>
              <hr />
              <button
                className="danger"
                onClick={() => {
                  setKickTarget(memberMenu.member);
                  setMemberMenu(null);
                  setModal('confirmKick');
                }}
              >
                🚫 {t.memberMenu.kickFromServer}
              </button>
              <button
                className="danger"
                onClick={() => {
                  setBanTarget(memberMenu.member);
                  setBanDuration('');
                  setMemberMenu(null);
                  setModal('confirmBan');
                }}
              >
                🔨 {t.memberMenu.ban}
              </button>
            </>
          )}
        </div>
      )}

      {modal === 'confirmTransfer' && transferTarget && (
        <Modal title={t.modal.confirmTransfer.title} onClose={() => setModal(null)}>
          <p>
            {t.modal.confirmTransfer.transferTo} <strong>{activeServer?.name}</strong> {t.modal.confirmTransfer.to}{' '}
            <strong>{transferTarget.user.username}</strong> ?<br />
            {t.modal.confirmTransfer.becomeAdmin}
          </p>
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-danger" onClick={handleTransferOwnership}>{t.modal.confirm}</button>
          </div>
        </Modal>
      )}

      {modal === 'confirmKick' && kickTarget && (
        <Modal title={t.modal.confirmKick.title} onClose={() => setModal(null)}>
          <p>
            {t.modal.confirmKick.kick} <strong>{kickTarget.user.username}</strong> {t.modal.confirmKick.from}{' '}
            <strong>{activeServer?.name}</strong> ?<br />
            {t.modal.confirmKick.canReturn}
          </p>
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-danger" onClick={handleKickMember}>{t.modal.kick}</button>
          </div>
        </Modal>
      )}

      {modal === 'confirmBan' && banTarget && (
        <Modal title={t.modal.confirmBan.title} onClose={() => setModal(null)}>
          <p>
            {t.modal.confirmBan.ban} <strong>{banTarget.user.username}</strong> {t.modal.confirmBan.from}{' '}
            <strong>{activeServer?.name}</strong> ?
          </p>
          <label>{t.modal.confirmBan.durationLabel}</label>
          <input
            type="number"
            min="1"
            value={banDuration}
            onChange={e => setBanDuration(e.target.value)}
            placeholder={t.modal.confirmBan.durationPlaceholder}
            autoFocus
          />
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModal(null)}>{t.modal.cancel}</button>
            <button className="btn-danger" onClick={handleBanMember}>
              {banDuration.trim() !== ''
                ? t.modal.confirmBan.banWithDuration.replace('{duration}', banDuration)
                : t.modal.confirmBan.banPermanent}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'manageBans' && activeServer && (
        <Modal title={t.modal.manageBans.title} onClose={() => setModal(null)}>
          <p>{t.modal.manageBans.desc} <strong>{activeServer.name}</strong></p>
          <div style={{ maxHeight: 320, overflowY: 'auto', margin: '8px 0 16px' }}>
            {bans.length === 0 && (
              <p style={{ color: '#72767d', fontSize: 13 }}>{t.modal.manageBans.noBans}</p>
            )}
            {bans.map(b => {
              const isPermanent = !b.expiresAt;
              const isExpired = b.expiresAt ? new Date(b.expiresAt) <= new Date() : false;
              return (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 4px', borderBottom: '1px solid #40444b'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#dcddde', fontWeight: 600 }}>
                      {b.user.username}
                    </div>
                    <div style={{ fontSize: 12, color: '#72767d' }}>
                      {t.modal.manageBans.bannedBy} {b.banner.username} ·{' '}
                      {isPermanent
                        ? <span style={{ color: '#f04747' }}>{t.modal.manageBans.permanent}</span>
                        : isExpired
                          ? <span style={{ color: '#43b581' }}>{t.modal.manageBans.expired}</span>
                          : <span>{t.modal.manageBans.until} {new Date(b.expiresAt!).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                      }
                    </div>
                  </div>
                  <button
                    className="btn-confirm"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => handleUnban(b.userId)}
                  >{t.modal.unban}</button>
                </div>
              );
            })}
          </div>
          {modalError && <div className="auth-error">{modalError}</div>}
          <div className="modal-actions">
            <button className="btn-confirm" onClick={() => setModal(null)}>{t.modal.close}</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
