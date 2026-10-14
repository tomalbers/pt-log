// Creates a Mollie payment for a product, bought by the logged-in client.
// Secrets: MOLLIE_API_KEY (test_... ; live keys refused unless PTL_ALLOW_LIVE=1), APP_URL, optional PTL_SIM_SECRET (tests only).
const SB = Deno.env.get('SUPABASE_URL')!, SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP = Deno.env.get('APP_URL') ?? 'https://tomalbers.github.io/pt-log/';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ptl-sim', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const db = (p: string, init: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...init, headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return j({ error: 'POST only' }, 405);
  try {
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: req.headers.get('Authorization') ?? '' } });
    if (!u.ok) return j({ error: 'Niet ingelogd' }, 401);
    const user = await u.json();
    if (!user.email_confirmed_at && !user.confirmed_at) return j({ error: 'E-mail niet bevestigd' }, 403);
    const { product_id } = await req.json();
    const email = String(user.email).toLowerCase();
    const cl = (await (await db(`ptl_clients?email=eq.${encodeURIComponent(email)}&deleted=eq.false&select=id,trainer_id,data&limit=1`)).json())[0];
    if (!cl) return j({ error: 'Geen klantprofiel gevonden voor dit e-mailadres' }, 403);
    const pr = (await (await db(`ptl_products?id=eq.${encodeURIComponent(product_id)}&active=eq.true&trainer_id=eq.${cl.trainer_id}&select=*`)).json())[0];
    if (!pr) return j({ error: 'Product niet gevonden' }, 404);

    const simSecret = Deno.env.get('PTL_SIM_SECRET');
    const sim = !!simSecret && req.headers.get('x-ptl-sim') === simSecret;
    const key = Deno.env.get('MOLLIE_API_KEY') ?? '';
    if (!sim) {
      if (!key) return j({ error: 'Online betalen is nog niet ingesteld door je trainer.' }, 503);
      if (!key.startsWith('test_') && Deno.env.get('PTL_ALLOW_LIVE') !== '1') return j({ error: 'Alleen testmodus is toegestaan.' }, 503);
    }
    const desc = `${pr.name} – ${cl.data?.name ?? email}`.slice(0, 250);
    const ins = await db('ptl_payments', { method: 'POST', body: JSON.stringify({ trainer_id: cl.trainer_id, client_id: cl.id, user_id: user.id, product_id: pr.id, description: desc, amount_cents: pr.price_cents, strips: pr.strips, status: 'open', test_mode: sim || key.startsWith('test_') }) });
    if (!ins.ok) return j({ error: 'Opslaan mislukt' }, 500);
    const pay = (await ins.json())[0];
    const redirectUrl = `${APP}#betaling/${pay.id}`;
    let mollieId: string, checkoutUrl: string;
    if (sim) { mollieId = `tr_sim_${pay.id.slice(0, 8)}`; checkoutUrl = redirectUrl; }
    else {
      const m = await fetch('https://api.mollie.com/v2/payments', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: { currency: 'EUR', value: (pr.price_cents / 100).toFixed(2) }, description: desc, redirectUrl,
          webhookUrl: `${SB}/functions/v1/pay-webhook`, method: ['ideal', 'bancontact', 'creditcard'], locale: 'nl_NL', metadata: { payment_id: pay.id } }) });
      const mj = await m.json();
      if (!m.ok) { await db(`ptl_payments?id=eq.${pay.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) }); return j({ error: 'Mollie: ' + (mj.detail ?? m.status) }, 502); }
      mollieId = mj.id; checkoutUrl = mj._links.checkout.href;
    }
    await db(`ptl_payments?id=eq.${pay.id}`, { method: 'PATCH', body: JSON.stringify({ mollie_id: mollieId }) });
    return j({ payment_id: pay.id, checkoutUrl, mollie_id: mollieId });
  } catch (e) { console.error(e); return j({ error: 'Er ging iets mis' }, 500); }
});
