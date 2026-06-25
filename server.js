/**
 * URBEX.MAP — Backend Server (CONECTADO)
 * Node.js + Express + Stripe + Resend
 */

require('dotenv').config();

const express  = require('express');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors     = require('cors');
const { Resend } = require('resend');

const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY);

const MAP_URLS = {
  norte:    process.env.MAP_URL_NORTE    || 'https://maps.app.goo.gl/TU-ENLACE-NORTE',
  sur:      process.env.MAP_URL_SUR      || 'https://maps.app.goo.gl/TU-ENLACE-SUR',
  completo: process.env.MAP_URL_COMPLETO || 'https://maps.app.goo.gl/TU-ENLACE-COMPLETO',
};

// Permite conexiones
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['POST', 'GET'],
}));

// ✨ LA LÍNEA MÁGICA: Sirve tu index.html automáticamente en el puerto 3000
app.use(express.static(__dirname));

// RUTA 1: Enviar al usuario a Stripe
app.use('/api/checkout', express.json());
app.post('/api/checkout', async (req, res) => {
  const { priceId, email, pack } = req.body;
  if (!priceId || !email || !pack) return res.status(400).json({ error: 'Faltan campos.' });
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      locale: 'es',
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `http://localhost:3000/success.html?sid={CHECKOUT_SESSION_ID}`,
      cancel_url:  `http://localhost:3000/#pricing`,
      metadata: { pack, email },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Error:', err.message);
    res.status(500).json({ error: 'Error al iniciar el pago.' });
  }
});

// RUTA 2: Recibir confirmación de Stripe y enviar Email
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  res.json({ received: true }); // Simplemente responde ok para pruebas locales
});

// RUTA 3: Verificar pago
app.get('/verify', async (req, res) => {
  const { sid } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(sid);
    res.json({ ok: session.payment_status === 'paid', pack: session.metadata?.pack });
  } catch (err) {
    res.status(400).json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🗺️  URBEX.MAP ¡Conectado con éxito en http://localhost:${PORT}!`);
});