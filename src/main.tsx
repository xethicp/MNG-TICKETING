import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, ChevronRight, Flame, MapPin, Menu, Search, ShieldCheck, Sparkles, Ticket, UserRound, X, Zap } from 'lucide-react';
import './styles.css';
import { supabase } from '../lib/supabase';

type DbEvent = {
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
};

type DbPass = {
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

type EventView = DbEvent & {
  passes: DbPass[];
  price: number;
  progress: number;
  tag: string;
  image: string;
  accent: string;
};

const demoVisual = (name: string) => {
  const safe = (name || 'MNG LIVE').toUpperCase().slice(0, 18);
  return {
    image: 'linear-gradient(135deg,#071a3d 0%,#174aa6 48%,#62a7ff 100%)',
    accent: safe,
  };
};

function formatDate(date: string | null){
  if(!date) return 'DATE TBA';
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d).toUpperCase();
}

function formatTime(time: string | null){
  if(!time) return 'TIME TBA';
  const [h,m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d);
}

function buildEventView(e: DbEvent, passes: DbPass[]): EventView{
  const eventPasses = passes.filter(p=>p.event_id===e.id && p.active).sort((a,b)=>a.display_order-b.display_order);
  const totalInventory = eventPasses.reduce((sum,p)=>sum+Math.max(0,p.inventory),0);
  const totalSold = eventPasses.reduce((sum,p)=>sum+Math.max(0,p.sold),0);
  const progress = totalInventory ? Math.min(100, Math.round((totalSold/totalInventory)*100)) : 0;
  const visual = demoVisual(e.name);
  return { ...e, passes:eventPasses, price:eventPasses.length ? Math.min(...eventPasses.map(p=>Number(p.price_paise)))/100 : 0, progress, tag:(e.tags?.[0] || (e.featured ? 'FEATURED' : 'MNG EVENT')).toUpperCase(), ...visual };
}

async function loadPublishedEvents(){
  if(!supabase) throw new Error('Supabase environment variables are missing.');
  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home')
    .eq('status','published')
    .order('featured',{ascending:false})
    .order('event_date',{ascending:true});
  if(eventsError) throw eventsError;

  const eventIds = (eventsData || []).map((e: DbEvent)=>e.id);
  if(!eventIds.length) return [];
  const { data: passData, error: passError } = await supabase
    .from('pass_types')
    .select('id,event_id,name,description,price_paise,inventory,sold,active,display_order')
    .in('event_id',eventIds)
    .eq('active',true)
    .order('display_order',{ascending:true});
  if(passError) throw passError;

  const passes = (passData || []) as DbPass[];
  return (eventsData || [])
    .filter((e: DbEvent)=>e.show_on_home)
    .map((e: DbEvent)=>buildEventView(e,passes));
}


function money(n:number){ return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n); }
function path(){ return window.location.pathname; }

function App(){
  const [route,setRoute] = useState(path());
  const [menu,setMenu] = useState(false);
  const navigate=(to:string)=>{ history.pushState({},'',to); setRoute(to); setMenu(false); window.scrollTo(0,0); };
  useEffect(()=>{ const h=()=>setRoute(path()); addEventListener('popstate',h); return()=>removeEventListener('popstate',h)},[]);
  if(route.startsWith('/admin')) return <Admin navigate={navigate}/>;
  if(route.startsWith('/partner')) return <Partner navigate={navigate}/>;
  if(route.startsWith('/events/')) return <EventPage navigate={navigate} id={route.split('/')[2]}/>;
  return <Home navigate={navigate} menu={menu} setMenu={setMenu}/>;
}

function Header({navigate,menu,setMenu}:{navigate:(s:string)=>void,menu:boolean,setMenu:(v:boolean)=>void}){
 return <header className="topbar">
   <button className="brand" onClick={()=>navigate('/')}><span className="brand-orbit">✦</span><span>MARS NOVA</span></button>
   <nav className="desktop-nav"><button onClick={()=>navigate('/')}>Events</button><button>Categories</button><button>MNG Radar</button><button>Partners</button></nav>
   <div className="nav-actions"><button className="icon-btn"><Search size={18}/></button><button className="ticket-link" onClick={()=>navigate('/partner')}><Ticket size={16}/> Partner</button><button className="avatar"><UserRound size={17}/></button><button className="mobile-menu icon-btn" onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button></div>
   {menu && <div className="mobile-nav"><button onClick={()=>navigate('/')}>Events</button><button>MNG Radar</button><button>Categories</button><button onClick={()=>navigate('/partner')}>Partner Login</button></div>}
 </header>
}

function Home({navigate,menu,setMenu}:{navigate:(s:string)=>void,menu:boolean,setMenu:(v:boolean)=>void}){
  const [events,setEvents]=useState<EventView[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    loadPublishedEvents().then(data=>{ if(alive){setEvents(data);setLoading(false);} }).catch(err=>{ if(alive){setError(err instanceof Error?err.message:'Unable to load events.');setLoading(false);} });
    return()=>{alive=false};
  },[]);
  const hero=events[0];
  return <div><Header navigate={navigate} menu={menu} setMenu={setMenu}/><main>
   <section className="hero-shell"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> MNG RADAR · LIVE EVENTS</div><h1>Your next<br/><span>experience</span> awaits.</h1><p>Discover concerts, festivals and nights worth remembering — all in one trusted place.</p><div className="hero-actions"><button className="primary" onClick={()=>events[0] ? navigate('/events/'+events[0].slug) : window.scrollTo({top:700,behavior:'smooth'})}>Explore events <ArrowRight size={18}/></button><button className="ghost">How MNG works <ChevronRight size={17}/></button></div><div className="trust-row"><span><ShieldCheck size={16}/> Secure checkout</span><span><Zap size={16}/> Instant QR ticket</span></div></div><div className="hero-art"><div className="hero-glow"/><div className="hero-poster" style={{background:hero?.image}}><div className="poster-mini">MNG<br/><b>LIVE</b></div><div className="poster-title">{hero ? hero.accent : 'YOUR NEXT'}<br/><span>{hero ? formatDate(hero.event_date) : 'EXPERIENCE'}</span></div><div className="poster-meta">{hero ? `${formatDate(hero.event_date)} · ${hero.location || 'LOCATION TBA'}` : 'MNG TICKETING'}</div><div className="poster-stamp">MNG<br/>LIVE</div></div></div></section>
   <section className="section"><div className="section-head"><div><div className="kicker">DISCOVER</div><h2>Trending in MNG</h2></div><button className="text-btn">View all <ArrowRight size={16}/></button></div>{loading ? <div className="empty"><Sparkles size={28}/><h2>Loading events…</h2><p>Fetching the latest published events from MNG.</p></div> : error ? <div className="empty"><h2>We couldn't load events</h2><p>{error}</p></div> : events.length ? <div className="event-grid">{events.slice(0,3).map(e=><EventCard key={e.id} e={e} navigate={navigate}/>)}</div> : <div className="empty"><Sparkles size={28}/><h2>No events published yet</h2><p>Your website is connected to Supabase. Add and publish your first event from the MNG Admin panel.</p><button className="primary small" onClick={()=>navigate('/admin')}>Open Admin</button></div>}</section>
   {events.length>0 && <section className="section radar"><div className="section-head"><div><div className="kicker">REAL-TIME</div><h2>MNG Radar</h2></div><div className="radar-live"><span className="live-dot"/> Live</div></div><div className="radar-grid">{events.map(e=><div className="radar-item" key={e.id} onClick={()=>navigate('/events/'+e.slug)}><div className="radar-name"><span>{e.name}</span><b>{e.progress}%</b></div><div className="bar"><i style={{width:e.progress+'%'}}/></div><small>{e.progress>=90?'High demand':e.progress>75?'Fast moving':'Tickets available'}</small></div>)}</div></section>}
   <section className="section"><div className="section-head"><div><div className="kicker">EXPLORE</div><h2>Find your scene</h2></div></div><div className="chips"><button>🎤 Concerts</button><button>🎉 Festivals</button><button>🌙 Nightlife</button><button>🎭 Shows</button><button>✨ Experiences</button><button>🏟 Sports</button></div></section>
   {events.length>3 && <section className="section"><div className="section-head"><div><div className="kicker">UP NEXT</div><h2>More experiences</h2></div></div><div className="event-grid two">{events.slice(3).map(e=><EventCard key={e.id} e={e} navigate={navigate}/>)}</div></section>}
 </main><footer><div className="footer-brand">✦ MARS NOVA</div><p>Events · Experiences · Memories</p><span>© 2026 Mars Nova Global</span></footer></div>
}

function EventCard({e,navigate}:{e:EventView,navigate:(s:string)=>void}){return <article className="event-card" onClick={()=>navigate('/events/'+e.slug)}><div className="event-image" style={{background:e.hero_image_url ? `url(${e.hero_image_url}) center/cover` : e.image}}><div className="poster-word">{e.accent}</div><span className="tag">{e.tag}</span><span className="heart">♡</span><div className="date-badge"><b>{e.event_date ? new Date(`${e.event_date}T00:00:00`).getDate() : '—'}</b><span>{e.event_date ? new Intl.DateTimeFormat('en-US',{month:'short'}).format(new Date(`${e.event_date}T00:00:00`)).toUpperCase() : 'TBA'}</span></div></div><div className="event-body"><div className="event-title"><h3>{e.name}</h3><ArrowRight size={17}/></div><p>{e.subtitle || 'MNG verified experience'}</p><div className="event-meta"><span><CalendarDays size={14}/>{formatDate(e.event_date)} · {formatTime(e.start_time)}</span><span><MapPin size={14}/>{e.location || 'Location TBA'}</span></div><div className="event-bottom"><span>{e.price ? <>From <b>{money(e.price)}</b></> : 'Pricing TBA'}</span><span className="availability"><span className="mini-bar"><i style={{width:e.progress+'%'}}/></span>{e.progress}% sold</span></div></div></article>}

function EventPage({navigate,id}:{navigate:(s:string)=>void,id:string}){
  const [event,setEvent]=useState<EventView|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [qty,setQty]=useState(1);
  const [selected,setSelected]=useState('');
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        if(!supabase) throw new Error('Supabase environment variables are missing.');
        const {data:e,error:eErr}=await supabase.from('events').select('id,slug,name,subtitle,description,location,event_date,start_time,hero_image_url,poster_image_url,mobile_banner_url,tags,featured,show_on_home').eq('slug',id).eq('status','published').single();
        if(eErr) throw eErr;
        const {data:p,error:pErr}=await supabase.from('pass_types').select('id,event_id,name,description,price_paise,inventory,sold,active,display_order').eq('event_id',e.id).eq('active',true).order('display_order',{ascending:true});
        if(pErr) throw pErr;
        if(alive){
          const view=buildEventView(e as DbEvent,(p||[]) as DbPass[]);
          setEvent(view);
          setSelected(view.passes[0]?.id || '');
          setLoading(false);
        }
      }catch(err){ if(alive){setError(err instanceof Error?err.message:'Unable to load this event.');setLoading(false);} }
    })();
    return()=>{alive=false};
  },[id]);
  if(loading) return <div><Header navigate={navigate} menu={false} setMenu={()=>{}}/><main className="event-page"><div className="empty"><Sparkles size={28}/><h2>Loading event…</h2><p>Fetching the latest event and pass information.</p></div></main></div>;
  if(error || !event) return <div><Header navigate={navigate} menu={false} setMenu={()=>{}}/><main className="event-page"><button className="back" onClick={()=>navigate('/')}>← Back to events</button><div className="empty"><h2>Event not found</h2><p>{error || 'This event may no longer be published.'}</p></div></main></div>;
  const current=event.passes.find(p=>p.id===selected) || event.passes[0];
  const available=current ? Math.max(0,current.inventory-current.sold) : 0;
  const total=current ? Number(current.price_paise)/100*qty : 0;
  return <div><Header navigate={navigate} menu={false} setMenu={()=>{}}/><main className="event-page"><button className="back" onClick={()=>navigate('/')}>← Back to events</button><div className="event-hero"><div className="big-art" style={{background:event.hero_image_url ? `url(${event.hero_image_url}) center/cover` : event.image}}><div className="big-word">{event.accent}</div><span className="tag">{event.tag}</span></div><div className="event-info"><div className="kicker">MNG VERIFIED EVENT</div><h1>{event.name}</h1><p className="subtitle">{event.subtitle || 'An MNG verified experience'}</p><div className="info-list"><span><CalendarDays/>{formatDate(event.event_date)} · {formatTime(event.start_time)}</span><span><MapPin/>{event.location || 'Location TBA'}</span></div><p className="description">{event.description || 'An unforgettable experience curated by Mars Nova Global. Your digital ticket is generated instantly after successful payment.'}</p>{event.progress>0 && <div className="event-fomo"><Flame size={16}/> {event.progress}% of the currently released inventory is sold</div>}</div></div><section className="booking"><div><div className="kicker">CHOOSE YOUR PASS</div><h2>Make it your night.</h2>{event.passes.length ? event.passes.map(p=>{const left=Math.max(0,p.inventory-p.sold);return <button key={p.id} className={'pass-row '+(selected===p.id?'selected':'')} onClick={()=>{setSelected(p.id);setQty(1)}} disabled={left<=0}><span><b>{p.name}</b><small>{p.description || (left>0?`${left} available`:'Sold out')}</small></span><strong>{money(Number(p.price_paise)/100)}</strong></button>}) : <div className="empty"><p>No active passes are available for this event yet.</p></div>}</div><aside className="order-card"><div className="order-top"><span>Your booking</span><Ticket size={18}/></div>{current ? <><div className="qty"><span>{current.name}</span><div><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><b>{qty}</b><button onClick={()=>setQty(Math.min(Math.max(1,available),qty+1))}>+</button></div></div><div className="order-total"><span>Total</span><b>{money(total)}</b></div><button className="primary full" disabled={available<=0} onClick={()=>alert('Secure Razorpay checkout will be enabled after the server-side order function is connected.')}>{available>0?'Continue to secure payment':'Sold out'} <ArrowRight size={18}/></button><small className="secure"><ShieldCheck size={14}/> Final price and inventory will be revalidated on the server before payment.</small></> : <small className="secure">Choose an available pass to continue.</small>}</aside></section></main></div>
}

function Admin({navigate}:{navigate:(s:string)=>void}){const [tab,setTab]=useState('Dashboard'); const tabs=['Dashboard','Events','Pass Types','Orders','Partners','Homepage','Marketing','Settings']; return <div className="portal"><aside className="sidebar"><button className="brand side-brand" onClick={()=>navigate('/')}>✦ MARS NOVA</button><div className="side-kicker">ADMIN CONSOLE</div>{tabs.map(t=><button className={tab===t?'active':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}<button className="side-back" onClick={()=>navigate('/')}>← Public website</button></aside><main className="portal-main"><div className="portal-top"><div><div className="kicker">ADMIN CONSOLE</div><h1>{tab}</h1></div><div className="admin-user">Owner · <b>MN ADMIN</b></div></div>{tab==='Dashboard'?<Dashboard/>:tab==='Events'?<AdminEvents/>:tab==='Pass Types'?<PassManager/>:tab==='Partners'?<PartnerManager/>:<Coming title={tab}/>}</main></div>}
function Dashboard(){
  const [events,setEvents]=useState<EventView[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{loadPublishedEvents().then(setEvents).catch(()=>setEvents([])).finally(()=>setLoading(false));},[]);
  return <><div className="stats"><Stat label="Gross sales" value="—"/><Stat label="Tickets sold" value="—"/><Stat label="Active events" value={loading?'…':String(events.length)}/><Stat label="Check-ins" value="—"/></div><div className="admin-grid"><div className="panel"><div className="panel-head"><h3>Published events</h3><button className="primary small">+ Add event</button></div>{loading?<div className="empty"><p>Loading events…</p></div>:events.length?events.map(e=><div className="admin-event" key={e.id}><div className="admin-thumb" style={{background:e.image}}/><div><b>{e.name}</b><small>{e.location || 'Location TBA'} · {formatDate(e.event_date)}</small></div><span>{e.progress}% sold</span><button>Manage</button></div>):<div className="empty"><p>No published events yet.</p></div>}</div><div className="panel"><div className="panel-head"><h3>Orders</h3></div><div className="empty"><p>Order analytics will appear here after secure checkout is connected.</p></div></div></div></>}
function Stat({label,value}:{label:string,value:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong><small>MNG live data</small></div>}
function AdminEvents(){
  const [events,setEvents]=useState<EventView[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{loadPublishedEvents().then(setEvents).catch(()=>setEvents([])).finally(()=>setLoading(false));},[]);
  return <div className="panel"><div className="panel-head"><div><h3>Events</h3><small>Database-backed published events. Admin editing comes next.</small></div><button className="primary small">+ Create event</button></div>{loading?<div className="empty"><p>Loading events…</p></div>:events.length?events.map(e=><div className="table-row" key={e.id}><div><b>{e.name}</b><small>{formatDate(e.event_date)} · {e.location || 'Location TBA'}</small></div><span className="status">Published</span><span>{e.price ? `From ${money(e.price)}` : 'Pricing TBA'}</span><button>Edit</button></div>):<div className="empty"><p>No published events yet.</p></div>}</div>}
function PassManager(){return <div className="admin-grid"><div className="panel"><div className="panel-head"><div><h3>Pass types</h3><small>Live pass prices will come from Supabase.</small></div><button className="primary small">+ Add pass</button></div><div className="empty"><p>Once an event and its passes are added in Supabase, this panel will display the live pass prices and availability. The final customer price will later be revalidated server-side before Razorpay.</p></div></div><div className="panel info-panel"><ShieldCheck size={24}/><h3>Price safety</h3><p>Customers never control the final amount. At checkout the server reads the current database price, validates inventory, calculates the total and only then creates the Razorpay order.</p><code>client selection → server revalidation → Razorpay order</code></div></div>}

function PartnerManager(){return <div className="admin-grid"><div className="panel"><div className="panel-head"><div><h3>Partners</h3><small>Resellers will be loaded from Supabase with role-limited access.</small></div><button className="primary small">+ Add partner</button></div><div className="empty"><p>No reseller records yet. Partner authentication and permissions will be connected after the customer checkout flow.</p></div></div><div className="panel info-panel"><Sparkles size={24}/><h3>Partner controls</h3><p>Each reseller will have a role-limited login, event access, custom pricing/commission rules, allocation limits, sales history and payment-link attribution.</p></div></div>}

function Coming({title}:{title:string}){return <div className="empty"><Sparkles size={28}/><h2>{title} module</h2><p>This section is scaffolded in the first build. Its data model and permissions will connect to Supabase next.</p></div>}
function Partner({navigate}:{navigate:(s:string)=>void}){const [logged,setLogged]=useState(false);return <div className="portal partner-portal"><aside className="sidebar"><button className="brand side-brand" onClick={()=>navigate('/')}>✦ MARS NOVA</button><div className="side-kicker">PARTNER PORTAL</div>{['Overview','Sell Tickets','My Sales','My Links','Commission','Profile'].map((t,i)=><button key={t} className={i===0?'active':''}>{t}</button>)}<button className="side-back" onClick={()=>navigate('/')}>← Public website</button></aside><main className="portal-main">{!logged?<div className="login-card"><div className="login-mark">✦</div><div className="kicker">MNG VERIFIED PARTNER</div><h1>Sell tickets.<br/><span>Build your network.</span></h1><p>Sign in to your MNG Partner Portal. No app download required.</p><label>Partner ID<input placeholder="MNGP1024"/></label><label>Password<input type="password" placeholder="••••••••"/></label><button className="primary full" onClick={()=>setLogged(true)}>Sign in <ArrowRight size={18}/></button><small>Passwords are securely hashed. Admin can reset access at any time.</small></div>:<><div className="portal-top"><div><div className="kicker">WELCOME BACK</div><h1>Partner dashboard</h1></div><div className="admin-user">MNGP1024 · Rahul Patel</div></div><div className="stats"><Stat label="My sales" value="₹48,500"/><Stat label="Tickets sold" value="27"/><Stat label="Commission" value="₹5,430"/><Stat label="Pending" value="₹2,720"/></div><div className="panel"><div className="panel-head"><h3>Active events</h3></div><div className="empty"><p>Partner sales will appear here after reseller authentication and secure checkout are connected.</p></div></div></>}</main></div>}

createRoot(document.getElementById('root')!).render(<App/>);
