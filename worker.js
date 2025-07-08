// worker.js — Bot de Telegram “WerdMail” completo sin subida de archivos

export default { async fetch(request, env, ctx) { if (request.method !== 'POST') return new Response('Solo POST');

const update = await request.json();
const msg = update.message || update.callback_query?.message;
const chatId = msg.chat.id;
const userId = msg.from.id.toString();
const text = update.message?.text || update.callback_query?.data;

if (text === '/start') {
  return await sendMessage(env.BOT_TOKEN, chatId, `¡Hola! Soy *WerdMail*, un asistente que te permite tener un email y un sitio web privado para tu comunidad y/o grupo.`, [
    [{ text: 'Registrarme 👤', callback_data: 'registrarme' }],
    [{ text: 'Crear chat privado 🌐', callback_data: 'crear_chat' }],
    [{ text: 'YouTube 🧑‍💻', url: 'https://youtube.com/@Nezukomi' }]
  ]);
}

// Manejar botones
if (update.callback_query) {
  const data = update.callback_query.data;
  if (data === 'registrarme') {
    await actualizarEstado(env, userId, 'esperando_nombre_publico');
    return await sendMessage(env.BOT_TOKEN, chatId, 'Okey, primero envíame el *nombre público* que quieres ponerte.');
  }
  if (data === 'crear_chat') {
    await actualizarEstado(env, userId, 'esperando_nombre_chat');
    return await sendMessage(env.BOT_TOKEN, chatId, '¿Qué nombre le quieres poner a tu chat?');
  }
}

// Manejo de estado del usuario
const estado = await obtenerEstado(env, userId);
const nombre = text;
const ref = (sub) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/${sub}`;

if (estado === 'esperando_nombre_publico') {
  await guardarTemporal(env, userId, { nombrePublico: nombre });
  await actualizarEstado(env, userId, 'esperando_usuario');
  return await sendMessage(env.BOT_TOKEN, chatId, 'Envíame el *nombre de usuario* que te quieras poner.');
}

if (estado === 'esperando_usuario') {
  await guardarTemporal(env, userId, { usuario: nombre });
  await actualizarEstado(env, userId, 'esperando_email');

  const sugerencias = ['nezu', 'nezukomi', 'admin'].map(base => `${base}@werdmail.web.app`);
  return await sendMessage(env.BOT_TOKEN, chatId, 'Elige un email que quieras:', [
    sugerencias.map(mail => ({ text: mail, callback_data: 'email:' + mail })),
    [{ text: 'Personalizado 📩', callback_data: 'email:personalizado' }]
  ]);
}

if (update.callback_query?.data?.startsWith('email:')) {
  const eleccion = update.callback_query.data.split(':')[1];
  if (eleccion === 'personalizado') {
    await actualizarEstado(env, userId, 'esperando_email_personalizado');
    return await sendMessage(env.BOT_TOKEN, chatId, 'Escribe tu email deseado (sin @).');
  } else {
    await guardarTemporal(env, userId, { email: eleccion });
    await actualizarEstado(env, userId, 'esperando_contrasena');
    return await sendMessage(env.BOT_TOKEN, chatId, 'Ahora elige una *contraseña* para tu cuenta.');
  }
}

if (estado === 'esperando_email_personalizado') {
  const email = nombre + '@werdmail.web.app';
  const yaExiste = await fetch(ref(`usuarios?key=${env.FIREBASE_API_KEY}&pageSize=1&filter=email%3D%3D%22${email}%22`)).then(r => r.json());
  if (yaExiste.documents?.length) return await sendMessage(env.BOT_TOKEN, chatId, 'Ese email ya está registrado. Intenta con otro.');
  await guardarTemporal(env, userId, { email });
  await actualizarEstado(env, userId, 'esperando_contrasena');
  return await sendMessage(env.BOT_TOKEN, chatId, 'Ahora elige una *contraseña* para tu cuenta.');
}

if (estado === 'esperando_contrasena') {
  const temp = await obtenerTemporal(env, userId);
  const nuevoUsuario = {
    nombrePublico: { stringValue: temp.nombrePublico },
    usuario: { stringValue: temp.usuario },
    email: { stringValue: temp.email },
    contrasena: { stringValue: nombre },
    telegramId: { stringValue: userId }
  };
  await fetch(ref(`usuarios/${userId}?key=${env.FIREBASE_API_KEY}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: nuevoUsuario })
  });
  await limpiarEstado(env, userId);
  await sendMessage(env.BOT_TOKEN, chatId, `¡Registro completo! Tu email es *${temp.email}*.`);
  return await sendMessage(env.BOT_TOKEN, chatId, `Puedes recibir correos aquí. ¡Bienvenido a WerdMail!`);
}

if (estado === 'esperando_nombre_chat') {
  const slug = Math.random().toString(36).substring(2, 10);
  const url = `https://${slug}.glitch.me`; // ejemplo, puedes cambiar a tu sistema de páginas
  await fetch(ref(`chats/${slug}?key=${env.FIREBASE_API_KEY}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        creador: { stringValue: userId },
        nombre: { stringValue: nombre },
        url: { stringValue: url },
        slug: { stringValue: slug }
      }
    })
  });
  await limpiarEstado(env, userId);
  return await sendMessage(env.BOT_TOKEN, chatId, `¡Chat privado creado! Comparte este enlace con tu comunidad:

${url}`); }

// Evento ocasional de donación
if (Math.random() < 0.01) {
  await sendPhoto(env.BOT_TOKEN, chatId, 'https://3up.kesug.com/uploads/img_686cae7460e00.png', '¿Quieres hacer una donación? Entra a este link y doname, así me ayudas a mejorar.\nhttps://ko-fi.com/Nezukomi');
}

return new Response('OK');

} };

// Utilidades async function sendMessage(token, chatId, text, botones = null) { const body = { chat_id: chatId, text, parse_mode: 'Markdown', ...(botones && { reply_markup: { inline_keyboard: botones } }) }; return fetch(https://api.telegram.org/bot${token}/sendMessage, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

async function sendPhoto(token, chatId, url, caption) { return fetch(https://api.telegram.org/bot${token}/sendPhoto, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, photo: url, caption }) }); }

async function actualizarEstado(env, userId, estado) { await env.WERDMAIL_STATES.put(estado:${userId}, estado); }

async function obtenerEstado(env, userId) { return await env.WERDMAIL_STATES.get(estado:${userId}); }

async function limpiarEstado(env, userId) { await env.WERDMAIL_STATES.delete(estado:${userId}); await env.WERDMAIL_STATES.delete(tmp:${userId}); }

async function guardarTemporal(env, userId, data) { const current = JSON.parse(await env.WERDMAIL_STATES.get(tmp:${userId}) || '{}'); const merged = { ...current, ...data }; await env.WERDMAIL_STATES.put(tmp:${userId}, JSON.stringify(merged)); }

async function obtenerTemporal(env, userId) { return JSON.parse(await env.WERDMAIL_STATES.get(tmp:${userId}) || '{}'); }

                                                 
