async function me(req, res) {
  return res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt || null,
  });
}

module.exports = { me };
