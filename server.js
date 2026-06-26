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
      metadata: { pack, email }, // Aquí guardamos el tipo de pack comprado
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
    // Forzamos minúsculas para evitar errores si en el html se escribió diferente
    const pack = session.metadata?.pack?.toLowerCase(); 
    
    if (session.payment_status === 'paid' && email) {
      
      let mapLink = '';
      let packName = '';
      let extraContent = '';

      // 🗺️ ASIGNACIÓN DE ENLACES SEGÚN EL PACK COMPRADO
      if (pack === 'norte') {
        packName = 'España Norte';
        mapLink = 'https://www.google.com/maps/d/edit?mid=1zqD1W8sdb79yObC8OemV3MYpsKy85gE&usp=sharing';
      } else if (pack === 'sur') {
        packName = 'España Sur';
        mapLink = 'https://www.google.com/maps/d/edit?mid=1ZLfGPQCUj3XhJCR8RLKgpc0NQOB3kts&usp=sharing';
      } else if (pack === 'completo') {
        packName = 'España Completo';
        mapLink = 'https://www.google.com/maps/d/edit?mid=1B-wN1Fe6QcYNCHETVho2i6ADRwWTXxM&usp=sharing';
        // Para el completo, les dejamos también los enlaces individuales por separado por comodidad
        extraContent = `
          <p style="margin-top: 25px; color: #aaaaaa; font-size: 14px; text-align: center;">También tienes los accesos individuales por separado por si los necesitas:</p>
          <div style="text-align: center; margin-top: 10px;">
            <a href="https://www.google.com/maps/d/edit?mid=1zqD1W8sdb79yObC8OemV3MYpsKy85gE&usp=sharing" target="_blank" style="background-color: #222222; color: #ffffff; padding: 10px 15px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; margin: 5px; font-size: 13px; border: 1px solid #444;">Mapa Norte</a>
            <a href="https://www.google.com/maps/d/edit?mid=1ZLfGPQCUj3XhJCR8RLKgpc0NQOB3kts&usp=sharing" target="_blank" style="background-color: #222222; color: #ffffff; padding: 10px 15px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; margin: 5px; font-size: 13px; border: 1px solid #444;">Mapa Sur</a>
          </div>
        `;
      } else {
        // Por si acaso ocurre un error de lectura, enviamos el completo para no dejar colgado al cliente
        packName = 'España Completo';
        mapLink = 'https://www.google.com/maps/d/edit?mid=1B-wN1Fe6QcYNCHETVho2i6ADRwWTXxM&usp=sharing';
      }

      // 🎨 DISEÑO DE LA PLANTILLA DEL CORREO ELECTRÓNICO (Estética Premium Dark)
      const emailHtml = `
        <div style="background-color: #121212; color: #ffffff; padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
          <h1 style="color: #ff4a4a; text-align: center; font-size: 26px; margin-bottom: 20px;">🗺️ ¡Tu Material Urbex está listo!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: center;">
            ¡Hola! Gracias por tu compra. Tu pago se ha procesado correctamente.<br>
            Aquí tienes tu acceso privado al <strong>Pack ${packName}</strong>:
          </p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${mapLink}" target="_blank" style="background-color: #ff4a4a; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 74, 74, 0.3); letter-spacing: 0.5px;">
              📍 ABRIR MAPA EN GOOGLE MAPS
            </a>
          </div>

          ${extraContent}

          <div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-top: 30px; border-left: 4px solid #ff4a4a;">
            <p style="margin: 0; font-size: 13px; color: #cccccc; line-height: 1.5;">
              <strong>💡 Consejo importante:</strong> Asegúrate de abrir el enlace habiendo iniciado sesión con tu cuenta de Google. De esta forma, el mapa se guardará automáticamente en tu aplicación móvil dentro de la sección "Guardados" > "Mapas".
            </p>
          </div>

          <hr style="border: 0; border-top: 1px solid #2c2c2c; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #aaaaaa; text-align: center; margin: 0; line-height: 1.4;">
            Si tienes cualquier problema técnico o duda con las ubicaciones, responde directamente a este email o escríbenos a: <br>
            <a href="mailto:urbexspain1@gmail.com" style="color: #ff4a4a; text-decoration: none; font-weight: bold;">urbexspain1@gmail.com</a>
          </p>
        </div>
      `;

      // Enviar el correo real a través de Resend en la nube
      await resend.emails.send({
        from:    'URBEX.MAP <onboarding@resend.dev>', 
        to:      email, 
        subject: `🗺️ Tu Acceso Privado: Pack ${packName}`,
        html:    emailHtml
      });
      
      console.log(`[Render] Correo enviado con éxito a ${email} para el pack: ${pack}`);
    }
    res.json({ ok: session.payment_status === 'paid' });
  } catch (err) {
    console.error('[Error de envío]:', err.message);
    res.status(400).json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🗺️ Motor corriendo en el puerto ${PORT}`));
