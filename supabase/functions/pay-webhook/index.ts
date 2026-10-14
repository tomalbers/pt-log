// Mollie webhook: Mollie posts "id=tr_xxx". We never trust the body: the status is fetched from Mollie with our key.
// Test mode without a key: a simulated JSON payload is accepted only with header x-ptl-sim == PTL_SIM_SECRET.
const SB = Deno.env.get('SUPABASE_URL')!, SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAP: Record<string, string> = { paid: 'paid', open: 'open', pending: 'pending', authorized: 'pending', canceled: 'canceled', expired: 'expired', failed: 'failed' };
async function apply(id: string, status: string, method: string | null, paidAt: string | null) {
  const r = await fetch(`${SB}/rest/v1/rpc/ptl_payment_status`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_mollie_id: id, p_status: MAP[status] ?? 'open', p_method: method, p_paid_at: paidAt }) });
  return r.ok ? await r.json() : null;
}
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  try {
    const simSecret = Deno.env.get('PTL_SIM_SECRET');
    if (simSecret && req.headers.get('x-ptl-sim') === simSecret) {
      const p = await req.json();
      if (!String(p.id).startsWith('tr_sim_')) return new Response('bad sim id', { status: 400 });
      const row = await apply(p.id, p.status, p.method ?? null, p.paidAt ?? null);
      return new Response(JSON.stringify(row), { headers: { 'Content-Type': 'application/json' } });
    }
    const form = await req.formData().catch(() => null);
    const id = form?.get('id')?.toString() ?? '';
    if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new Response('ok'); // ignore junk, Mollie expects 200
    const key = Deno.env.get('MOLLIE_API_KEY');
    if (!key) return new Response('not configured', { status: 503 });
    const m = await fetch(`https://api.mollie.com/v2/payments/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!m.ok) return new Response('ok');
    const p = await m.json();
    await apply(p.id, p.status, p.method ?? null, p.paidAt ?? null);
    return new Response('ok');
  } catch (e) { console.error(e); return new Response('error', { status: 500 }); }
});
