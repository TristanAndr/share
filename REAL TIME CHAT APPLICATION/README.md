# Real Time Chat Application (RTC)

Application de **chat en temps réel** développée dans le cadre d'un projet **Epitech**.
Elle permet de créer des **serveurs**, des **channels**, d'inviter des utilisateurs et de **discuter instantanément** via WebSockets.

---

## Fonctionnalités

- Inscription et authentification (JWT)
- Création de serveurs et de channels
- Système d'invitation par code
- Messagerie en temps réel (WebSockets)
- Gestion des rôles : **OWNER**, **ADMIN**, **MEMBER**
- Kick et ban (temporaire ou définitif) des membres
- Transfert d'ownership
- Indicateur de présence en ligne
- Indicateur de frappe en cours

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

---

## Installation

### Prérequis
- Node.js v18+
- npm

Le backend et le frontend doivent être lancés dans **deux terminaux séparés**.

---

### 1. Backend (port 3001)

```bash
cd rtc-backend
npm install
npm run setup
npm run dev
```

> La première fois, `npm run setup` crée automatiquement le fichier `.env` depuis `.env.example`.
> Tu peux y modifier `JWT_SECRET` selon tes besoins.

---

### 2. Frontend (port 3000)

```bash
cd rtc-frontend
npm install
npm run dev
```

---

## Travailler à plusieurs

Chaque développeur lance `npm run setup` après avoir cloné le repo.
La base de données SQLite est **locale** à chaque machine (non versionnée).

```bash
git clone <repo>
cd rtc-backend
npm install
npm run setup
npm run dev
```

---

## Tester l'application

1. Ouvre `http://localhost:3000`
2. Crée un compte via le formulaire d'inscription
3. Crée un **serveur** (bouton **+**)
4. Copie le **code d'invitation** affiché sous le nom du serveur
5. Ouvre une **fenêtre de navigation privée**
6. Crée un second compte et rejoins le serveur avec le code
7. Discute en temps réel

---

## Structure du projet

```
rtc/
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
└── rtc-frontend/
    ├── app/
    └── package.json
```
