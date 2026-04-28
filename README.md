# Real Time Chat Application

Clone de Discord en temps réel — serveurs, channels, messages privés, réactions et GIFs.
Disponible en **version web** (Next.js) et **application desktop installable** (Electron).

---

## Fonctionnalités

- Inscription / connexion (JWT)
- Serveurs avec code d'invitation
- Channels texte en temps réel (WebSockets)
- Messages privés (DM)
- Réactions emoji sur les messages
- Recherche et envoi de GIFs (Giphy)
- Rôles : **OWNER** / **ADMIN** / **MEMBER**
- Kick, ban temporaire ou définitif, transfert d'ownership
- Indicateur de présence en ligne et de frappe
- Interface **FR / EN**
- Notifications système (web + desktop natif)

---

## Stack

| Couche | Technologies |
|---|---|
| **Backend** | Node.js, TypeScript, Express, Socket.IO, Prisma + SQLite, JWT |
| **Frontend** | Next.js 14, TypeScript, Socket.IO Client |
| **Desktop** | Electron, TypeScript, electron-builder |

---

## Prérequis

- **Node.js v18+** — [nodejs.org](https://nodejs.org)
- **npm** (inclus avec Node.js)

> `node_modules/`, `dist/` et `release/` ne sont pas versionnés — ils se génèrent localement.

---

## Démarrage en développement

### 1. Backend (port 3001)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm install
npm run setup    # crée .env + génère le client Prisma + applique les migrations
npm run dev
```

> `npm run setup` copie `.env.example` → `.env`. Tu peux y changer `JWT_SECRET` et `GIPHY_API_KEY`.

---

### 2. Frontend web (port 3000)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-frontend"
npm install
npm run dev
```

Ouvre `http://localhost:3000` dans ton navigateur.

---

### 3. Application desktop (Electron)

**Option — tout-en-un** (lance backend + frontend + Electron automatiquement) :

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install
bash start-dev.sh
```

---

## Tests

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm test              # tous les tests
npm test -- --watch   # mode observation
```

---

## Build — Générer un installeur

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install

npm run package:linux   # → release/*.AppImage  (Linux)
npm run package:win     # → release/*.exe        (Windows uniquement)
npm run package:mac     # → release/*.dmg        (macOS uniquement)
```

Les installeurs sont écrits dans `rtc-desktop/release/` (exclu du dépôt).

### Installation par OS

**Linux**
```bash
chmod +x "release/Real Time Chat-x.x.x.AppImage"
./"release/Real Time Chat-x.x.x.AppImage"
```

**Windows** — double-cliquer sur le `.exe` et suivre l'assistant.
> Si Windows SmartScreen bloque : "Informations complémentaires" → "Exécuter quand même".

**macOS** — glisser l'app du `.dmg` dans le dossier Applications.
> Si Gatekeeper bloque : Réglages Système → Confidentialité et sécurité → "Ouvrir quand même".

### Via GitHub Actions (sans build local)

À chaque push sur `main`, les trois installeurs sont générés automatiquement.
Pour les récupérer : onglet **Actions** → dernier workflow réussi → section **Artifacts**.

---

## Tester l'application manuellement

1. Lance le backend et le frontend (ou `bash start-dev.sh`)
2. Ouvre `http://localhost:3000`
3. Crée un compte via le formulaire d'inscription
4. Crée un **serveur** (bouton **+** dans la barre latérale gauche)
5. Ouvre le menu du serveur et copie le **code d'invitation**
6. Ouvre une **fenêtre de navigation privée**
7. Crée un second compte, rejoins le serveur avec le code
8. Discute en temps réel entre les deux comptes

---

## Structure du projet

```
REAL TIME CHAT APPLICATION/
├── rtc-backend/
│   ├── src/
│   │   ├── index.ts          ← point d'entrée (setup Express + démarrage)
│   │   ├── socket.ts         ← handlers Socket.IO
│   │   ├── middleware.ts     ← authMiddleware, getUserRole
│   │   ├── config.ts         ← constantes partagées (SECRET)
│   │   ├── io.ts             ← singleton Socket.IO
│   │   ├── db.ts             ← client Prisma
│   │   ├── utils.ts          ← dmRoom, getUniqueOnlineUsers
│   │   └── routes/
│   │       ├── auth.ts       ← /auth/signup  /auth/login
│   │       ├── servers.ts    ← /servers  + membres (rôles, kick, ban)
│   │       ├── channels.ts   ← /channels
│   │       ├── messages.ts   ← /messages + réactions
│   │       ├── users.ts      ← /users
│   │       ├── dm.ts         ← /dm
│   │       └── gif.ts        ← /gif/search
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env.example
│   ├── setup.js
│   └── package.json
│
├── rtc-frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           ← redirect login/chat
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── chat/page.tsx      ← interface principale
│   │   ├── components/            ← Providers, LanguageSwitcher
│   │   ├── contexts/              ← LanguageContext (i18n)
│   │   ├── i18n/                  ← traductions FR/EN
│   │   └── lib/
│   │       ├── api.ts             ← appels HTTP vers le backend
│   │       └── socket.ts          ← singleton Socket.IO client
│   └── package.json
│
└── rtc-desktop/
    ├── src/
    │   ├── main.ts           ← processus principal Electron
    │   └── preload.ts        ← bridge IPC (window.electronAPI)
    ├── start-dev.sh          ← script de démarrage complet (dev)
    └── package.json
```
