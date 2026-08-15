// Edge Function: send-push
// Recibe un webhook de Supabase (pg_net) cuando hay un pedido nuevo,
// un cambio de estado de pedido o un cambio de estado de reporte,
// y envía una notificación push FCM al usuario implicado.
//
// Secrets requeridos (Settings -> Functions -> Secrets):
//   FIREBASE_SERVICE_ACCOUNT = JSON completo de la service account de Firebase
//   WEBHOOK_SECRET = el mismo valor usado en la migración SQL
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_API_URL = 'https://fcm.googleapis.com/v1/projects/';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type FCMResponse = { error?: { status?: number } };

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

// --- Utilidades JWT (RS256) con WebCrypto nativo de Deno ---

function base64url(input: string | Uint8Array): string {
  const str = typeof input === 'string' ? input : new TextDecoder().decode(input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function buildJwt(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: FCM_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${base64urlBytes(new Uint8Array(signature))}`;
}

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const assertion = await buildJwt(sa);
  const res = await fetch(FCM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No se pudo obtener access token FCM: ' + JSON.stringify(data));
  }
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

// --- Mensajes según el evento ---

function buildMessage(event: any): { userId?: string; admins?: boolean; title: string; body: string; data: Record<string, string> } | null {
  const { type, table, record } = event;
  if (!record) return null;

  if (table === 'orders' && type === 'INSERT') {
    return {
      userId: record.seller_id,
      title: '¡Nuevo pedido recibido!',
      body: 'Un comprador realizó un pedido en tu emprendimiento.',
      data: { type: 'order', order_id: record.id },
    };
  }

  if (table === 'orders' && type === 'UPDATE') {
    if (record.status === 'cancelled' && record.cancelled_by === record.buyer_id) {
      return {
        userId: record.seller_id,
        title: 'Pedido cancelado por el comprador',
        body: 'Un comprador canceló su pedido.',
        data: { type: 'order', order_id: record.id },
      };
    }
    const map: Record<string, { title: string; body: string }> = {
      accepted: { title: 'Pedido aceptado', body: 'Tu pedido ha sido aceptado por el vendedor y está en cola.' },
      preparing: { title: 'Preparándose', body: 'Tu pedido ya se está preparando. ¡Casi listo!' },
      ready: { title: 'Tu pedido está listo', body: '¡El vendedor ha terminado tu pedido! Ya puedes recogerlo.' },
      completed: { title: 'Pedido completado', body: '¡Gracias por tu compra! Esperamos que lo disfrutes.' },
      cancelled: { title: 'Pedido cancelado', body: 'Tu pedido fue cancelado. Comunícate con el vendedor si tienes dudas.' },
    };
    const m = map[record.status];
    if (!m) return null;
    return {
      userId: record.buyer_id,
      title: m.title,
      body: m.body,
      data: { type: 'order', order_id: record.id },
    };
  }

  if (table === 'product_reports' && type === 'INSERT') {
    return {
      admins: true,
      title: 'Nuevo reporte de producto',
      body: 'Un usuario reportó un producto como inapropiado. Revísalo en la sección de reportes.',
      data: { type: 'report', report_id: record.id },
    };
  }

  if (table === 'product_reports' && type === 'UPDATE') {
    if (record.status === 'resolved') {
      return {
        userId: record.reporter_id,
        title: 'Reporte aceptado y en revisión',
        body: 'Tu reporte fue aceptado por los moderadores y está siendo revisado. ¡Gracias por tu ayuda!',
        data: { type: 'report', report_id: record.id },
      };
    }
    if (record.status === 'rejected') {
      return {
        userId: record.reporter_id,
        title: 'Reporte rechazado',
        body: 'Tu reporte fue evaluado y rechazado por los moderadores. Si tienes dudas, escríbenos a soporte.',
        data: { type: 'report', report_id: record.id },
      };
    }
  }

  if (table === 'support_tickets' && type === 'UPDATE') {
    const old = event.old ?? {};
    const replyAdded = !!record.admin_reply && record.admin_reply !== old.admin_reply;
    const statusChanged = record.status !== old.status;
    if (replyAdded) {
      return {
        userId: record.user_id,
        title: 'Respuesta del equipo de soporte',
        body: `Respondimos tu ticket "${record.subject}". Revisa la sección de soporte.`,
        data: { type: 'support', ticket_id: record.id },
      };
    }
    if (statusChanged && (record.status === 'resolved' || record.status === 'closed')) {
      return {
        userId: record.user_id,
        title: 'Ticket resuelto',
        body: `Tu ticket "${record.subject}" fue resuelto.`,
        data: { type: 'support', ticket_id: record.id },
      };
    }
  }

  if (table === 'support_messages' && type === 'INSERT') {
    const snippet = (record.body ?? '').slice(0, 120);
    if (record.sender_role === 'admin') {
      return {
        userId: record.participant_id,
        title: 'Nuevo mensaje de soporte',
        body: `El equipo de soporte te escribió: "${snippet}"`,
        data: { type: 'support', ticket_id: record.ticket_id },
      };
    }
    if (record.sender_role === 'buyer' || record.sender_role === 'seller') {
      return {
        admins: true,
        title: 'Nuevo mensaje en una disputa',
        body: `Un participante respondió: "${snippet}"`,
        data: { type: 'support', ticket_id: record.ticket_id },
      };
    }
  }

  return null;
}

// --- Envío a FCM ---

async function sendToToken(accessToken: string, projectId: string, token: string, msg: any): Promise<FCMResponse> {
  const res = await fetch(`${FCM_API_URL}${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'pedidos',
            sound: 'default',
          },
        },
      },
    }),
  });
  return res.json();
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!WEBHOOK_SECRET || req.headers.get('Authorization') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!SERVICE_ACCOUNT_JSON) {
    return new Response('FIREBASE_SERVICE_ACCOUNT not configured', { status: 500 });
  }

  try {
    const event = await req.json();
    console.log('send-push: evento recibido', JSON.stringify({ type: event.type, table: event.table, id: event.record?.id, status: event.record?.status }));
    const msg = buildMessage(event);
    if (!msg) {
      return Response.json({ skipped: true, reason: 'evento no relevante' });
    }

    let userIds: string[];
    if (msg.admins) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');
      userIds = (admins ?? []).map((a: any) => a.id);
      console.log('send-push: destinatarios admins =', userIds.length);
    } else if (msg.userId) {
      userIds = [msg.userId];
      console.log('send-push: destinatario userId=', msg.userId);
    } else {
      return Response.json({ skipped: true, reason: 'sin destinatario' });
    }

    if (userIds.length === 0) {
      return Response.json({ skipped: true, reason: 'sin destinatarios' });
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);
    console.log('send-push: tokens encontrados =', tokens?.length ?? 0);

    if (!tokens || tokens.length === 0) {
      return Response.json({ skipped: true, reason: 'sin tokens para el usuario' });
    }

    const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
    const accessToken = await getAccessToken();

    const results = [];
    for (const t of tokens) {
      const response = await sendToToken(accessToken, sa.project_id, t.token, msg);
      if (response.error?.status === 404 || response.error?.status === 410) {
        await supabase.from('push_tokens').delete().eq('token', t.token);
      }
      results.push({ ok: !response.error, error: response.error ?? null });
    }

    console.log('send-push: resultados', JSON.stringify(results));
    return Response.json({ sent: results.filter(r => r.ok).length, results });
  } catch (err: any) {
    console.error('send-push error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
