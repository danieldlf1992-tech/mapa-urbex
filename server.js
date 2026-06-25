require('dotenv').config();
const express  = require('express');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors     = require('cors');
const { Resend } = require('resend');

const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// ✨ LA MAGIA: Render detecta solo su URL real de internet. Si falla, usa localhost.
const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

app.use(cors({ origin: BASE_URL, methods: ['POST', 'GET'] }));
app.use(express.static(__dirname));
app.use('/api/checkout', express.json());

app.post('/api/checkout', async (req, res) => {
  const { priceId, email, pack } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      locale: 'es',
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      // Ahora Stripe te devolverá a la web real de Render automáticamente
      success_url: `${BASE_URL}/success.html?sid={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/#pricing`,
      metadata: { pack, email },
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/verify', async (req, res) => {
  const { sid } = req.query;
  if (!sid) return res.status(400).json({ ok: false });

  try {
    const session = await stripe.checkout.sessions.retrieve(sid);
    const email = session.metadata?.email;
    
    if (session.payment_status === 'paid' && email) {
      // Enviar el correo real a través de Resend en la nube
      await resend.emails.send({
        from:    'URBEX.MAP <onboarding@resend.dev>', 
        to:      email, // Recuerda: En pruebas de Resend, usa tu propio correo de registro
        subject: '🗺️ Tu Archivo Urbex está listo',
        html: `<h1>¡Tu pago en la nube fue un éxito!</h1><p>Aquí tienes tu acceso privado a los mapas reales de la web.</p>`
      });
      console.log(`[Render] Correo enviado con éxito a ${email}`);
    }
    res.json({ ok: session.payment_status === 'paid' });
  } catch (err) {
    console.error('[Error de envío]:', err.message);
    res.status(400).json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🗺️ Motor corriendo en el puerto ${PORT}`));
