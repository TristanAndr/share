const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

// Copier .env.example → .env si .env n'existe pas
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✔ .env créé depuis .env.example');
  console.log('  → Pense à changer JWT_SECRET dans .env avant de lancer en production');
} else {
  console.log('✔ .env déjà présent');
}

// Générer le client Prisma
console.log('\nGénération du client Prisma...');
execSync('npx prisma generate', { stdio: 'inherit' });

// Appliquer les migrations (crée la base SQLite si elle n'existe pas)
console.log('\nApplication des migrations...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });

console.log('\n✅ Setup terminé ! Lance le serveur avec : npm run dev');
