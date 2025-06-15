const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { getUserHistory } = require('../public/js/history.js');

async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.cookies.token || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.usuario = decoded;
    return next();
  } catch (err) {
    console.error('Error al verificar token con Firebase:', err);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = await getUserHistory(req.usuario.uid, limit);
    res.json(history);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;