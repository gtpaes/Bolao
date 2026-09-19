/* scripts/devTickets.js — cria tickets JÁ LIBERADOS (status "released") para testar
   o fluxo de palpites sem passar pelo Pix. Script de uso interno de desenvolvimento.

   Uso (a partir da pasta backend/):
     node scripts/devTickets.js --dry                     # só mostra o que faria
     node scripts/devTickets.js                           # 2 tickets para cada conta
     node scripts/devTickets.js --qty 3                   # 3 por conta
     node scripts/devTickets.js --email teste@teste.com --qty 2
     node scripts/devTickets.js --round 28 --qty 2

   Requer MONGODB_URI no backend/.env.
   ATENÇÃO: grava no MESMO banco Atlas usado pelo ambiente publicado. */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const config = require("../src/config/env");
const User = require("../src/models/User");
const Round = require("../src/models/Round");
const Ticket = require("../src/models/Ticket");
const TicketCounter = require("../src/models/TicketCounter");

function parseArgs(argv) {
  const args = { qty: 2, email: null, round: null, dry: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry" || arg === "--dry-run") { args.dry = true; }
    else if (arg === "--qty" || arg === "--quantity") { args.qty = Number(argv[i + 1]); i += 1; }
    else if (arg.startsWith("--qty=")) { args.qty = Number(arg.split("=")[1]); }
    else if (arg === "--email") { args.email = String(argv[i + 1] || "").trim().toLowerCase(); i += 1; }
    else if (arg.startsWith("--email=")) { args.email = arg.split("=")[1].trim().toLowerCase(); }
    else if (arg === "--round") { args.round = Number(argv[i + 1]); i += 1; }
    else if (arg.startsWith("--round=")) { args.round = Number(arg.split("=")[1]); }
  }
  return args;
}

async function resolveRound(roundNumber) {
  if (roundNumber) {
    const byNumber = await Round.findOne({ number: roundNumber });
    if (!byNumber) throw new Error(`Rodada ${roundNumber} não encontrada.`);
    return byNumber;
  }
  const open = await Round.findOne({ status: "open" }).sort({ number: -1 });
  if (!open) throw new Error('Nenhuma rodada com status "open". Use --round <numero>.');
  return open;
}

// Numera continuando o que já existe para o usuário na rodada (índice único
// userId+roundId+number) e alinha o TicketCounter para a compra paga não colidir.
async function grant(user, round, qty, dry) {
  const last = await Ticket.findOne({ userId: user._id, roundId: round._id }).sort({ number: -1 }).select("number").lean();
  let next = (last && last.number ? last.number : 0) + 1;
  const docs = Array.from({ length: qty }, () => ({
    userId: user._id,
    roundId: round._id,
    number: next++,
    unitPriceCents: 0,
    status: "released",
    picks: [],
    points: 0,
    paymentId: null,
  }));
  if (dry) return { numbers: docs.map((d) => d.number), ids: [] };
  const inserted = await Ticket.insertMany(docs, { ordered: true });
  await TicketCounter.findOneAndUpdate(
    { userId: user._id, roundId: round._id },
    { $max: { nextNumber: next - 1 } },
    { upsert: true }
  );
  return { numbers: inserted.map((t) => t.number), ids: inserted.map((t) => String(t._id)) };
}

async function main() {
  const args = parseArgs(process.argv);
  const qty = Math.floor(Number(args.qty));
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error("--qty deve ser um inteiro de 1 a 50.");
  if (!config.mongodbUri) throw new Error("MONGODB_URI não configurada no backend/.env.");

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 15000 });

  const round = await resolveRound(args.round);
  const users = await User.find(args.email ? { email: args.email } : {})
    .select("username email role")
    .sort({ createdAt: 1 })
    .lean();
  if (!users.length) throw new Error(args.email ? `Conta não encontrada: ${args.email}` : "Nenhuma conta no banco.");

  const playable = (round.matches || []).filter((m) => m.enabledForTickets !== false && m.status === "scheduled");

  console.log("=".repeat(74));
  console.log(args.dry ? "MODO DRY-RUN — nada será gravado" : "GRAVANDO em " + String(config.mongodbUri).replace(/\/\/[^@]+@/, "//***@"));
  console.log(`Rodada ${round.number} (${round._id}) | status=${round.status} | deadline=${round.deadline ? new Date(round.deadline).toISOString() : "null"}`);
  console.log(`Jogos habilitados p/ palpite: ${playable.length} | Contas alvo: ${users.length} | ${qty} ticket(s) por conta`);
  console.log("=".repeat(74));

  const report = [];
  for (const user of users) {
    const before = await Ticket.countDocuments({ userId: user._id, roundId: round._id });
    const res = await grant(user, round, qty, args.dry);
    const after = args.dry ? before + qty : await Ticket.countDocuments({ userId: user._id, roundId: round._id });
    report.push({ user, numbers: res.numbers, ids: res.ids, before, after });
    console.log(`\n${user.username} <${user.email}> [${user.role}]`);
    console.log(`  tickets antes: ${before} -> depois: ${after}`);
    console.log(`  números criados: ${res.numbers.join(", ")}`);
    res.ids.forEach((id, i) => console.log(`  nº ${res.numbers[i]} -> id=${id}`));
  }

  const total = report.reduce((sum, r) => sum + r.numbers.length, 0);
  console.log(`\n${"=".repeat(74)}`);
  console.log(`TOTAL: ${total} ticket(s)${args.dry ? " (simulado)" : " criados"} | rodada ${round.number}`);

  if (playable.length) {
    console.log("\nBody pronto para PUT /api/tickets/<ID_DO_TICKET>/picks:");
    console.log(JSON.stringify({ picks: playable.slice(0, 3).map((m, i) => ({ matchId: m.externalId, home: 1 + i, away: 0 })) }, null, 2));
  } else {
    console.log("\nNenhum jogo habilitado/scheduled nesta rodada: não há como palpitar ainda.");
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("\nERRO: " + (e && e.message ? e.message : e));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
