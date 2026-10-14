import json, secrets, time, requests, sys
from playwright.sync_api import sync_playwright
URL='https://qzxyatfdeijnubftjmdr.supabase.co'
rd=lambda n:open('/home/box/.secrets/pt-log-'+n+'.txt').read().strip()
ANON,SR,SIM=rd('anon'),rd('service_role'),rd('sim-secret')
ADM={'apikey':SR,'Authorization':'Bearer '+SR,'Content-Type':'application/json'}
APP=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/pt-log/'
TE,CE='ptltest-trainer@example.com','ptltest-client@example.com'
TP,CP=secrets.token_urlsafe(16),secrets.token_urlsafe(16)
ok=[];fail=[]
def check(name,cond,info=''):
    (ok if cond else fail).append(name);print(('PASS ' if cond else 'FAIL ')+name,info)
def mk(e,p):
    r=requests.post(URL+'/auth/v1/admin/users',headers=ADM,json={'email':e,'password':p,'email_confirm':True});r.raise_for_status();return r.json()['id']
def rest(path): return requests.get(URL+'/rest/v1/'+path,headers=ADM).json()
def login(pg,e,p): pg.goto(APP);pg.click('#login');pg.fill('#le',e);pg.fill('#lp',p);pg.click('#li')
ids=[];dialogs=[]
try:
    tid=mk(TE,TP);ids.append(tid);cu=mk(CE,CP);ids.append(cu)
    requests.patch(URL+'/rest/v1/ptl_profiles?id=eq.'+tid,headers=ADM,json={'role':'trainer'}).raise_for_status()
    local={'clients':[{'id':'c1','name':'Testklant','start':'2026-09-01','plan':'2x','notes':'','email':CE,'share':{'plan':True,'sessions':True},
        'pkg':{'size':8,'start':'2026-10-05'},'blocks':[{'id':'b1','start':'2026-10-05','freq':'2x','weeks':[{'ph':'Opbouw','sets':3,'reps':'10-12','rir':3,'hiit':'','dl':False}]*6,'swaps':{}}],
        'schema':{'A':[{'n':'Goblet squat','r':'8-12'},{'n':'Push-up','r':'8-12'}],'B':[{'n':'Reverse lunge','r':'8-12'}],'C':[]}}],
        'sessions':[{'id':'s1','clientId':'c1','training':'A','date':'2026-10-07','week':6,'ex':[{'n':'Goblet squat','r':'8-12','sets':[{'kg':16,'reps':10,'rir':2}],'note':''}],'sp':3,'en':7,'t':1}],'draft':None,'lib':{}}
    with sync_playwright() as p:
        b=p.chromium.launch()
        def page(ctx):
            pg=ctx.new_page();pg.on('dialog',lambda d:(dialogs.append(d.message),d.accept(d.default_value) if d.type=='prompt' else d.accept()));pg.on('pageerror',lambda e:print('  [pageerror]',e));pg.on('console',lambda m:print('  [console]',m.text[:200]) if m.type in('error','warning') else None);return pg
        ctx=b.new_context(viewport={'width':390,'height':844});pg=page(ctx)
        pg.add_init_script('if(!localStorage.getItem("ptlog-data-v1"))localStorage.setItem("ptlog-data-v1",%s)'%json.dumps(json.dumps(local)))
        login(pg,TE,TP);pg.wait_for_function('window.PTS&&PTS.role==="trainer"&&PTS.status==="ok"',timeout=25000)
        check('trainer import',len(rest('ptl_sessions?select=id'))==1 and len(rest('ptl_sets?select=id'))==1)
        # library + program via UI
        pg.click('#hlib');pg.click('#seed');pg.wait_for_selector('[data-x]');pg.fill('#q','Goblet');pg.click('[data-x]')
        pg.fill('#c','Borst omhoog, ellebogen binnen de knieën');pg.fill('#v','https://www.youtube.com/watch?v=MeIiIdhvXT4');pg.click('#sv')
        pg.wait_for_function('PTS.pending()===0',timeout=15000)
        ex=rest("ptl_exercises?select=data&data->>name=eq.Goblet%20squat");check('exercise library synced with cues',ex and 'Borst omhoog' in ex[0]['data']['cues'],len(rest('ptl_exercises?select=id')))
        pg.evaluate("PTS.ensure()");pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000)
        pg.click('#hprg');pg.click('#new');pg.wait_for_selector('#add');pg.select_option('#add','Goblet squat');pg.wait_for_function('PTS.pending()===0',timeout=15000)
        check('program builder synced',len(rest('ptl_programs?select=id'))==1)
        # products
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);pg.click('#hpay');pg.click('#seed');pg.wait_for_selector('text=Losse sessie')
        check('products seeded',len(rest('ptl_products?select=id'))==3)
        # offline session
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);ctx.set_offline(True);time.sleep(.3)
        pg.evaluate("PTL.D.sessions.push({id:'s2',clientId:'c1',training:'B',date:'2026-10-14',week:7,ex:[{n:'Push-up',r:'8-12',sets:[{kg:null,reps:12,rir:2}],note:''}],sp:2,en:8,t:Date.now()});PTL.save()")
        check('offline queued',pg.evaluate('PTS.pending()')==1 and len(rest('ptl_sessions?select=id'))==1)
        ctx.set_offline(False);pg.evaluate("dispatchEvent(new Event('online'))");pg.wait_for_function('PTS.pending()===0&&PTS.status==="ok"',timeout=20000)
        check('offline -> sync',len(rest('ptl_sessions?select=id'))==2)
        # client
        c3=b.new_context(viewport={'width':390,'height':844});p3=page(c3)
        login(p3,CE,CP);p3.wait_for_selector('text=Thuistraining loggen',timeout=25000)
        t=p3.inner_text('#app');check('client today view',('Training B' in t or 'Training A' in t) and 'Goblet' in t or 'Reverse lunge' in t,t[:80].replace('\n',' | '))
        p3.goto(APP);p3.wait_for_selector('text=Thuistraining loggen',timeout=25000)
        p3.click('#lg');p3.fill('input[data-k=kg] >> nth=0','10');p3.fill('input[data-k=reps] >> nth=0','12');p3.click('#sv');time.sleep(2)
        check('client home workout saved',len(rest('ptl_home_workouts?select=id'))==1)
        p3.click('[data-tab=checkin]');p3.wait_for_selector('#sl');p3.check('[data-h=water]');p3.fill('#sl','7,5');p3.click('.score[data-k=energie] button >> nth=7')
        c3.set_offline(True);p3.click('#sv');time.sleep(1);check('client offline check-in queued',p3.evaluate('PTS.outbox()')==1 and len(rest('ptl_checkins?select=id'))==0)
        c3.set_offline(False);p3.evaluate("dispatchEvent(new Event('online'))");time.sleep(3);ci=rest('ptl_checkins?select=data')
        check('client check-in synced',len(ci)==1 and ci[0]['data'].get('slaap')==7.5)
        p3.click('[data-tab=voortgang]');p3.wait_for_selector('#bk');p3.fill('#bk','81,4');p3.fill('#bt','88');p3.click('#bs');time.sleep(2)
        check('client body weight',rest('ptl_body?select=data')[0]['data']['kg']==81.4)
        p3.wait_for_selector('#bw canvas',timeout=10000);p3.screenshot(path='tests/client-voortgang.png',full_page=True)
        # chat realtime
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);pg.click('[data-c=c1]');pg.click('#cchat');pg.wait_for_selector('#mi');time.sleep(2)
        p3.click('[data-tab=chat]');p3.wait_for_selector('#mi');p3.fill('#mi','Hoi coach, mag ik morgen later komen?');p3.click('#ms')
        try: pg.wait_for_selector('text=Hoi coach',timeout=10000);check('chat realtime client->trainer',True)
        except Exception as e: check('chat realtime client->trainer',False,str(e)[:80])
        pg.fill('#mi','Prima, 18:00!');pg.click('#ms')
        try: p3.wait_for_selector('text=Prima, 18:00',timeout=10000);check('chat realtime trainer->client',True)
        except Exception as e: check('chat realtime trainer->client',False)
        p3.screenshot(path='tests/client-chat.png')
        # payment: without key -> friendly error
        p3.click('[data-tab=winkel]');p3.wait_for_selector('[data-buy]',timeout=15000);dialogs.clear();p3.click('[data-buy] >> nth=0')
        for _ in range(30):
            if dialogs: break
            p3.wait_for_timeout(500)
        check('no Mollie key -> friendly message',any('nog niet ingesteld' in d for d in dialogs),dialogs)
        p3.screenshot(path='tests/client-winkel.png',full_page=True)
        p3.evaluate("PTS.simHeader=%s"%json.dumps(SIM));p3.click('[data-buy] >> nth=0');p3.wait_for_selector('text=Betaling controleren',timeout=15000)
        pay=rest('ptl_payments?select=*&status=eq.open')[0];check('pay-create made open payment',pay['strips']==8 and pay['mollie_id'].startswith('tr_sim_'))
        r=requests.post(URL+'/functions/v1/pay-webhook',headers={'x-ptl-sim':SIM,'Content-Type':'application/json'},json={'id':pay['mollie_id'],'status':'paid','method':'ideal'})
        check('webhook marks paid + invoice no',r.ok and r.json().get('status')=='paid' and r.json().get('invoice_no','').startswith('PT'),r.text[:120])
        r2=requests.post(URL+'/functions/v1/pay-webhook',headers={'x-ptl-sim':SIM,'Content-Type':'application/json'},json={'id':pay['mollie_id'],'status':'paid','method':'ideal'})
        check('webhook idempotent',r2.json().get('invoice_no')==r.json().get('invoice_no'))
        r3=requests.post(URL+'/functions/v1/pay-webhook',json={'id':pay['mollie_id'],'status':'paid'});check('webhook ignores unsigned payload',r3.text in('ok','not configured'),r3.text)
        p3.wait_for_selector('text=Betaald, bedankt',timeout=20000);check('client sees paid',True)
        pg.evaluate('PTS.syncNow()');pg.wait_for_function("(PTL.D.payments||[]).some(p=>p.status==='paid')",timeout=15000)
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);pg.click('[data-c=c1]');txt=pg.inner_text('#app')
        check('strippen +8 in period (8+8=16)','/16' in txt,[l for l in txt.split('\n') if 'Periode' in l])
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);pg.click('#hpay');pg.wait_for_selector('text=betaald');pg.screenshot(path='tests/trainer-betalingen.png',full_page=True)
        with pg.expect_download() as d: pg.click('#csv')
        csv=open(d.value.path(),encoding='utf-8-sig').read();check('CSV export',pay['mollie_id'] in csv and 'Factuurnummer' in csv)
        pg.goto(APP);pg.wait_for_function('PTS.status==="ok"',timeout=20000);pg.click('[data-c=c1]');pg.click('#cdat');pg.wait_for_selector('text=Thuistrainingen (1)',timeout=15000);check('trainer sees client data',True)
        b.close()
    # RLS with client JWT
    tok=requests.post(URL+'/auth/v1/token?grant_type=password',headers={'apikey':ANON},json={'email':CE,'password':CP}).json()['access_token']
    H={'apikey':ANON,'Authorization':'Bearer '+tok,'Content-Type':'application/json','Prefer':'return=representation'}
    po=lambda t,j:requests.post(URL+'/rest/v1/'+t,headers=H,json=j)
    check('RLS: client cannot insert trainer session',po('ptl_sessions',{'id':'hack','trainer_id':cu,'client_id':'c1','data':{}}).status_code==403)
    r=requests.patch(URL+'/rest/v1/ptl_sessions?id=eq.s1',headers=H,json={'data':{}});check('RLS: client cannot update trainer session',r.text=='[]')
    check('RLS: client cannot insert payment',po('ptl_payments',{'trainer_id':tid,'client_id':'c1','description':'x','amount_cents':1,'status':'paid'}).status_code in(401,403))
    r=requests.patch(URL+'/rest/v1/ptl_products?name=eq.Losse%20sessie',headers=H,json={'price_cents':100});check('RLS: client cannot change prices',r.status_code>=400 or r.text=='[]')
    check('RLS: client cannot fake trainer message',po('ptl_messages',{'client_id':'c1','body':'x','from_trainer':True}).status_code==403)
    check('RLS: client cannot write for other client',po('ptl_home_workouts',{'id':'x2','client_id':'other','data':{}}).status_code in(403,409))
    check('RLS: client cannot read strippen',requests.get(URL+'/rest/v1/ptl_strippen?select=id',headers=H).json()==[])
    r=requests.post(URL+'/rest/v1/rpc/ptl_payment_status',headers=H,json={'p_mollie_id':'x','p_status':'paid','p_method':None,'p_paid_at':None});check('RLS: client cannot call payment rpc',r.status_code in(401,403,404),r.status_code)
    ttok=requests.post(URL+'/auth/v1/token?grant_type=password',headers={'apikey':ANON},json={'email':TE,'password':TP}).json()['access_token']
    TH=dict(H,Authorization='Bearer '+ttok);r=requests.post(URL+'/rest/v1/ptl_home_workouts',headers=TH,json={'id':'tw','client_id':'c1','data':{}});check('RLS: trainer cannot write client home workouts',r.status_code==403)
finally:
    for i in ids: requests.delete(URL+'/auth/v1/admin/users/'+i,headers=ADM)
    left=[u['email'] for u in requests.get(URL+'/auth/v1/admin/users',headers=ADM).json()['users'] if 'ptltest' in u['email']]
    rows=sum(len(rest(t+'?select=id')) for t in ['ptl_clients','ptl_sessions','ptl_payments','ptl_products','ptl_messages','ptl_exercises'])
    print('cleanup: test users left',left,'rows left',rows)
    print(f'\n{len(ok)} passed, {len(fail)} failed', fail)
