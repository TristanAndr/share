````md
# 💬 Real Time Chat Application (RTC)

Application de **chat en temps réel** développée dans le cadre d’un projet **Epitech**.  
Elle permet de créer des **serveurs**, des **channels**, d’inviter des utilisateurs et de **discuter instantanément** via WebSockets.

---

## ✨ Fonctionnalités

- Inscription et authentification des utilisateurs
- Création de serveurs et de channels
- Système d’invitation par code
- Messagerie en temps réel
- Gestion multi-utilisateurs
- Communication via WebSockets + API REST

---

## 🛠 Technologies utilisées

### Backend (`/rtc-backend`)
- **Node.js**
- **TypeScript**
- **Express.js**
- **Socket.IO** (temps réel / WebSockets)
- **Prisma ORM**
  - Base de données : **SQLite** (par défaut)
  - Compatible **PostgreSQL**
- **JWT** (authentification)
- **Bcryptjs** (hashage des mots de passe)

### Frontend (`/rtc-frontend`)
- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Axios** (client HTTP)
- **Socket.IO Client** (temps réel)

---

## 🚀 Installation et lancement

### Prérequis
- **Node.js v18+**
- **npm**

Le backend et le frontend doivent être lancés dans **deux terminaux séparés**.

---

### 1️⃣ Démarrer le Backend (port 3001)

```bash
# Aller dans le dossier backend
cd rtc-backend

# Installer les dépendances
npm install

# Initialiser la base de données (SQLite)
npx prisma migrate dev --name init

# Lancer le serveur en mode développement
npm run dev
````

➡️ Le serveur backend sera accessible sur :
`http://localhost:3001`

---

### 2️⃣ Démarrer le Frontend (port 3000)

```bash
# Aller dans le dossier frontend
cd rtc-frontend

# Installer les dépendances
npm install

# Lancer l'application Next.js
npm run dev
```

➡️ L’application sera accessible sur :
`http://localhost:3000`

---

## 🧪 Comment tester l’application

1. Ouvrez `http://localhost:3000`
2. Créez un compte via le formulaire d’inscription
3. Créez un **serveur** (bouton **+ vert**)
4. Copiez le **code d’invitation** du serveur (sous le nom du serveur)
5. Ouvrez une **fenêtre de navigation privée**
6. Créez un **second compte utilisateur**
7. Cliquez sur le bouton **Lien** (sous le bouton +) et collez le code
8. Commencez à discuter en temps réel 🎉

---

## 📂 Structure du projet

```
rtc/
├── rtc-backend/
│   ├── prisma/
│   ├── src/
│   └── package.json
│
├── rtc-frontend/
│   ├── app/
│   ├── components/
│   └── package.json
```

---

## 📌 Notes

* SQLite est utilisé par défaut pour simplifier le développement.
* Le projet est prêt à être migré vers **PostgreSQL** pour la production.
* L’architecture combine **REST API** et **WebSockets**.

---
