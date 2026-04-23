# Real Time Chat Application (RTC)

Application de **chat en temps réel** développée dans le cadre d'un projet **Epitech**.
Elle permet de créer des **serveurs**, des **channels**, d'inviter des utilisateurs et de **discuter instantanément** via WebSockets.
Disponible en version **web** et **application desktop native** (Electron).

---

## Getting Started

### Prerequisites

- **Node.js v18+** — [nodejs.org](https://nodejs.org) (LTS recommended)
- **npm** — bundled with Node.js, no separate install needed

No global CLI tools are required. All binaries (`electron`, `electron-builder`, `ts-node`, `nodemon`, `next`) are installed locally via `npm install` in each sub-project.

> **Note:** `node_modules/`, `dist/`, and `release/` are excluded from this repository.
> They must be generated locally after cloning (see steps below).

---

### Installation & dev startup after `git clone`

#### 1. Backend (port 3001)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm install
npm run setup   # copies .env.example → .env and runs Prisma migrations
npm run dev     # starts Express + Socket.IO via nodemon + ts-node
```

#### 2. Frontend web (port 3000)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-frontend"
npm install
npm run dev     # starts Next.js dev server
```

#### 3. Desktop app (Electron) — all-in-one script

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install
bash start-dev.sh   # starts backend, frontend, then Electron automatically
```

Or, if the backend and frontend are already running:

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install
npm run build       # compiles TypeScript → dist/
npx electron .      # launches the Electron window
```

#### Build an installable binary

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install

# Run on Linux
npm run package:linux    # → release/*.AppImage

# Run on Windows
npm run package:win      # → release/*.exe  (NSIS installer)

# Run on macOS
npm run package:mac      # → release/*.dmg
```

Installers are written to `REAL TIME CHAT APPLICATION/rtc-desktop/release/` (excluded from git).
See the **Packaging** section below for OS-specific installation instructions.

## Tests automatisés

Le projet utilise **Jest** pour les tests unitaires et d'intégration.

### Lancer les tests du Backend

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm test
```

Pour lancer les tests en mode observation (rechargement automatique lors de modifications) :

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm test -- --watch
```

---

## Fonctionnalités

- Inscription et authentification (JWT)
- Création de serveurs et de channels
- Système d'invitation par code
- Messagerie en temps réel (WebSockets)
- Messages privés (DM) entre utilisateurs
- Réactions emoji sur les messages
- Recherche et envoi de GIFs (Giphy)
- Gestion des rôles : **OWNER**, **ADMIN**, **MEMBER**
- Kick et ban (temporaire ou définitif) des membres
- Transfert d'ownership
- Indicateur de présence en ligne
- Indicateur de frappe en cours
- Interface multilingue **FR / EN**
- **Notifications système** (desktop)
- **Application desktop installable** (Windows, macOS, Linux)

---

## Technologies

### Backend (`/rtc-backend`)
- Node.js + TypeScript
- Express.js
- Socket.IO
- Prisma ORM + SQLite
- JWT + Bcryptjs

### Frontend (`/rtc-frontend`)
- Next.js 14 (App Router) + TypeScript
- Socket.IO Client
- Internationalisation FR/EN (LanguageContext)

### Desktop (`/rtc-desktop`)
- **Electron** (v33)
- electron-builder (packaging Windows / macOS / Linux)
- TypeScript

---

## Installation

### Prérequis
- Node.js v18+
- npm

---

### 1. Backend (port 3001)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm install
npm run setup   # génère .env + applique les migrations Prisma
npm run dev
```

> `npm run setup` crée automatiquement le fichier `.env` depuis `.env.example`.
> Tu peux y modifier `JWT_SECRET` et `GIPHY_API_KEY` selon tes besoins.

---

### 2. Frontend web (port 3000)

```bash
cd "REAL TIME CHAT APPLICATION/rtc-frontend"
npm install
npm run dev
```

Ouvre ensuite `http://localhost:3000` dans ton navigateur.

---

### 3. Application desktop (Electron)

Le script `start-dev.sh` démarre automatiquement le backend, le frontend et Electron :

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm install
bash start-dev.sh
```

Ou, si le backend et le frontend tournent déjà :

```bash
cd "REAL TIME CHAT APPLICATION/rtc-desktop"
npm run build && npx electron .
```

---

## Packaging — Générer un installeur

> **Pré-requis communs** — depuis le dossier `rtc-desktop` :
> ```bash
> cd "REAL TIME CHAT APPLICATION/rtc-desktop"
> npm install
> ```

---

### Linux (AppImage)

```bash
npm run package:linux
```

Un fichier `Real Time Chat-x.x.x.AppImage` est généré dans `release/`.

**Installation :**
```bash
chmod +x "release/Real Time Chat-x.x.x.AppImage"
./"release/Real Time Chat-x.x.x.AppImage"
```

Aucune installation système requise — l'AppImage est autonome et portable.

---

### Windows (.exe — NSIS)

Commande à exécuter **sur Windows** :

```bash
npm run package:win
```

Un fichier `Real Time Chat Setup x.x.x.exe` est généré dans `release/`.

**Installation :**
1. Double-cliquer sur le `.exe`
2. Suivre l'assistant d'installation (Next → Install → Finish)
3. L'application apparaît dans le menu Démarrer et sur le bureau

> **Note :** Windows SmartScreen peut afficher un avertissement car le binaire n'est pas signé.
> Cliquer sur **"Informations complémentaires" → "Exécuter quand même"**.

---

### macOS (.dmg)

Commande à exécuter **sur macOS** :

```bash
npm run package:mac
```

Un fichier `Real Time Chat-x.x.x.dmg` est généré dans `release/` (builds `x64` et `arm64`).

**Installation :**
1. Double-cliquer sur le `.dmg`
2. Glisser l'icône **Real Time Chat** dans le dossier **Applications**
3. Éjecter le `.dmg`

> **Note :** À la première ouverture, macOS peut bloquer l'app (Gatekeeper) car elle n'est pas signée.
> Aller dans **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**.

---

### Via GitHub Actions (sans build local)

À chaque push sur `main`, les trois installeurs sont automatiquement générés par le CI/CD.
Pour les télécharger :

1. Ouvrir l'onglet **Actions** du dépôt GitHub
2. Cliquer sur le dernier workflow **CI/CD Pipeline** réussi
3. Scrollar jusqu'à la section **Artifacts**
4. Télécharger `installer-linux`, `installer-windows` ou `installer-macos`

Les installeurs sont générés dans `rtc-desktop/release/` (exclu du dépôt git).

---

## Tester l'application

1. Lance le backend et le frontend (ou `bash start-dev.sh`)
2. Ouvre `http://localhost:3000` (web) ou l'app Electron
3. Crée un compte via le formulaire d'inscription
4. Crée un **serveur** (bouton **+**)
5. Copie le **code d'invitation** affiché sous le nom du serveur
6. Ouvre une **fenêtre de navigation privée** (ou une seconde instance)
7. Crée un second compte, rejoins le serveur avec le code
8. Discute en temps réel

---

## Structure du projet

```
REAL TIME CHAT APPLICATION/
├── rtc-backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   └── index.ts
│   ├── .env.example
│   ├── setup.js
│   └── package.json
│
├── rtc-frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── chat/page.tsx
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── i18n/
│   │   └── lib/
│   └── package.json
│
└── rtc-desktop/
    ├── src/
    │   ├── main.ts       ← Processus principal Electron
    │   └── preload.ts    ← Bridge IPC (window.electronAPI)
    ├── dist/             ← Compilé (tsc)
    ├── release/          ← Installeurs générés
    ├── start-dev.sh      ← Script de démarrage complet
    └── package.json
```

---

## Travailler à plusieurs

Chaque développeur lance `npm run setup` après avoir cloné le repo.
La base de données SQLite est **locale** à chaque machine (non versionnée).

```bash
git clone <repo>
cd "REAL TIME CHAT APPLICATION/rtc-backend"
npm install
npm run setup
npm run dev
```
