const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const roundController = require("../controllers/roundController");
const ticketController = require("../controllers/ticketController");
const paymentController = require("../controllers/paymentController");
const rankingController = require("../controllers/rankingController");
const adminController = require("../controllers/adminController");
const webhookController = require("../controllers/webhookController");
const { authJwt, requireRole } = require("../middlewares/auth");

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

// Saúde
router.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth (público)
router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);

// Usuário
router.get("/users/me", authJwt, userController.me);

// Rodadas e jogos
router.get("/rounds/current", authJwt, roundController.current);
router.get("/rounds", authJwt, roundController.list);
router.get("/rounds/:id", authJwt, roundController.get);
router.get("/matches", authJwt, roundController.matches);
router.get("/matches/live", authJwt, roundController.live);

// Tickets
router.get("/tickets", authJwt, ticketController.list);
router.get("/tickets/:id", authJwt, ticketController.get);
router.post("/tickets", authJwt, ticketController.buy);
router.put("/tickets/:id/picks", authJwt, ticketController.picks);

// Pagamentos
router.post("/payments", authJwt, paymentController.create);
router.get("/payments/:id/status", authJwt, paymentController.status);

// Ranking
router.get("/ranking", authJwt, rankingController.ranking);

// Webhook Mercado Pago (assinatura validada no controller)
router.post("/webhooks/mercadopago", express.json({ limit: "256kb" }), webhookController.mercadopago);

// Admin/Dev
router.get("/admin/overview", authJwt, requireRole("admin", "dev"), adminController.overview);
router.patch("/admin/rounds/:id/deadline", authJwt, requireRole("admin", "dev"), adminController.setDeadline);
router.post("/admin/rounds/:id/close", authJwt, requireRole("admin", "dev"), adminController.closeRound);
router.post("/admin/rounds/:id/reopen", authJwt, requireRole("admin", "dev"), adminController.reopenRound);
router.post("/admin/sync/round", authJwt, requireRole("admin", "dev"), adminController.syncNow);
router.get("/admin/users", authJwt, requireRole("admin", "dev"), adminController.listUsers);
router.get("/admin/tickets", authJwt, requireRole("admin", "dev"), adminController.listTickets);

module.exports = router;
