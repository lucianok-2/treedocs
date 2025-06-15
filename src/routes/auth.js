// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const fetch = require('node-fetch');

// Login → POST /auth
router.post('/', async (req, res) => {
  const { email, password } = req.body;
  if (!process.env.FIREBASE_API_KEY) {
    console.error('FIREBASE_API_KEY not set');
    return res.status(500).json({ message: 'Configuración de autenticación incompleta' });
  }

  try {
    // Llamada a Firebase Auth REST API
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    const firebaseRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      return res.status(401).json({ message: firebaseData.error?.message || 'Credenciales inválidas' });
    }

    // Verificar que el token sea válido
    await admin.auth().verifyIdToken(firebaseData.idToken);

    // Devolver el token con la propiedad 'token'
    return res.json({ token: firebaseData.idToken });
  } catch (err) {
    console.error('Error en /auth:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Registro → POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, rol = 'usuario', activo = true } = req.body;

  try {
    // Evitar doble registro
    try {
      await admin.auth().getUserByEmail(email);
      return res.status(400).json({ message: 'El correo ya está registrado' });
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Crear en Firebase Auth
    const userRecord = await admin.auth().createUser({ email, password });
    // Asignar custom claim de rol (opcional)
    await admin.auth().setCustomUserClaims(userRecord.uid, { rol });

    // Guardar metadata en Firestore
    await db.collection('usuarios').doc(userRecord.uid).set({
      email: email.toLowerCase(),
      rol,
      activo,
      fechaRegistro: new Date().toISOString()
    });

    return res.status(201).json({ uid: userRecord.uid });
  } catch (error) {
    console.error('Error en /auth/register:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET route for forgot password page
router.get('/forgot-password', (req, res) => {
    try {
        // Assuming 'forgot-password.handlebars' is in the 'views' folder
        // and the main layout is configured elsewhere or not needed for this specific view.
        // If you use a specific layout for auth pages (e.g., 'auth_layout.handlebars'),
        // you can specify it like: res.render('forgot-password', { layout: 'auth_layout' });
        res.render('forgot-password', { layout: 'auth' });
    } catch (error) {
        console.error("Error rendering forgot-password page:", error);
        res.status(500).send("Error al cargar la página de olvido de contraseña.");
    }
});

module.exports = router;
