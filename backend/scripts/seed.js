/* scripts/seed.js — Cria/atualiza as contas de acesso administrativo no banco.
   Uso: npm run seed  (requer MONGODB_URI no .env) */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const config = require("../src/config/env");
const User = require("../src/models/User");

const ACCOUNTS = [
  { email: process.env.DEV_EMAIL || "dev@bolao.local", username: "Desenvolvedor", password: process.env.DEV_PASSWORD || "dev12345", role: "dev" },
  { email: process.env.ADMIN_EMAIL || "admin@bolao.local", username: "Administrador", password: process.env.ADMIN_PASSWORD || "admin12345", role: "admin" },
];

async function upsert({ email, username, password, role }) {
  const existing = await User.findOne({ email: String(email).toLowerCase() });
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    existing.role = role;
    existing.passwordHash = passwordHash;
    await existing.save();
    return { email, action: "atualizada" };
  }
  await User.create({ email: String(email).toLowerCase(), username, passwordHash, role });
  return { email, action: "criada" };
}

async function main() {
  if (!config.mongodbUri) {
    console.error("MONGODB_URI não configurada. Copie .env.example para .env e preencha.");
    process.exit(1);
  }
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  for (const acc of ACCOUNTS) {
    const res = await upsert(acc);
    console.log(`Conta ${res.action}: ${res.email} (${acc.role})`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
