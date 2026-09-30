import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, Check, ChevronRight, Flame, LogOut, MapPin, Menu, Plus, Search, ShieldCheck, Sparkles, Ticket, UserRound, X, Zap } from 'lucide-react';
import './styles.css';
import { supabase } from '../lib/supabase';

type EventRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  hero_image_url: string | null;
  poster_image_url: string | null;
  mobile_banner_url: string | null;
  tags: string[] | null;
  featured: boolean;
  show_on_home: boolean;
  status: 'draft' | 'published' | 'sold_out' | 'archived';
  created_at?: string;
};

type PassRow = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_paise: number;
  inventory: number;
  sold: number;
  active: boolean;
  display_order: number;
};

type EventView = EventRow & {
  passes: PassRow[];
  price: number;
  progress: number;
};

type EventForm = {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  location: string;
  event_date: string;
  start_time: string;
  hero_image_url: string;
  poster_image_url: string;
  mobile_banner_url: string;
  tags: string;
  status: EventRow['status'];
  featured: boolean;
  show_on_home: boolean;
};

type PassForm = {
  event_id: string;
  name: string;
  description: string;
  price_rupees: string;
  inventory: string;
  display_order: string;
  active: boolean;
};

const emptyEventForm = (): EventForm => ({
  name: '', slug: '', subtitle: '', description: '', location: '', event_date: '', start_time: '',
  hero_image_url: '', poster_image_url: '', mobile_banner_url: '', tags: '', status: 'draft', featured: false, show_on_home: true,
});

const emptyPassForm = (): PassForm => ({
  event_id: '', name: '', description: '', price_rupees: '', inventory: '', display_order: '0', active: true,
});

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`)).toUpperCase() : 'DATE TBA';
const timeLabel = (time: string | null) => {
  if (!time) return 'TIME TBA';
  const [h = 0, m = 0] = time.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
};
const demoBackground = (name: string) => {
  const seed = (name || 'MNG LIVE').length % 3;
  return seed === 0 ? 'linear-gradient(135deg,#071a3d,#174aa6 50%,#62a7ff)' : seed === 1 ? 'linear-gradient(135deg,#061429,#0d4f91 55%,#58b8ff)' : 'linear-gradient(135deg,#081021,#1e3a8a 55%,#7dd3fc)';
};

async function getPublishedEvents(): Promise<EventView[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home,status')
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('event_date', { ascending: true });
  if (eventError) throw eventError;
  const ids = (events || []).map((row: EventRow) => row.id);
  if (!ids.length) return [];
  const { data: passes, error: passError } = await supabase
    .from('pass_types')
    .select('id,event_id,name,description,price_paise,inventory,sold,active,display_order')
    .in('event_id', ids)
    .eq('active', true)
    .order('display_order', { ascending: true });
  if (passError) throw passError;
  const passRows = (passes || []) as PassRow[];
  return (events || []).filter((e: EventRow) => e.show_on_home).map((e: EventRow) => {
    const ep = passRows.filter((p) => p.event_id === e.id);
    const inventory = ep.reduce((sum, p) => sum + Math.max(0, p.inventory), 0);
    const sold = ep.reduce((sum, p) => sum + Math.max(0, p.sold), 0);
    return { ...e, passes: ep, price: ep.length ? Math.min(...ep.map(p => Number(p.price_paise))) / 100 : 0, progress: inventory ? Math.round((sold / inventory) * 100) : 0 };
  });
}

function useRoute() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => { const listener = () => setRoute(window.location.pathname); window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, []);
  const navigate = (to: string) => { window.history.pushState({}, '', to); setRoute(to); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return { route, navigate };
}

function Header({ navigate }: { navigate: (to: string) => void }) {
  const [menu, setMenu] = useState(false);
  return <header className="topbar">
    <button className="brand" onClick={() => navigate('/')}><span className="brand-orbit">✦</span><span>MARS NOVA</span></button>
    <nav className="desktop-nav"><button onClick={() => navigate('/')}>Events</button><button>Categories</button><button>MNG Radar</button><button onClick={() => navigate('/partner')}>Partners</button></nav>
    <div className="nav-actions"><button className="icon-btn"><Search size={18}/></button><button className="ticket-link" onClick={() => navigate('/partner')}><Ticket size={16}/> Partner</button><button className="avatar"><UserRound size={17}/></button><button className="mobile-menu icon-btn" onClick={() => setMenu(!menu)}>{menu ? <X size={20}/> : <Menu size={20}/>}</button></div>
    {menu && <div className="mobile-nav"><button onClick={() => navigate('/')}>Events</button><button>MNG Radar</button><button>Categories</button><button onClick={() => navigate('/partner')}>Partner Login</button></div>}
  </header>;
}

function Home({ navigate }: { navigate: (to: string) => void }) {
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; getPublishedEvents().then(data => alive && setEvents(data)).catch(e => alive && setError(e instanceof Error ? e.message : 'Unable to load events.')).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, []);
  const hero = events[0];
  return <div><Header navigate={navigate}/><main>
    <section className="hero-shell"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> MNG RADAR · LIVE EVENTS</div><h1>Your next<br/><span>experience</span> awaits.</h1><p>Discover concerts, festivals and nights worth remembering — all in one trusted place.</p><div className="hero-actions"><button className="primary" onClick={() => hero ? navigate(`/events/${hero.slug}`) : document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' })}>Explore events <ArrowRight size={18}/></button><button className="ghost">How MNG works <ChevronRight size={17}/></button></div><div className="trust-row"><span><ShieldCheck size={16}/> Secure checkout</span><span><Zap size={16}/> Instant QR ticket</span></div></div><div className="hero-art"><div className="hero-glow"/><div className="hero-poster" style={{ background: hero?.hero_image_url ? `url(${hero.hero_image_url}) center/cover` : demoBackground(hero?.name || '') }}><div className="poster-mini">MNG<br/><b>LIVE</b></div><div className="poster-title">{hero ? hero.name.toUpperCase().slice(0, 18) : 'YOUR NEXT'}<br/><span>{hero ? dateLabel(hero.event_date) : 'EXPERIENCE'}</span></div><div className="poster-meta">{hero ? `${dateLabel(hero.event_date)} · ${hero.location || 'LOCATION TBA'}` : 'MNG TICKETING'}</div><div className="poster-stamp">MNG<br/>LIVE</div></div></div></section>
    <section className="section" id="events"><div className="section-head"><div><div className="kicker">DISCOVER</div><h2>Upcoming experiences</h2></div><button className="text-btn">View all <ArrowRight size={16}/></button></div>{loading ? <div className="empty"><Sparkles size={28}/><h2>Loading events…</h2><p>Fetching published events from MNG.</p></div> : error ? <div className="empty"><h2>We couldn't load events</h2><p>{error}</p></div> : events.length ? <div className="event-grid">{events.slice(0, 3).map(e => <EventCard key={e.id} event={e} navigate={navigate}/>)}</div> : <div className="empty"><Sparkles size={28}/><h2>No events published yet</h2><p>Your storefront is connected to Supabase. Publish your first event from the Admin panel.</p></div>}</section>
    {events.length > 0 && <section className="section radar"><div className="section-head"><div><div className="kicker">REAL-TIME</div><h2>MNG Radar</h2></div><div className="radar-live"><span className="live-dot"/> Live</div></div><div className="radar-grid">{events.map(e => <div className="radar-item" key={e.id} onClick={() => navigate(`/events/${e.slug}`)}><div className="radar-name"><span>{e.name}</span><b>{e.progress}%</b></div><div className="bar"><i style={{ width: `${e.progress}%` }}/></div><small>{e.progress >= 90 ? 'High demand' : e.progress > 75 ? 'Fast moving' : 'Tickets available'}</small></div>)}</div></section>}
    <section className="section"><div className="section-head"><div><div className="kicker">EXPLORE</div><h2>Find your scene</h2></div></div><div className="chips"><button>🎤 Concerts</button><button>🎉 Festivals</button><button>🌙 Nightlife</button><button>🎭 Shows</button><button>✨ Experiences</button><button>🏟 Sports</button></div></section>
  </main><footer><div className="footer-brand">✦ MARS NOVA</div><p>Events · Experiences · Memories</p><span>© 2026 Mars Nova Global</span></footer></div>;
}

function EventCard({ event, navigate }: { event: EventView; navigate: (to: string) => void }) { return <article className="event-card" onClick={() => navigate(`/events/${event.slug}`)}><div className="event-image" style={{ background: event.hero_image_url ? `url(${event.hero_image_url}) center/cover` : demoBackground(event.name) }}><div className="poster-word">{event.name.toUpperCase().slice(0, 16)}</div><span className="tag">{(event.tags?.[0] || (event.featured ? 'FEATURED' : 'MNG EVENT')).toUpperCase()}</span><span className="heart">♡</span><div className="date-badge"><b>{event.event_date ? new Date(`${event.event_date}T00:00:00`).getDate() : '—'}</b><span>{event.event_date ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${event.event_date}T00:00:00`)).toUpperCase() : 'TBA'}</span></div></div><div className="event-body"><div className="event-title"><h3>{event.name}</h3><ArrowRight size={17}/></div><p>{event.subtitle || 'MNG verified experience'}</p><div className="event-meta"><span><CalendarDays size={14}/>{dateLabel(event.event_date)} · {timeLabel(event.start_time)}</span><span><MapPin size={14}/>{event.location || 'Location TBA'}</span></div><div className="event-bottom"><span>{event.price ? <>From <b>{money(event.price)}</b></> : 'Pricing TBA'}</span><span className="availability"><span className="mini-bar"><i style={{ width: `${event.progress}%` }}/></span>{event.progress}% sold</span></div></div></article>; }

function EventPage({ slug, navigate }: { slug: string; navigate: (to: string) => void }) {
  const [event, setEvent] = useState<EventView | null>(null); const [selected, setSelected] = useState(''); const [qty, setQty] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let alive=true; (async()=>{ try{ if(!supabase) throw new Error('Supabase is not configured.'); const {data:e,error:eErr}=await supabase.from('events').select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home,status').eq('slug',slug).eq('status','published').single(); if(eErr) throw eErr; const {data:p,error:pErr}=await supabase.from('pass_types').select('id,event_id,name,description,price_paise,inventory,sold,active,display_order').eq('event_id',e.id).eq('active',true).order('display_order',{ascending:true}); if(pErr) throw pErr; const passes=(p||[]) as PassRow[]; const inventory=passes.reduce((s,x)=>s+Math.max(0,x.inventory),0); const sold=passes.reduce((s,x)=>s+Math.max(0,x.sold),0); const view={...(e as EventRow),passes,price:passes.length?Math.min(...passes.map(x=>Number(x.price_paise)))/100:0,progress:inventory?Math.round((sold/inventory)*100):0}; if(alive){setEvent(view);setSelected(passes[0]?.id || '');setLoading(false);} }catch(e){alive&&setError(e instanceof Error?e.message:'Unable to load event.');alive&&setLoading(false);} })(); return()=>{alive=false}; },[slug]);
  if(loading)return <div><Header navigate={navigate}/><main className="event-page"><div className="empty"><h2>Loading event…</h2></div></main></div>;
  if(error||!event)return <div><Header navigate={navigate}/><main className="event-page"><button className="back" onClick={()=>navigate('/')}>← Back</button><div className="empty"><h2>Event not found</h2><p>{error}</p></div></main></div>;
  const current=event.passes.find(p=>p.id===selected)||event.passes[0]; const available=current?Math.max(0,current.inventory-current.sold):0; const total=current?Number(current.price_paise)/100*qty:0;
  return <div><Header navigate={navigate}/><main className="event-page"><button className="back" onClick={()=>navigate('/')}>← Back to events</button><div className="event-hero"><div className="big-art" style={{background:event.hero_image_url?`url(${event.hero_image_url}) center/cover`:demoBackground(event.name)}}><div className="big-word">{event.name.toUpperCase().slice(0,18)}</div><span className="tag">MNG VERIFIED</span></div><div className="event-info"><div className="kicker">MNG VERIFIED EVENT</div><h1>{event.name}</h1><p className="subtitle">{event.subtitle || 'An MNG verified experience'}</p><div className="info-list"><span><CalendarDays/>{dateLabel(event.event_date)} · {timeLabel(event.start_time)}</span><span><MapPin/>{event.location || 'Location TBA'}</span></div><p className="description">{event.description || 'An unforgettable experience curated by Mars Nova Global. Your digital ticket is generated after verified payment.'}</p>{event.progress>0&&<div className="event-fomo"><Flame size={16}/> {event.progress}% of the released inventory is sold</div>}</div></div><section className="booking"><div><div className="kicker">CHOOSE YOUR PASS</div><h2>Make it your night.</h2>{event.passes.length?event.passes.map(p=>{const left=Math.max(0,p.inventory-p.sold);return <button key={p.id} className={`pass-row ${selected===p.id?'selected':''}`} disabled={left<=0} onClick={()=>{setSelected(p.id);setQty(1)}}><span><b>{p.name}</b><small>{p.description || (left>0?`${left} available`:'Sold out')}</small></span><strong>{money(Number(p.price_paise)/100)}</strong></button>}):<div className="empty"><p>No active passes available yet.</p></div>}</div><aside className="order-card"><div className="order-top"><span>Your booking</span><Ticket size={18}/></div>{current?<><div className="qty"><span>{current.name}</span><div><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><b>{qty}</b><button onClick={()=>setQty(Math.min(Math.max(1,available),qty+1))}>+</button></div></div><div className="order-total"><span>Total</span><b>{money(total)}</b></div><button className="primary full" disabled={available<=0}>Continue to secure payment <ArrowRight size={18}/></button><small className="secure"><ShieldCheck size={14}/> The server will revalidate price and inventory before Razorpay.</small></>:<small className="secure">Choose an available pass.</small>}</aside></section></main></div>;
}

function Admin({ navigate }: { navigate: (to: string) => void }) {
  const [session,setSession]=useState<any>(null); const [checking,setChecking]=useState(true); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [tab,setTab]=useState('Dashboard');
  useEffect(()=>{if(!supabase){setChecking(false);return;} supabase.auth.getSession().then(({data})=>{setSession(data.session);setChecking(false)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>subscription.unsubscribe();},[]);
  const login=async()=>{if(!supabase)return;setError('');const {data,error:e}=await supabase.auth.signInWithPassword({email,password});if(e){setError(e.message);return;} if(!data.session)return;const {data:p,error:pErr}=await supabase.from('profiles').select('role').eq('id',data.session.user.id).maybeSingle(); if(pErr||!p||!['owner','admin','event_manager'].includes(p.role)){await supabase.auth.signOut();setError('This account does not have MNG admin access.');return;}setSession(data.session);};
  if(checking)return <div className="portal"><main className="portal-main"><div className="empty"><h2>Checking Admin access…</h2></div></main></div>;
  if(!session)return <div className="portal"><main className="portal-main"><form className="login-card" onSubmit={e=>{e.preventDefault();void login()}}><div className="login-mark">✦</div><div className="kicker">MNG ADMIN</div><h1>Control your<br/><span>ticketing system.</span></h1><p>Sign in with your Supabase admin account.</p><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{error&&<div className="form-error">{error}</div>}<button className="primary full" type="submit">Sign in <ArrowRight size={18}/></button><button className="ghost full" type="button" onClick={()=>navigate('/')}>← Public website</button></form></main></div>;
  const logout=async()=>{if(supabase)await supabase.auth.signOut();setSession(null);};
  return <div className="portal"><aside className="sidebar"><button className="brand side-brand" onClick={()=>navigate('/')}>✦ MARS NOVA</button><div className="side-kicker">ADMIN CONSOLE</div>{['Dashboard','Events','Pass Types','Orders','Partners','Homepage','Marketing','Settings'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}<button className="side-back" onClick={()=>navigate('/')}>← Public website</button><button className="side-logout" onClick={()=>void logout()}><LogOut size={14}/> Sign out</button></aside><main className="portal-main"><div className="portal-top"><div><div className="kicker">ADMIN CONSOLE</div><h1>{tab}</h1></div><div className="admin-user">{session.user.email}</div></div>{tab==='Dashboard'?<AdminDashboard/>:tab==='Events'?<AdminEvents/>:tab==='Pass Types'?<AdminPasses/>:tab==='Partners'?<PartnerAdmin/>:<div className="empty"><Sparkles size={28}/><h2>{tab}</h2><p>This module is coming next. The navigation is already reserved for it.</p></div>}</main></div>;
}

function AdminDashboard(){
  const [events,setEvents]=useState<EventRow[]>([]); const [passes,setPasses]=useState<PassRow[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!supabase)return;(async()=>{const [{data:e},{data:p}]=await Promise.all([supabase.from('events').select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home,status'),supabase.from('pass_types').select('id,event_id,name,description,price_paise,inventory,sold,active,display_order')]);setEvents((e||[]) as EventRow[]);setPasses((p||[]) as PassRow[]);setLoading(false)})()},[]);
  const active=events.filter(e=>e.status==='published').length; const available=passes.filter(p=>p.active).reduce((s,p)=>s+Math.max(0,p.inventory-p.sold),0);
  return <><div className="stats"><Stat label="Published events" value={loading?'…':String(active)}/><Stat label="Passes available" value={loading?'…':String(available)}/><Stat label="Tickets sold" value={loading?'…':String(passes.reduce((s,p)=>s+p.sold,0))}/><Stat label="Gross sales" value="—"/></div><div className="admin-grid"><div className="panel"><div className="panel-head"><div><h3>Events</h3><small>Live data from Supabase</small></div><span className="kicker">LIVE DATA</span></div>{loading?<div className="empty"><p>Loading…</p></div>:events.length?events.slice(0,8).map(e=><div className="admin-event" key={e.id}><div className="admin-thumb" style={{background:e.hero_image_url?`url(${e.hero_image_url}) center/cover`:demoBackground(e.name)}}/><div><b>{e.name}</b><small>{dateLabel(e.event_date)} · {e.location||'Location TBA'}</small></div><span className={e.status==='published'?'status':''}>{e.status}</span><span/></div>):<div className="empty"><p>No events yet.</p></div>}</div><div className="panel info-panel"><ShieldCheck size={24}/><h3>Security first</h3><p>Admin actions are authenticated. Database policies restrict event/pass writes to authorized MNG roles.</p><code>Auth → RLS → Supabase</code></div></div></>;
}
function Stat({label,value}:{label:string,value:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong><small>MNG live data</small></div>}

function AdminEvents(){
  const [events,setEvents]=useState<EventRow[]>([]); const [loading,setLoading]=useState(true); const [open,setOpen]=useState(false); const [editing,setEditing]=useState<EventRow|null>(null); const [form,setForm]=useState<EventForm>(emptyEventForm()); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const load=async()=>{if(!supabase)return;setLoading(true);const {data,error:e}=await supabase.from('events').select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home,status').order('created_at',{ascending:false});if(e)setError(e.message);else setEvents((data||[]) as EventRow[]);setLoading(false)}; useEffect(()=>{void load()},[]);
  const create=()=>{setEditing(null);setForm(emptyEventForm());setError('');setNotice('');setOpen(true)};
  const edit=(e:EventRow)=>{setEditing(e);setForm({name:e.name,slug:e.slug,subtitle:e.subtitle||'',description:e.description||'',location:e.location||'',event_date:e.event_date||'',start_time:e.start_time||'',hero_image_url:e.hero_image_url||'',poster_image_url:e.poster_image_url||'',mobile_banner_url:e.mobile_banner_url||'',tags:(e.tags||[]).join(', '),status:e.status,featured:e.featured,show_on_home:e.show_on_home});setError('');setNotice('');setOpen(true)};
  const save=async(ev:React.FormEvent)=>{ev.preventDefault();if(!supabase)return;setSaving(true);setError('');const payload={name:form.name.trim(),slug:slugify(form.slug||form.name),subtitle:form.subtitle.trim()||null,description:form.description.trim()||null,location:form.location.trim()||null,event_date:form.event_date||null,start_time:form.start_time||null,hero_image_url:form.hero_image_url.trim()||null,poster_image_url:form.poster_image_url.trim()||null,mobile_banner_url:form.mobile_banner_url.trim()||null,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),status:form.status,featured:form.featured,show_on_home:form.show_on_home};const result=editing?await supabase.from('events').update(payload).eq('id',editing.id):await supabase.from('events').insert(payload);if(result.error)setError(result.error.message);else{setOpen(false);setNotice(editing?'Event updated.':'Event created.');await load()}setSaving(false)};
  const archive=async(id:string)=>{if(!supabase||!confirm('Archive this event?'))return;const {error:e}=await supabase.from('events').update({status:'archived',show_on_home:false}).eq('id',id);if(e)setError(e.message);else{setNotice('Event archived.');await load()}};
  return <><div className="panel"><div className="panel-head"><div><h3>Events</h3><small>Everything here writes directly to Supabase.</small></div><button className="primary small" onClick={create}><Plus size={15}/> Create event</button></div>{notice&&<div className="form-success"><Check size={14}/> {notice}</div>}{error&&<div className="form-error">{error}</div>}{loading?<div className="empty"><p>Loading events…</p></div>:events.length?events.map(e=><div className="table-row" key={e.id}><div><b>{e.name}</b><small>{dateLabel(e.event_date)} · {e.location||'Location TBA'}</small></div><span className={e.status==='published'?'status':''}>{e.status}</span><span>{e.featured?'Featured':'Standard'}</span><div className="row-actions"><button onClick={()=>edit(e)}>Edit</button>{e.status!=='archived'&&<button onClick={()=>void archive(e.id)}>Archive</button>}</div></div>):<div className="empty"><p>No events yet. Create the first one.</p></div>}</div>{open&&<Modal title={editing?'Edit event':'Create event'} onClose={()=>setOpen(false)}><form onSubmit={save}><div className="form-grid"><label>Event name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value,slug:form.slug||slugify(e.target.value)})}/></label><label>Slug<input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})}/></label><label>Subtitle<input value={form.subtitle} onChange={e=>setForm({...form,subtitle:e.target.value})}/></label><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Date<input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label><label>Start time<input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></label><label className="span-2">Description<textarea rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="span-2">Hero image URL<input value={form.hero_image_url} onChange={e=>setForm({...form,hero_image_url:e.target.value})} placeholder="https://..."/></label><label>Poster image URL<input value={form.poster_image_url} onChange={e=>setForm({...form,poster_image_url:e.target.value})}/></label><label>Mobile banner URL<input value={form.mobile_banner_url} onChange={e=>setForm({...form,mobile_banner_url:e.target.value})}/></label><label>Tags<input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="concert, surat, trending"/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as EventRow['status']})}><option value="draft">Draft</option><option value="published">Published</option><option value="sold_out">Sold out</option><option value="archived">Archived</option></select></label><label className="check-row"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Featured</label><label className="check-row"><input type="checkbox" checked={form.show_on_home} onChange={e=>setForm({...form,show_on_home:e.target.checked})}/> Show on homepage</label></div><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setOpen(false)}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving?'Saving…':'Save event'} <ArrowRight size={17}/></button></div></form></Modal>}</>;
}

function AdminPasses(){
  const [passes,setPasses]=useState<PassRow[]>([]); const [events,setEvents]=useState<EventRow[]>([]); const [loading,setLoading]=useState(true); const [open,setOpen]=useState(false); const [editing,setEditing]=useState<PassRow|null>(null); const [form,setForm]=useState<PassForm>(emptyPassForm()); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const load=async()=>{if(!supabase)return;setLoading(true);const [{data:p,error:pErr},{data:e,error:eErr}]=await Promise.all([supabase.from('pass_types').select('id,event_id,name,description,price_paise,inventory,sold,active,display_order').order('created_at',{ascending:false}),supabase.from('events').select('id,name,status').order('created_at',{ascending:false})]);if(pErr||eErr)setError((pErr||eErr)?.message||'Unable to load passes.');else{setPasses((p||[]) as PassRow[]);setEvents((e||[]) as EventRow[])}setLoading(false)}; useEffect(()=>{void load()},[]);
  const create=()=>{setEditing(null);setForm({...emptyPassForm(),event_id:events.find(e=>e.status!=='archived')?.id||''});setError('');setNotice('');setOpen(true)};
  const edit=(p:PassRow)=>{setEditing(p);setForm({event_id:p.event_id,name:p.name,description:p.description||'',price_rupees:String(Number(p.price_paise)/100),inventory:String(p.inventory),display_order:String(p.display_order),active:p.active});setError('');setNotice('');setOpen(true)};
  const save=async(ev:React.FormEvent)=>{ev.preventDefault();if(!supabase)return;setSaving(true);setError('');const price=Number(form.price_rupees),inventory=Number(form.inventory);if(!Number.isFinite(price)||price<0||!Number.isInteger(inventory)||inventory<0){setError('Enter a valid price and whole-number inventory.');setSaving(false);return}const payload={event_id:form.event_id,name:form.name.trim(),description:form.description.trim()||null,price_paise:Math.round(price*100),inventory,display_order:Number(form.display_order)||0,active:form.active};const result=editing?await supabase.from('pass_types').update(payload).eq('id',editing.id):await supabase.from('pass_types').insert(payload);if(result.error)setError(result.error.message);else{setOpen(false);setNotice(editing?'Pass updated.':'Pass created.');await load()}setSaving(false)};
  const disable=async(id:string)=>{if(!supabase||!confirm('Disable this pass?'))return;const {error:e}=await supabase.from('pass_types').update({active:false}).eq('id',id);if(e)setError(e.message);else{setNotice('Pass disabled.');await load()}};
  const eventName=(id:string)=>events.find(e=>e.id===id)?.name||'Unknown event';
  return <><div className="admin-grid"><div className="panel"><div className="panel-head"><div><h3>Pass types</h3><small>Price and inventory are live in Supabase.</small></div><button className="primary small" onClick={create}><Plus size={15}/> Add pass</button></div>{notice&&<div className="form-success"><Check size={14}/> {notice}</div>}{error&&<div className="form-error">{error}</div>}{loading?<div className="empty"><p>Loading passes…</p></div>:passes.length?passes.map(p=><div className="pass-admin" key={p.id}><div><b>{p.name}</b><small>{eventName(p.event_id)} · {p.active?'Active':'Inactive'}</small></div><label>Price<strong>{money(Number(p.price_paise)/100)}</strong></label><label>Available<strong>{Math.max(0,p.inventory-p.sold)}</strong></label><div className="row-actions"><button onClick={()=>edit(p)}>Edit</button>{p.active&&<button onClick={()=>void disable(p.id)}>Disable</button>}</div></div>):<div className="empty"><p>No passes yet. Create an event first.</p></div>}</div><div className="panel info-panel"><ShieldCheck size={24}/><h3>Price safety</h3><p>When you change ₹100 to ₹200 here, the database stores the new price. Our payment backend will re-read this price before creating the Razorpay order.</p><code>Admin → Supabase → server revalidation → Razorpay</code></div></div>{open&&<Modal title={editing?'Edit pass':'Create pass'} onClose={()=>setOpen(false)}><form onSubmit={save}><div className="form-grid"><label className="span-2">Event<select required value={form.event_id} onChange={e=>setForm({...form,event_id:e.target.value})}><option value="">Select event</option>{events.filter(e=>e.status!=='archived').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Pass name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Silver"/></label><label>Price (₹)<input type="number" min="0" step="1" required value={form.price_rupees} onChange={e=>setForm({...form,price_rupees:e.target.value})}/></label><label>Inventory<input type="number" min="0" step="1" required value={form.inventory} onChange={e=>setForm({...form,inventory:e.target.value})}/></label><label>Display order<input type="number" min="0" step="1" value={form.display_order} onChange={e=>setForm({...form,display_order:e.target.value})}/></label><label className="span-2">Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="check-row"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active for sale</label></div><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setOpen(false)}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving?'Saving…':'Save pass'} <ArrowRight size={17}/></button></div></form></Modal>}</>;
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><div className="modal-card"><div className="modal-head"><div><div className="kicker">MNG CONTROL</div><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}
function PartnerAdmin(){return <div className="admin-grid"><div className="panel"><div className="panel-head"><div><h3>MNG Partners</h3><small>Reseller module is next.</small></div><button className="primary small" disabled><Plus size={15}/> Add partner</button></div><div className="empty"><p>The data model already supports reseller accounts, event access and partner pricing. Next we connect the partner login and sales flow.</p></div></div><div className="panel info-panel"><Sparkles size={24}/><h3>No app download</h3><p>Resellers will use the web portal with their MNG Partner ID and password.</p></div></div>}

function Partner({navigate}:{navigate:(to:string)=>void}){return <div><Header navigate={navigate}/><main className="partner-page"><div className="login-card"><div className="login-mark">✦</div><div className="kicker">MNG PARTNER PORTAL</div><h1>Sell tickets.<br/><span>No app required.</span></h1><p>Reseller login is the next module. This route is already reserved for your partner network.</p><button className="ghost full" onClick={()=>navigate('/')}>← Back to public website</button></div></main></div>}

function App(){const {route,navigate}=useRoute();if(route.startsWith('/admin'))return <Admin navigate={navigate}/>;if(route.startsWith('/partner'))return <Partner navigate={navigate}/>;if(route.startsWith('/events/'))return <EventPage slug={route.split('/')[2] || ''} navigate={navigate}/>;return <Home navigate={navigate}/>}

createRoot(document.getElementById('root')!).render(<App/>);
