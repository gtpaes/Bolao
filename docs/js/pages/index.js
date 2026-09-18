/* js/pages/index.js — Registro de páginas por rota */
import * as dashboard from "./dashboard.js";
import * as round from "./round.js";
import * as picks from "./picks.js";
import * as bets from "./bets.js";
import * as tickets from "./tickets.js";
import * as buy from "./buy.js";
import * as payment from "./payment.js";
import * as ranking from "./ranking.js";
import * as live from "./live.js";
import * as profile from "./profile.js";
import * as history from "./history.js";
import * as admin from "./admin.js";
import * as dev from "./dev.js";

export const pages = {
  dashboard: dashboard,
  round: round,
  picks: picks,
  bets: bets,
  tickets: tickets,
  buy: buy,
  payment: payment,
  ranking: ranking,
  live: live,
  profile: profile,
  history: history,

  admin: { render: admin.adminDashboard },
  "admin/round": { render: admin.adminRound },
  "admin/matches": { render: admin.adminMatches },
  "admin/users": { render: admin.adminUsers },
  "admin/tickets": { render: admin.adminTickets },
  "admin/settings": { render: admin.adminSettings },
  "admin/logs": { render: admin.adminLogs },

  dev: { render: dev.devDashboard },
  "dev/monitoring": { render: dev.devMonitoring },
  "dev/integrations": { render: dev.devIntegrations },
  "dev/logs": { render: dev.devLogs },
  "dev/diagnostics": { render: dev.devDiagnostics },
};