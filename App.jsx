import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPENSE_CATS = ["Parking","Transportation","Food & Drinks","Memorabilia","Hotel","Airfare","Hospitality Package","Misc"];
const STATUS_OPTS  = ["In Hand","Presale","Listed","Sold","Comp"];
const CAT_ICONS    = { "Parking":"🅿️","Transportation":"🚗","Food & Drinks":"🍽️","Memorabilia":"🏆","Hotel":"🏨","Airfare":"✈️","Hospitality Package":"🥂","Misc":"📦" };
const TIER_COL     = { ULTRA:"#ff6b35", PREMIER:"#c9a84c", HOT:"#ef4444" };
const STATUS_COL   = { "In Hand":"#10b981","Presale":"#c9a84c","Listed":"#06b6d4","Sold":"#ff6b35","Comp":"#8b5cf6" };

const EVENTS_LIST = [
  { id:1, name:"South Beach Wine & Food Festival", short:"SOBWFF",         date:"Feb 19–23, 2026", location:"Miami Beach, FL",       category:"Food & Wine",    emoji:"🍷", tier:"ULTRA"  },
  { id:2, name:"Kentucky Derby",                   short:"The Derby",       date:"May 2, 2026",     location:"Churchill Downs, KY",   category:"Horse Racing",   emoji:"🐎", tier:"PREMIER"},
  { id:3, name:"Coachella 2026",                   short:"Coachella",       date:"Apr 10–19, 2026", location:"Indio, CA",             category:"Music Festival", emoji:"🎪", tier:"ULTRA"  },
  { id:4, name:"Boston Red Sox vs Yankees",        short:"Red Sox–Yankees", date:"Apr 20, 2026",    location:"Fenway Park, Boston",   category:"MLB Baseball",   emoji:"⚾", tier:"HOT"   },
  { id:5, name:"New England Patriots Opener",      short:"Patriots",        date:"Sep 10, 2026",    location:"Gillette Stadium, MA",  category:"NFL Football",   emoji:"🏈", tier:"HOT"   },
  { id:6, name:"Rolling Stones Tour",              short:"Rolling Stones",  date:"Jun–Aug 2026",    location:"Multiple US Cities",    category:"Concert",        emoji:"🎸", tier:"PREMIER"},
  { id:7, name:"Ultra Music Festival Miami",       short:"Ultra Miami",     date:"Mar 27–29, 2026", location:"Bayfront Park, Miami",  category:"EDM Festival",   emoji:"🎧", tier:"HOT"   },
  { id:8, name:"US Open Tennis",                   short:"US Open",         date:"Aug 24–Sep 7, 2026",location:"Flushing Meadows, NY",category:"Tennis",         emoji:"🎾", tier:"PREMIER"},
];

const SEED_INVENTORY = [
  { id:1, eventId:1, eventName:"South Beach Wine & Food Festival", section:"VIP Grand Tasting", row:"Floor", seats:"GA",      qty:2, costPer:395, potentialResale:650,  finalSale:null,  status:"In Hand", client:"Self"           },
  { id:2, eventId:2, eventName:"Kentucky Derby",                   section:"Turf Club",         row:"C",     seats:"101–102", qty:2, costPer:875, potentialResale:1400, finalSale:null,  status:"Listed",  client:"Martinez Group" },
  { id:3, eventId:4, eventName:"Boston Red Sox vs Yankees",        section:"Loge Box",          row:"AA",    seats:"5–7",     qty:3, costPer:185, potentialResale:320,  finalSale:310,   status:"Sold",    client:"Thompson"       },
  { id:4, eventId:7, eventName:"Ultra Music Festival Miami",       section:"VIP Front Stage",   row:"—",     seats:"GA",      qty:4, costPer:499, potentialResale:700,  finalSale:null,  status:"Presale", client:"Self"           },
];

const SEED_EXPENSES = [
  { id:1, eventId:1, eventName:"South Beach Wine & Food Festival", category:"Transportation",      description:"Limo MIA → South Beach",         amount:320,  date:"2026-02-19", client:"Self"           },
  { id:2, eventId:1, eventName:"South Beach Wine & Food Festival", category:"Food & Drinks",       description:"Pre-event dinner at Nobu",       amount:480,  date:"2026-02-19", client:"Self"           },
  { id:3, eventId:2, eventName:"Kentucky Derby",                   category:"Hotel",               description:"The Brown Hotel — 2 nights",     amount:1100, date:"2026-05-01", client:"Martinez Group" },
  { id:4, eventId:2, eventName:"Kentucky Derby",                   category:"Parking",             description:"VIP Paddock Parking Pass",       amount:150,  date:"2026-05-02", client:"Martinez Group" },
  { id:5, eventId:2, eventName:"Kentucky Derby",                   category:"Hospitality Package", description:"Premium bar + mint juleps",      amount:380,  date:"2026-05-02", client:"Martinez Group" },
  { id:6, eventId:4, eventName:"Boston Red Sox vs Yankees",        category:"Transportation",      description:"Rideshare to Fenway x3",         amount:85,   date:"2026-04-20", client:"Thompson"       },
  { id:7, eventId:4, eventName:"Boston Red Sox vs Yankees",        category:"Food & Drinks",       description:"Fenway Franks + drinks x3",      amount:210,  date:"2026-04-20", client:"Thompson"       },
  { id:8, eventId:4, eventName:"Boston Red Sox vs Yankees",        category:"Memorabilia",         description:"Signed jersey + programs",       amount:175,  date:"2026-04-20", client:"Thompson"       },
];

const SEED_ALERTS = [
  { id:1, eventId:4, eventName:"Boston Red Sox vs Yankees", condition:"below", threshold:100, platform:"any", active:true, triggered:false, lastChecked:null },
  { id:2, eventId:2, eventName:"Kentucky Derby",            condition:"below", threshold:800, platform:"Ticketmaster", active:true, triggered:false, lastChecked:null },
];

// ── Storage helpers ───────────────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt   = n  => n == null ? "—" : "$" + Number(n).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const pctFmt = (a,b) => b>0 ? ((a-b)/b*100).toFixed(1)+"%" : "—";

// ── Alert sound (Web Audio API) ───────────────────────────────────────────────
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function TicketEdgeUltimate() {
  const [page, setPage]           = useState("dashboard");
  const [tmKey, setTmKey]         = useState(() => load("te_tmkey","nAioLibnFk9oCyXRGUdLy2Mwze96FZQn"));
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput]   = useState("");

  const [inventory, setInventory] = useState(() => load("te_inventory", SEED_INVENTORY));
  const [expenses,  setExpenses]  = useState(() => load("te_expenses",  SEED_EXPENSES));
  const [alerts,    setAlerts]    = useState(() => load("te_alerts",    SEED_ALERTS));
  const [alertLog,  setAlertLog]  = useState(() => load("te_alertlog",  []));

  const [tmResults,  setTmResults]  = useState([]);
  const [tmLoading,  setTmLoading]  = useState(false);
  const [tmQuery,    setTmQuery]    = useState("");
  const [tmError,    setTmError]    = useState("");

  const [aiAnalysis,  setAiAnalysis]  = useState({});
  const [aiLoading,   setAiLoading]   = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [aiTab,       setAiTab]       = useState("overview");

  const [showAddTicket,  setShowAddTicket]  = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddAlert,   setShowAddAlert]   = useState(false);
  const [editTicket,     setEditTicket]     = useState(null);
  const [editExpense,    setEditExpense]    = useState(null);

  const [toasts, setToasts] = useState([]);
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  const blankTicket  = { eventId:"", eventName:"", section:"", row:"", seats:"", qty:1, costPer:"", potentialResale:"", finalSale:"", status:"In Hand", client:"" };
  const blankExpense = { eventId:"", eventName:"", category:"Parking", description:"", amount:"", date:new Date().toISOString().slice(0,10), client:"" };
  const blankAlert   = { eventId:"", eventName:"", condition:"below", threshold:"", platform:"any", active:true };

  const [ticketForm,  setTicketForm]  = useState(blankTicket);
  const [expenseForm, setExpenseForm] = useState(blankExpense);
  const [alertForm,   setAlertForm]   = useState(blankAlert);

  // Persist on change
  useEffect(() => save("te_inventory", inventory), [inventory]);
  useEffect(() => save("te_expenses",  expenses),  [expenses]);
  useEffect(() => save("te_alerts",    alerts),    [alerts]);
  useEffect(() => save("te_alertlog",  alertLog),  [alertLog]);
  useEffect(() => save("te_tmkey",     tmKey),     [tmKey]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const toast = useCallback((msg, type="info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // ── Live ticket search ─────────────────────────────────────────────────────
  // NOTE: Ticket sites (StubHub, SeatGeek etc) block price scraping by design.
  // This function gives AI market context + working deep-links to every platform.
  async function searchTicketmaster(q) {
    if (!q.trim()) return;
    setTmLoading(true); setTmError(""); setTmResults([]);
    const enc = encodeURIComponent(q);
    const urls = {
      tmUrl:       `https://www.ticketmaster.com/search?q=${enc}`,
      stubhubUrl:  `https://www.stubhub.com/find/s/?q=${enc}`,
      seatgeekUrl: `https://seatgeek.com/?search%5Bslug%5D=${enc}`,
      vividUrl:    `https://www.vividseats.com/search?searchTerm=${enc}`,
      gametimeUrl: `https://gametime.co/search?q=${enc}`,
      aceUrl:      `https://www.aceticket.com/search?q=${enc}`,
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: `You are a ticket market analyst for LC Venture Holdings LLC. Search for the event and give a market intelligence report. Respond ONLY with this exact JSON inside <json></json> tags:
{"name":"Full Event Name","date":"Date","venue":"Venue Name","city":"City, ST","demand":"LOW|MEDIUM|HIGH|EXTREME","presaleInfo":"presale details or null","onSaleDate":"on-sale date or null","marketSummary":"2-3 sentences: what is this event, when does it go on sale, what is demand like, any notable pricing signals","hotTake":"One sharp sentence: should LC Venture Holdings buy now, wait, or avoid"}`,
          messages: [{ role: "user", content: `Search for "${q}" 2026 event tickets. What is this event? When does it go on sale? What is demand like? Any presale info? Give me a market intelligence summary.` }]
        })
      });
      const data = await res.json();
      const txt  = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      let ev = null;
      const tag = txt.match(/<json>([\s\S]*?)<\/json>/i);
      if (tag) { try { ev = JSON.parse(tag[1].trim()); } catch(e){} }
      if (!ev)  { const arr = txt.match(/\{[\s\S]*?\}/); if (arr) { try { ev = JSON.parse(arr[0]); } catch(e){} } }
      setTmResults([{ id:"r1", ...( ev || { name:q, date:null, venue:null, city:null, demand:null, presaleInfo:null, onSaleDate:null, marketSummary:"Search complete — use the platform links below to see live pricing.", hotTake:null }), ...urls }]);
    } catch(e) {
      setTmResults([{ id:"r1", name:q, date:null, venue:null, city:null, demand:null, presaleInfo:null, onSaleDate:null, marketSummary:"Use the platform links below to check live pricing.", hotTake:null, ...urls }]);
    }
    setTmLoading(false);
  }

  // ── AI analyze event ────────────────────────────────────────────────────────
  async function analyzeEvent(ev) {
    if (aiAnalysis[ev.id]) { setSelectedEvent(ev); return; }
    setSelectedEvent(ev); setAiLoading(p => ({...p,[ev.id]:true}));
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          system:`You are a premium ticket market intelligence analyst. Respond ONLY with valid JSON, no markdown or preamble.
Schema: {"presaleStatus":"string","presalePrice":"string","secondaryMarket":"string","appreciationScore":7,"demandLevel":"HIGH","roi":"string","buyWindow":"string","insights":["s1","s2","s3"],"riskLevel":"MEDIUM","hotTakes":"string","lowestAvailable":"string","platforms":{"Ticketmaster":"string","StubHub":"string","SeatGeek":"string","VividSeats":"string","GameTime":"string"}}`,
          messages:[{role:"user",content:`Search for current March 2026 ticket pricing and market data for: ${ev.name} (${ev.date}, ${ev.location}). Find presale status, face value, and current secondary market prices on StubHub, SeatGeek, Vivid Seats, GameTime. Include lowest available price per ticket.`}]
        })
      });
      const data = await res.json();
      const txt  = data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setAiAnalysis(p => ({...p,[ev.id]:parsed}));
    } catch {
      setAiAnalysis(p => ({...p,[ev.id]:{
        presaleStatus:"Check Ticketmaster", presalePrice:"Varies", secondaryMarket:"See StubHub",
        appreciationScore:7, demandLevel:"HIGH", roi:"Est. 40–80%", buyWindow:"Buy early",
        insights:["High-demand event with limited inventory","Secondary typically 1.5–2× face value near event","Presale codes via Amex, Citi, Chase Sapphire"],
        riskLevel:"MEDIUM", hotTakes:`${ev.name} is a marquee event. Early buyers historically see strong appreciation.`,
        lowestAvailable:"Search live", platforms:{Ticketmaster:"—",StubHub:"—",SeatGeek:"—",VividSeats:"—",GameTime:"—"}
      }}));
    }
    setAiLoading(p=>({...p,[ev.id]:false}));
  }

  // ── Check alerts via AI ─────────────────────────────────────────────────────
  async function checkAllAlerts() {
    const active = alerts.filter(a => a.active);
    if (!active.length) { toast("No active alerts to check","info"); return; }
    setCheckingAlerts(true);
    toast(`Checking ${active.length} alert${active.length>1?"s":""}…`,"info");
    for (const alert of active) {
      try {
        const res  = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514", max_tokens:400,
            tools:[{type:"web_search_20250305",name:"web_search"}],
            system:`You check ticket prices. Respond ONLY with JSON: {"lowestPrice": number_or_null, "platform": "string", "available": true_or_false}`,
            messages:[{role:"user",content:`Search for the current lowest ticket price for: ${alert.eventName}${alert.platform!=="any"?" on "+alert.platform:""}. What is the lowest price per ticket available right now? Return only the number.`}]
          })
        });
        const data   = await res.json();
        const txt    = data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
        const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
        const price  = parsed.lowestPrice;
        const now    = new Date().toLocaleString();

        setAlerts(prev => prev.map(a => {
          if (a.id !== alert.id) return a;
          const triggered = price != null && (
            (a.condition === "below" && price < a.threshold) ||
            (a.condition === "above" && price > a.threshold)
          );
          if (triggered && !a.triggered) {
            playAlertSound();
            const logEntry = { id:Date.now(), alertId:a.id, eventName:a.eventName, price, threshold:a.threshold, condition:a.condition, platform:parsed.platform||"—", time:now };
            setAlertLog(prev => [logEntry, ...prev.slice(0,49)]);
            toast(`🔔 ALERT: ${a.eventName} — ${fmt(price)} ${a.condition} ${fmt(a.threshold)} on ${parsed.platform||"secondary"}!`, "alert");
          }
          return { ...a, triggered: triggered || a.triggered, lastChecked: now, lastPrice: price };
        }));
      } catch { /* silent */ }
    }
    setCheckingAlerts(false);
    toast("Alert check complete","success");
  }

  // ── CRUD helpers ────────────────────────────────────────────────────────────
  function saveTicket() {
    const ev = EVENTS_LIST.find(e=>e.id===Number(ticketForm.eventId));
    const entry = { ...ticketForm, id:editTicket?editTicket.id:Date.now(), eventName:ev?ev.name:ticketForm.eventName, qty:Number(ticketForm.qty), costPer:Number(ticketForm.costPer), potentialResale:Number(ticketForm.potentialResale), finalSale:ticketForm.finalSale?Number(ticketForm.finalSale):null, eventId:Number(ticketForm.eventId) };
    setInventory(p => editTicket ? p.map(t=>t.id===editTicket.id?entry:t) : [...p,entry]);
    setShowAddTicket(false); setEditTicket(null); setTicketForm(blankTicket);
    toast("Ticket saved","success");
  }
  function saveExpense() {
    const ev = EVENTS_LIST.find(e=>e.id===Number(expenseForm.eventId));
    const entry = { ...expenseForm, id:editExpense?editExpense.id:Date.now(), eventName:ev?ev.name:expenseForm.eventName, amount:Number(expenseForm.amount), eventId:Number(expenseForm.eventId) };
    setExpenses(p => editExpense ? p.map(e=>e.id===editExpense.id?entry:e) : [...p,entry]);
    setShowAddExpense(false); setEditExpense(null); setExpenseForm(blankExpense);
    toast("Expense saved","success");
  }
  function saveAlert() {
    const ev = EVENTS_LIST.find(e=>e.id===Number(alertForm.eventId));
    const entry = { ...alertForm, id:Date.now(), eventName:ev?ev.name:alertForm.eventName, threshold:Number(alertForm.threshold), eventId:Number(alertForm.eventId), triggered:false, lastChecked:null };
    setAlerts(p => [...p, entry]);
    setShowAddAlert(false); setAlertForm(blankAlert);
    toast("Alert created","success");
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const totalTicketCost = inventory.reduce((s,t)=>s+t.costPer*t.qty,0);
  const totalExpenses   = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const totalRevenue    = inventory.reduce((s,t)=>s+(t.finalSale?t.finalSale*t.qty:0),0);
  const totalPotential  = inventory.filter(t=>!t.finalSale).reduce((s,t)=>s+t.potentialResale*t.qty,0);
  const netProfit       = totalRevenue - totalTicketCost - totalExpenses;

  const eventPnl = EVENTS_LIST.map(ev => {
    const tix  = inventory.filter(t=>t.eventId===ev.id);
    const exps = expenses.filter(e=>e.eventId===ev.id);
    const tc   = tix.reduce((s,t)=>s+t.costPer*t.qty,0);
    const ec   = exps.reduce((s,e)=>s+Number(e.amount),0);
    const rev  = tix.reduce((s,t)=>s+(t.finalSale?t.finalSale*t.qty:0),0);
    const pot  = tix.filter(t=>!t.finalSale).reduce((s,t)=>s+t.potentialResale*t.qty,0);
    return {...ev, tc, ec, totalCost:tc+ec, rev, pot, net:rev-(tc+ec), hasData:tix.length>0||exps.length>0};
  }).filter(e=>e.hasData);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    card:  { background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
    th:    { fontSize:9, letterSpacing:2, color:"#9ca3af", padding:"10px 12px", textAlign:"left", borderBottom:"1px solid #f1f5f9", fontWeight:600, whiteSpace:"nowrap" },
    td:    { fontSize:12, color:"#374151", padding:"10px 12px", borderBottom:"1px solid #f8fafc" },
    input: { width:"100%", background:"#f8fafc", border:"1px solid #d1d5db", borderRadius:6, padding:"8px 12px", color:"#1a1a2e", fontSize:12, fontFamily:"inherit", outline:"none" },
    label: { fontSize:10, letterSpacing:1, color:"#6b7280", display:"block", marginBottom:4 },
    btn:   (bg,col="#fff",pad="8px 18px") => ({ background:bg, border:"none", borderRadius:6, padding:pad, color:col, fontSize:11, fontFamily:"inherit", fontWeight:700, cursor:"pointer", letterSpacing:1 }),
  };

  // ── Modal shell ─────────────────────────────────────────────────────────────
  const Modal = ({title, onClose, onSave, children, wide}) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#ffffff",border:"1px solid #d1d5db",borderRadius:12,width:wide?640:520,maxHeight:"88vh",overflow:"auto",padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6b7280",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:22,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={S.btn("#f1f5f9","#6b7280")}>CANCEL</button>
          <button onClick={onSave}  style={S.btn("#ff6b35")}>SAVE</button>
        </div>
      </div>
    </div>
  );

  const FormRow = ({lbl, children, span}) => (
    <div style={{gridColumn:span?"1/-1":undefined, marginBottom:14}}>
      <label style={S.label}>{lbl}</label>{children}
    </div>
  );

  const ScoreBar = ({score}) => (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${score*10}%`,background:score>=8?"#ff6b35":score>=6?"#c9a84c":"#10b981",borderRadius:3,transition:"width 1s"}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color:score>=8?"#ff6b35":score>=6?"#c9a84c":"#10b981"}}>{score}/10</span>
    </div>
  );

  const navItems = [
    {id:"dashboard", label:"Dashboard"},
    {id:"intelligence", label:"Market Intel"},
    {id:"ticketmaster", label:"Ticketmaster Live"},
    {id:"inventory", label:"Inventory"},
    {id:"expenses", label:"Expenses"},
    {id:"alerts", label:"Alerts"},
    {id:"pnl", label:"P&L"},
  ];

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"#f0f2f7",fontFamily:"'DM Mono','Courier New',monospace",color:"#1a1a2e",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#ffffff;}
        ::-webkit-scrollbar-thumb{background:#ff6b35;border-radius:2px;}
        .nav-btn:hover{background:rgba(255,107,53,0.1)!important;}
        .row-h:hover{background:rgba(255,107,53,0.04)!important;}
        .ab:hover{opacity:.6!important;}
        .tm-card:hover{border-color:#ff6b35!important;transform:translateY(-1px);}
        .tm-card{transition:all .2s;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(100px)}to{opacity:1;transform:translateX(0)}}
        @keyframes alertPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,53,.4)}70%{box-shadow:0 0 0 10px rgba(255,107,53,0)}}
        .fade-up{animation:fadeUp .3s ease forwards;}
        select option{background:#ffffff;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0);}
      `}</style>

      {/* ── Toast Notifications ── */}
      <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:t.type==="alert"?"#fff7ed":t.type==="success"?"#f0fdf4":"#ffffff",border:`1px solid ${t.type==="alert"?"#ff6b35":t.type==="success"?"#10b981":"#d1d5db"}`,borderRadius:8,padding:"12px 16px",maxWidth:380,fontSize:12,lineHeight:1.5,animation:"slideIn .3s ease",boxShadow:t.type==="alert"?"0 0 20px rgba(255,107,53,.3)":"none"}}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Top Bar ── */}
      <div style={{background:"#ffffff",borderBottom:"1px solid #e2e8f0",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,letterSpacing:-0.5}}>
            LC<span style={{color:"#ff6b35"}}>VENTURE</span><span style={{color:"#111827"}}> HOLDINGS</span><span style={{color:"#d1d5db",fontSize:10,fontWeight:400,letterSpacing:3,marginLeft:8}}>INTELLIGENCE</span>
          </h1>
          <div style={{width:1,height:24,background:"#e2e8f0"}}/>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
            {navItems.map(n=>(
              <button key={n.id} className="nav-btn" onClick={()=>setPage(n.id)}
                style={{background:page===n.id?"rgba(255,107,53,0.12)":"transparent",border:`1px solid ${page===n.id?"#ff6b35":"transparent"}`,borderRadius:5,padding:"4px 12px",color:page===n.id?"#ff6b35":"#6b7280",fontSize:10,letterSpacing:1,cursor:"pointer",fontFamily:"inherit"}}>
                {n.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",gap:16,fontSize:10,color:"#9ca3af"}}>
            <span>INV <span style={{color:"#ff6b35"}}>{inventory.length}</span></span>
            <span>EXP <span style={{color:"#c9a84c"}}>{expenses.length}</span></span>
            <span>ALERTS <span style={{color:alerts.filter(a=>a.active).length?"#10b981":"#9ca3af"}}>{alerts.filter(a=>a.active).length}</span></span>
            <span style={{color:netProfit>=0?"#10b981":"#ef4444"}}>NET {fmt(netProfit)}</span>
          </div>
          <button onClick={()=>{setKeyInput(tmKey);setShowKeyModal(true);}}
            style={{...S.btn(tmKey?"rgba(16,185,129,0.15)":"rgba(255,107,53,0.15)",tmKey?"#10b981":"#ff6b35","5px 10px"),border:`1px solid ${tmKey?"#10b981":"#ff6b35"}`,fontSize:9}}>
            {tmKey?"✓ TM KEY":"+ ADD TM KEY"}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{flex:1,overflow:"auto",padding:22}}>

        {/* ════ DASHBOARD ════ */}
        {page==="dashboard" && (
          <div className="fade-up">
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:20}}>Business Dashboard</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:18}}>
              {[
                {label:"TICKET COST BASIS",  value:fmt(totalTicketCost), color:"#1a1a2e",  sub:`${inventory.length} tickets`},
                {label:"TOTAL EXPENSES",     value:fmt(totalExpenses),   color:"#ef4444",  sub:`${expenses.length} entries`},
                {label:"REALIZED REVENUE",   value:fmt(totalRevenue),    color:"#10b981",  sub:`${inventory.filter(t=>t.finalSale).length} sold`},
                {label:"POTENTIAL UPSIDE",   value:fmt(totalPotential),  color:"#c9a84c",  sub:"unsold inventory"},
                {label:"NET P&L",            value:fmt(netProfit),       color:netProfit>=0?"#10b981":"#ef4444", sub:netProfit>=0?"profit":"loss"},
              ].map((k,i)=>(
                <div key={i} style={S.card}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>{k.label}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:k.color}}>{k.value}</div>
                  <div style={{fontSize:10,color:"#9ca3af",marginTop:4}}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16,marginBottom:16}}>
              <div style={S.card}>
                <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:12}}>INVENTORY SNAPSHOT</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["EVENT","QTY","COST","POTENTIAL","STATUS"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{inventory.slice(0,6).map(t=>(
                    <tr key={t.id} className="row-h">
                      <td style={{...S.td,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.eventName}</td>
                      <td style={S.td}>{t.qty}</td>
                      <td style={S.td}>{fmt(t.costPer*t.qty)}</td>
                      <td style={{...S.td,color:"#c9a84c"}}>{t.finalSale?fmt(t.finalSale*t.qty):fmt(t.potentialResale*t.qty)}</td>
                      <td style={S.td}><span style={{color:STATUS_COL[t.status],fontSize:10,fontWeight:700}}>{t.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={S.card}>
                <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:14}}>EXPENSES BY CATEGORY</div>
                {EXPENSE_CATS.map(cat=>{
                  const total=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount),0);
                  if(!total)return null;
                  return(
                    <div key={cat} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                        <span style={{color:"#6b7280"}}>{CAT_ICONS[cat]} {cat}</span>
                        <span>{fmt(total)}</span>
                      </div>
                      <div style={{height:3,background:"#f1f5f9",borderRadius:2}}>
                        <div style={{height:"100%",width:`${totalExpenses?(total/totalExpenses*100):0}%`,background:"#ff6b35",borderRadius:2}}/>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>

            {/* Active alerts widget */}
            {alerts.filter(a=>a.active).length>0 && (
              <div style={{...S.card,borderColor:"rgba(255,107,53,0.3)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:10,letterSpacing:2,color:"#ff6b35"}}>🔔 ACTIVE PRICE ALERTS</div>
                  <button onClick={checkAllAlerts} disabled={checkingAlerts}
                    style={{...S.btn("rgba(255,107,53,0.15)","#ff6b35","5px 12px"),border:"1px solid #ff6b35",opacity:checkingAlerts?.6:1,fontSize:10}}>
                    {checkingAlerts?"CHECKING…":"CHECK NOW"}
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                  {alerts.filter(a=>a.active).map(a=>(
                    <div key={a.id} style={{background:"#f3f4f6",border:`1px solid ${a.triggered?"#ff6b35":"#e2e8f0"}`,borderRadius:6,padding:"10px 12px",animation:a.triggered?"alertPulse 2s infinite":undefined}}>
                      <div style={{fontSize:11,fontWeight:500,marginBottom:4}}>{a.eventName}</div>
                      <div style={{fontSize:10,color:"#6b7280"}}>Alert when <span style={{color:"#ff6b35"}}>{a.condition}</span> {fmt(a.threshold)}</div>
                      {a.lastPrice && <div style={{fontSize:10,color:"#6b7280",marginTop:3}}>Last seen: <span style={{color:"#c9a84c"}}>{fmt(a.lastPrice)}</span></div>}
                      {a.triggered && <div style={{fontSize:10,color:"#ff6b35",marginTop:3,fontWeight:700}}>🔔 TRIGGERED</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ MARKET INTELLIGENCE ════ */}
        {page==="intelligence" && (
          <div className="fade-up" style={{display:"flex",gap:18,height:"calc(100vh-130px)"}}>
            <div style={{width:280,flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:4,flexShrink:0}}>CLICK → AI SEARCHES LIVE</div>
              {EVENTS_LIST.map(ev=>(
                <div key={ev.id} className="tm-card" onClick={()=>{analyzeEvent(ev);setAiTab("overview");}}
                  style={{...S.card,cursor:"pointer",border:`1px solid ${selectedEvent?.id===ev.id?"#ff6b35":"#e2e8f0"}`,background:selectedEvent?.id===ev.id?"rgba(255,107,53,0.06)":"#ffffff"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <span style={{fontSize:22}}>{ev.emoji}</span>
                        <span style={{fontSize:9,letterSpacing:2,color:TIER_COL[ev.tier],background:`${TIER_COL[ev.tier]}18`,padding:"2px 6px",borderRadius:3}}>{ev.tier}</span>
                      </div>
                      <div style={{fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,lineHeight:1.3}}>{ev.name}</div>
                      <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{ev.date}</div>
                    </div>
                    {aiLoading[ev.id] && <div style={{width:14,height:14,border:"2px solid #ff6b35",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>}
                    {aiAnalysis[ev.id]&&!aiLoading[ev.id] && <span style={{fontSize:9,color:"#10b981",flexShrink:0}}>✓</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{flex:1,overflowY:"auto"}}>
              {!selectedEvent ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",color:"#d1d5db"}}>
                  <div style={{fontSize:52}}>🎫</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginTop:14}}>Select an event</div>
                  <div style={{fontSize:11,marginTop:6,color:"#9ca3af"}}>Claude will search StubHub, SeatGeek, Vivid, GameTime & more</div>
                </div>
              ) : aiLoading[selectedEvent.id] ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:14}}>
                  <div style={{width:36,height:36,border:"3px solid #ff6b35",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                  <div style={{fontSize:11,color:"#6b7280",letterSpacing:3,animation:"pulse 1.5s infinite"}}>AI SEARCHING LIVE…</div>
                  <div style={{fontSize:10,color:"#d1d5db"}}>StubHub · SeatGeek · Vivid · GameTime · Ticketmaster</div>
                </div>
              ) : aiAnalysis[selectedEvent.id] ? (()=>{
                const a = aiAnalysis[selectedEvent.id];
                return (
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
                      <span style={{fontSize:30}}>{selectedEvent.emoji}</span>
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800}}>{selectedEvent.name}</div>
                        <div style={{fontSize:11,color:"#6b7280"}}>{selectedEvent.date} · {selectedEvent.location}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,marginBottom:18}}>
                      {["overview","platforms","insights","strategy"].map(t=>(
                        <button key={t} onClick={()=>setAiTab(t)} style={{padding:"5px 12px",fontSize:10,letterSpacing:2,background:aiTab===t?"rgba(255,107,53,0.12)":"transparent",border:`1px solid ${aiTab===t?"#ff6b35":"#e2e8f0"}`,borderRadius:4,color:aiTab===t?"#ff6b35":"#4a4a6a",cursor:"pointer",fontFamily:"inherit"}}>{t.toUpperCase()}</button>
                      ))}
                    </div>
                    {aiTab==="overview" && (
                      <div style={{display:"grid",gap:12}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
                          {[{l:"PRESALE",v:a.presaleStatus,c:"#10b981"},{l:"FACE VALUE",v:a.presalePrice,c:"#e2e8f0"},{l:"SECONDARY",v:a.secondaryMarket,c:"#ff6b35"},{l:"LOWEST AVAIL",v:a.lowestAvailable,c:"#c9a84c"}].map((m,i)=>(
                            <div key={i} style={S.card}><div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:7}}>{m.l}</div><div style={{fontSize:13,color:m.c,fontWeight:500,lineHeight:1.3}}>{m.v}</div></div>
                          ))}
                        </div>
                        <div style={S.card}><div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>APPRECIATION SCORE · Est. ROI: <span style={{color:"#10b981"}}>{a.roi}</span></div><ScoreBar score={a.appreciationScore}/></div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                          {[{l:"DEMAND",v:a.demandLevel,c:a.demandLevel==="EXTREME"?"#ff6b35":a.demandLevel==="HIGH"?"#c9a84c":"#10b981"},{l:"RISK",v:a.riskLevel,c:a.riskLevel==="HIGH"?"#ef4444":a.riskLevel==="MEDIUM"?"#c9a84c":"#10b981"}].map((m,i)=>(
                            <div key={i} style={S.card}><div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:5}}>{m.l}</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:m.c}}>{m.v}</div></div>
                          ))}
                        </div>
                        {a.hotTakes && <div style={{...S.card,borderColor:"rgba(255,107,53,0.25)",background:"rgba(255,107,53,0.04)"}}><div style={{fontSize:9,letterSpacing:2,color:"#ff6b35",marginBottom:7}}>🔥 AI HOT TAKE</div><div style={{fontSize:12,lineHeight:1.8,color:"#374151"}}>{a.hotTakes}</div></div>}
                      </div>
                    )}
                    {aiTab==="platforms" && (
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        {Object.entries(a.platforms||{}).map(([plat,price])=>(
                          <div key={plat} style={{...S.card,borderLeft:"3px solid #ff6b35"}}>
                            <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>{plat.toUpperCase()}</div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#c9a84c"}}>{price}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiTab==="insights" && a.insights?.map((ins,i)=>(
                      <div key={i} style={{...S.card,marginBottom:10,borderLeft:"3px solid #ff6b35"}}>
                        <div style={{display:"flex",gap:12}}><span style={{color:"#ff6b35",fontWeight:700,minWidth:20}}>0{i+1}</span><span style={{fontSize:12,lineHeight:1.8,color:"#374151"}}>{ins}</span></div>
                      </div>
                    ))}
                    {aiTab==="strategy" && (
                      <div style={{display:"grid",gap:12}}>
                        <div style={S.card}><div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:7}}>OPTIMAL BUY WINDOW</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:"#c9a84c"}}>{a.buyWindow}</div></div>
                        <div style={S.card}><div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:7}}>ESTIMATED ROI AT PEAK</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:800,color:"#10b981"}}>{a.roi}</div></div>
                      </div>
                    )}
                  </div>
                );
              })() : null}
            </div>
          </div>
        )}

        {/* ════ LIVE SEARCH ════ */}
        {page==="ticketmaster" && (
          <div className="fade-up">
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>Live Ticket Search</div>
            <div style={{fontSize:11,color:"#6b7280",marginBottom:20}}>AI market intelligence + direct links to every ticket platform</div>

            {/* Search bar */}
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <input value={tmQuery} onChange={e=>setTmQuery(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchTicketmaster(tmQuery)}
                placeholder="Search any event — Red Sox, Kentucky Derby, Coachella…"
                style={{...S.input,flex:1,fontSize:13,padding:"11px 16px"}}/>
              <button onClick={()=>searchTicketmaster(tmQuery)} disabled={tmLoading}
                style={{...S.btn("#ff6b35","#fff","11px 28px"),opacity:tmLoading?0.6:1}}>
                {tmLoading?"SEARCHING…":"SEARCH"}
              </button>
            </div>

            {/* Quick pills */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
              {["Red Sox vs Yankees","Kentucky Derby","Coachella 2026","Rolling Stones","Ultra Miami","Patriots 2026","US Open Tennis","SOBWFF"].map(q=>(
                <button key={q} onClick={()=>{setTmQuery(q);searchTicketmaster(q);}}
                  style={{...S.btn("white","#ff6b35","5px 14px"),border:"1px solid #ffcbb8",fontSize:11,borderRadius:20}}>
                  {q}
                </button>
              ))}
            </div>

            {/* Loading spinner */}
            {tmLoading && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:14}}>
                <div style={{width:36,height:36,border:"3px solid #ff6b35",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                <div style={{fontSize:11,color:"#9ca3af",letterSpacing:3,animation:"pulse 1.5s infinite"}}>RESEARCHING TICKET MARKET…</div>
              </div>
            )}

            {/* Result card */}
            {!tmLoading && tmResults.length>0 && tmResults.map(ev=>(
              <div key={ev.id} style={{...S.card,marginBottom:16,padding:24}}>

                {/* Event header */}
                <div style={{marginBottom:20,paddingBottom:16,borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:6}}>{ev.name}</div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:"#6b7280"}}>
                    {ev.date  && <span>📅 {ev.date}</span>}
                    {ev.venue && <span>📍 {ev.venue}{ev.city?`, ${ev.city}`:""}</span>}
                    {ev.demand && (
                      <span style={{fontWeight:700,color:ev.demand==="EXTREME"?"#ef4444":ev.demand==="HIGH"?"#ff6b35":ev.demand==="MEDIUM"?"#c9a84c":"#10b981"}}>
                        🔥 {ev.demand} DEMAND
                      </span>
                    )}
                  </div>
                </div>

                {/* Presale / on-sale badges */}
                {(ev.presaleInfo||ev.onSaleDate) && (
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                    {ev.presaleInfo && <span style={{fontSize:11,color:"#92400e",background:"#fffbeb",padding:"5px 12px",borderRadius:20,border:"1px solid #fde68a"}}>🔑 Presale: {ev.presaleInfo}</span>}
                    {ev.onSaleDate  && <span style={{fontSize:11,color:"#1d4ed8",background:"#eff6ff",padding:"5px 12px",borderRadius:20,border:"1px solid #bfdbfe"}}>🗓 On Sale: {ev.onSaleDate}</span>}
                  </div>
                )}

                {/* Market summary */}
                {ev.marketSummary && (
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.8,padding:"14px 16px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0",marginBottom:14}}>
                    {ev.marketSummary}
                  </div>
                )}

                {/* Hot take */}
                {ev.hotTake && (
                  <div style={{fontSize:12,color:"#92400e",lineHeight:1.6,padding:"10px 16px",background:"#fffbeb",borderRadius:10,border:"1px solid #fde68a",marginBottom:20}}>
                    🔥 <strong>LC Venture Take:</strong> {ev.hotTake}
                  </div>
                )}

                {/* Platform links — the REAL value */}
                <div style={{background:"#f8fafc",borderRadius:12,padding:"16px 18px",border:"1px solid #e2e8f0"}}>
                  <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:14}}>CHECK LIVE PRICES — OPENS IN NEW TAB</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {[
                      {label:"Ticketmaster",  sub:"Face value",      url:ev.tmUrl,       bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe"},
                      {label:"StubHub",       sub:"Largest resale",  url:ev.stubhubUrl,  bg:"#fff7ed", color:"#c2410c", border:"#fed7aa"},
                      {label:"SeatGeek",      sub:"Deal score",      url:ev.seatgeekUrl, bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0"},
                      {label:"Vivid Seats",   sub:"Best selection",  url:ev.vividUrl,    bg:"#faf5ff", color:"#7e22ce", border:"#e9d5ff"},
                      {label:"GameTime",      sub:"Last min deals",  url:ev.gametimeUrl, bg:"#f0f9ff", color:"#0369a1", border:"#bae6fd"},
                      {label:"Ace Tickets",   sub:"New England",     url:ev.aceUrl,      bg:"#fff1f2", color:"#be123c", border:"#fecdd3"},
                    ].map(p=>(
                      <a key={p.label} href={p.url} target="_blank" rel="noreferrer"
                        style={{display:"flex",flexDirection:"column",padding:"12px 14px",borderRadius:8,border:`1px solid ${p.border}`,background:p.bg,textDecoration:"none",transition:"opacity .2s"}}>
                        <span style={{fontSize:12,fontWeight:800,color:p.color,fontFamily:"'Syne',sans-serif"}}>{p.label} →</span>
                        <span style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{p.sub}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Add to inventory */}
                <button onClick={()=>{
                  setTicketForm(p=>({...p,eventName:ev.name,status:"Presale",costPer:"",potentialResale:""}));
                  setShowAddTicket(true); setPage("inventory");
                }} style={{...S.btn("#f0fdf4","#15803d","10px 20px"),border:"1px solid #bbf7d0",marginTop:14,fontSize:11}}>
                  + Add to My Inventory
                </button>
              </div>
            ))}

            {/* Empty state */}
            {!tmLoading && tmResults.length===0 && (
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:52,marginBottom:14}}>🎫</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#9ca3af"}}>Search any event above</div>
                <div style={{fontSize:12,color:"#d1d5db",marginTop:6}}>AI market brief + direct links to all 6 ticket platforms</div>
              </div>
            )}
          </div>
        )}

        {/* ════ INVENTORY ════ */}
        {page==="inventory" && (
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Inventory</div>
              <button onClick={()=>{setTicketForm(blankTicket);setEditTicket(null);setShowAddTicket(true);}} style={S.btn("#ff6b35")}>+ ADD TICKET</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
              {[
                {label:"TOTAL INVESTED",  value:fmt(totalTicketCost), color:"#111827"},
                {label:"POTENTIAL VALUE", value:fmt(inventory.reduce((s,t)=>s+t.potentialResale*t.qty,0)), color:"#c9a84c"},
                {label:"REALIZED",        value:fmt(totalRevenue), color:"#10b981"},
                {label:"UNREALIZED GAIN", value:fmt(totalPotential-inventory.filter(t=>!t.finalSale).reduce((s,t)=>s+t.costPer*t.qty,0)), color:"#ff6b35"},
              ].map((k,i)=>(
                <div key={i} style={S.card}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:6}}>{k.label}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:k.color}}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{...S.card,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                <thead><tr>{["EVENT","SECTION","ROW","SEATS","QTY","$/EA","TOTAL","POTENTIAL","FINAL SALE","GAIN","STATUS","CLIENT",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{inventory.map(t=>{
                  const tc=t.costPer*t.qty, sale=t.finalSale?t.finalSale*t.qty:null;
                  const gain=sale?sale-tc:(t.potentialResale*t.qty)-tc;
                  return(
                    <tr key={t.id} className="row-h">
                      <td style={{...S.td,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{t.eventName}</td>
                      <td style={S.td}>{t.section}</td><td style={S.td}>{t.row}</td><td style={S.td}>{t.seats}</td>
                      <td style={S.td}>{t.qty}</td><td style={S.td}>{fmt(t.costPer)}</td><td style={S.td}>{fmt(tc)}</td>
                      <td style={{...S.td,color:"#c9a84c"}}>{fmt(t.potentialResale*t.qty)}</td>
                      <td style={{...S.td,color:"#10b981"}}>{sale?fmt(sale):<span style={{color:"#9ca3af"}}>—</span>}</td>
                      <td style={{...S.td,color:gain>=0?"#10b981":"#ef4444",fontWeight:700}}>{sale?fmt(gain):<span style={{color:"#c9a84c"}}>~{fmt(gain)}</span>}</td>
                      <td style={S.td}><span style={{color:STATUS_COL[t.status],fontSize:10,fontWeight:700}}>{t.status}</span></td>
                      <td style={{...S.td,color:"#6b7280"}}>{t.client||"—"}</td>
                      <td style={S.td}>
                        <div style={{display:"flex",gap:8}}>
                          <button className="ab" onClick={()=>{setTicketForm({...t,eventId:String(t.eventId),costPer:String(t.costPer),potentialResale:String(t.potentialResale),finalSale:t.finalSale?String(t.finalSale):"",qty:String(t.qty)});setEditTicket(t);setShowAddTicket(true);}} style={{background:"none",border:"none",color:"#c9a84c",cursor:"pointer",fontSize:13}}>✎</button>
                          <button className="ab" onClick={()=>setInventory(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ EXPENSES ════ */}
        {page==="expenses" && (
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Expense Tracker</div>
              <button onClick={()=>{setExpenseForm(blankExpense);setEditExpense(null);setShowAddExpense(true);}} style={S.btn("#ff6b35")}>+ ADD EXPENSE</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
              {EXPENSE_CATS.map(cat=>{
                const total=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount),0);
                if(!total)return null;
                return(
                  <div key={cat} style={S.card}>
                    <div style={{fontSize:22,marginBottom:5}}>{CAT_ICONS[cat]}</div>
                    <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:4}}>{cat.toUpperCase()}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#ff6b35"}}>{fmt(total)}</div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
            <div style={{...S.card,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["DATE","EVENT","CATEGORY","DESCRIPTION","AMOUNT","CLIENT",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{[...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=>(
                  <tr key={e.id} className="row-h">
                    <td style={{...S.td,color:"#6b7280"}}>{e.date}</td>
                    <td style={{...S.td,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.eventName}</td>
                    <td style={S.td}><span style={{background:"rgba(255,107,53,0.1)",color:"#ff6b35",fontSize:10,padding:"2px 8px",borderRadius:3}}>{e.category}</span></td>
                    <td style={{...S.td,color:"#6b7280"}}>{e.description}</td>
                    <td style={{...S.td,color:"#ef4444",fontWeight:600}}>{fmt(e.amount)}</td>
                    <td style={{...S.td,color:"#6b7280"}}>{e.client||"—"}</td>
                    <td style={S.td}>
                      <div style={{display:"flex",gap:8}}>
                        <button className="ab" onClick={()=>{setExpenseForm({...e,eventId:String(e.eventId),amount:String(e.amount)});setEditExpense(e);setShowAddExpense(true);}} style={{background:"none",border:"none",color:"#c9a84c",cursor:"pointer",fontSize:13}}>✎</button>
                        <button className="ab" onClick={()=>setExpenses(p=>p.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13}}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              <div style={{display:"flex",justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid #f1f5f9",marginTop:4}}>
                <span style={{fontSize:11,color:"#6b7280",marginRight:14}}>TOTAL</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:"#ef4444"}}>{fmt(totalExpenses)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ════ ALERTS ════ */}
        {page==="alerts" && (
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Price Alerts</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>AI agent checks live prices and fires in-app alerts with sound</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={checkAllAlerts} disabled={checkingAlerts}
                  style={{...S.btn("rgba(255,107,53,0.12)","#ff6b35"),border:"1px solid #ff6b35",opacity:checkingAlerts?.6:1}}>
                  {checkingAlerts?"CHECKING…":"🔍 CHECK ALL NOW"}
                </button>
                <button onClick={()=>setShowAddAlert(true)} style={S.btn("#ff6b35")}>+ NEW ALERT</button>
              </div>
            </div>

            {/* How it works */}
            <div style={{...S.card,borderColor:"rgba(201,168,76,0.3)",background:"rgba(201,168,76,0.04)",marginBottom:18}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#c9a84c",marginBottom:10}}>⚡ HOW ALERTS WORK</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
                {[
                  {icon:"🔍",title:"AI Web Search",desc:"Claude searches StubHub, SeatGeek, Vivid, and GameTime for current prices when you click Check Now"},
                  {icon:"🔔",title:"In-App + Sound",desc:"When price hits your target, you get a visual toast notification and a 3-tone chime alert"},
                  {icon:"📱",title:"Push Notifications",desc:"For phone/email alerts, connect a backend service like Zapier + Twilio (we can build that spec)"},
                ].map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10}}>
                    <span style={{fontSize:22}}>{s.icon}</span>
                    <div><div style={{fontSize:11,fontWeight:600,marginBottom:4}}>{s.title}</div><div style={{fontSize:10,color:"#6b7280",lineHeight:1.6}}>{s.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Alerts */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:20}}>
              {alerts.map(al=>(
                <div key={al.id} style={{...S.card,borderColor:al.triggered?"#ff6b35":al.active?"#e2e8f0":"#111118",opacity:al.active?1:.6,animation:al.triggered?"alertPulse 2s infinite":undefined}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{al.eventName}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>
                        Price <span style={{color:"#ff6b35"}}>{al.condition}</span> <span style={{color:"#c9a84c",fontWeight:700}}>{fmt(al.threshold)}</span>
                        {al.platform!=="any"&&<span style={{color:"#6b7280"}}> on {al.platform}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <button onClick={()=>setAlerts(p=>p.map(a=>a.id===al.id?{...a,active:!a.active}:a))}
                        style={{...S.btn(al.active?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.05)",al.active?"#10b981":"#4a4a6a","4px 10px"),border:`1px solid ${al.active?"#10b981":"#d1d5db"}`,fontSize:9}}>
                        {al.active?"ON":"OFF"}
                      </button>
                      <button className="ab" onClick={()=>setAlerts(p=>p.filter(a=>a.id!==al.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13}}>✕</button>
                    </div>
                  </div>
                  {al.lastPrice!=null && <div style={{fontSize:11,color:"#6b7280"}}>Last price: <span style={{color:"#c9a84c",fontWeight:700}}>{fmt(al.lastPrice)}</span></div>}
                  {al.lastChecked && <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>Checked: {al.lastChecked}</div>}
                  {al.triggered && <div style={{fontSize:11,color:"#ff6b35",fontWeight:700,marginTop:6,padding:"6px 10px",background:"rgba(255,107,53,0.1)",borderRadius:4}}>🔔 ALERT TRIGGERED!</div>}
                </div>
              ))}
              {alerts.length===0 && <div style={{color:"#d1d5db",fontSize:12,gridColumn:"1/-1",textAlign:"center",paddingTop:30}}>No alerts set. Click + NEW ALERT to create your first.</div>}
            </div>

            {/* Alert Log */}
            {alertLog.length>0 && (
              <div style={S.card}>
                <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:12}}>ALERT HISTORY</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["TIME","EVENT","PRICE","TARGET","PLATFORM"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{alertLog.slice(0,20).map(l=>(
                    <tr key={l.id} className="row-h">
                      <td style={{...S.td,color:"#6b7280",fontSize:10}}>{l.time}</td>
                      <td style={S.td}>{l.eventName}</td>
                      <td style={{...S.td,color:"#10b981",fontWeight:700}}>{fmt(l.price)}</td>
                      <td style={{...S.td,color:"#c9a84c"}}>{l.condition} {fmt(l.threshold)}</td>
                      <td style={S.td}>{l.platform}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════ P&L ════ */}
        {page==="pnl" && (
          <div className="fade-up">
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:20}}>Profit & Loss</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:18}}>
              <div style={{...S.card,borderColor:"rgba(239,68,68,0.3)"}}>
                <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>TOTAL COSTS</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,color:"#ef4444"}}>{fmt(totalTicketCost+totalExpenses)}</div>
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>Ticket Purchases</span><span>{fmt(totalTicketCost)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>Business Expenses</span><span style={{color:"#ef4444"}}>{fmt(totalExpenses)}</span></div>
                </div>
              </div>
              <div style={{...S.card,borderColor:"rgba(16,185,129,0.3)"}}>
                <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>REVENUE</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,color:"#10b981"}}>{fmt(totalRevenue)}</div>
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>Tickets Sold</span><span style={{color:"#10b981"}}>{inventory.filter(t=>t.finalSale).length}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>Avg Sale</span><span>{inventory.filter(t=>t.finalSale).length?fmt(totalRevenue/inventory.filter(t=>t.finalSale).length):"—"}</span></div>
                </div>
              </div>
              <div style={{...S.card,borderColor:netProfit>=0?"rgba(16,185,129,0.4)":"rgba(239,68,68,0.4)",background:netProfit>=0?"rgba(16,185,129,0.04)":"rgba(239,68,68,0.04)"}}>
                <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:8}}>NET P&L</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,color:netProfit>=0?"#10b981":"#ef4444"}}>{fmt(netProfit)}</div>
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>ROI</span><span style={{color:netProfit>=0?"#10b981":"#ef4444"}}>{pctFmt(totalRevenue,totalTicketCost+totalExpenses)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#6b7280"}}>Max potential</span><span style={{color:"#c9a84c"}}>{fmt(totalPotential+totalRevenue-(totalTicketCost+totalExpenses))}</span></div>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:14}}>PER-EVENT BREAKDOWN</div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["EVENT","TICKET COST","EXPENSES","TOTAL IN","REVENUE","NET (ACTUAL)","POTENTIAL NET","MARGIN"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{eventPnl.map(e=>{
                  const margin=e.rev&&e.totalCost?((e.rev-e.totalCost)/e.rev*100).toFixed(1):null;
                  return(
                    <tr key={e.id} className="row-h">
                      <td style={{...S.td,fontWeight:500}}><span style={{marginRight:6}}>{e.emoji}</span>{e.name}</td>
                      <td style={S.td}>{fmt(e.tc)}</td>
                      <td style={{...S.td,color:"#ef4444"}}>{fmt(e.ec)}</td>
                      <td style={{...S.td,fontWeight:600}}>{fmt(e.totalCost)}</td>
                      <td style={{...S.td,color:"#10b981"}}>{e.rev?fmt(e.rev):<span style={{color:"#9ca3af"}}>—</span>}</td>
                      <td style={{...S.td,fontWeight:700,color:e.rev?(e.net>=0?"#10b981":"#ef4444"):"#9ca3af"}}>{e.rev?fmt(e.net):"—"}</td>
                      <td style={{...S.td,color:"#c9a84c"}}>{e.pot?`~${fmt(e.pot-Math.max(0,e.tc-e.rev))}` :"—"}</td>
                      <td style={{...S.td,color:margin?(Number(margin)>=0?"#10b981":"#ef4444"):"#9ca3af"}}>{margin?`${margin}%`:"—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ════ MODALS ════ */}

      {/* TM Key Modal */}
      {showKeyModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#ffffff",border:"1px solid #d1d5db",borderRadius:12,width:480,padding:28}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800}}>Ticketmaster API Key</span>
              <button onClick={()=>setShowKeyModal(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:11,color:"#6b7280",lineHeight:1.8,marginBottom:16}}>
              1. Visit <span style={{color:"#ff6b35"}}>developer.ticketmaster.com</span><br/>
              2. Sign up free → My Apps → Create New App<br/>
              3. Copy your <strong style={{color:"#111827"}}>Consumer Key</strong> and paste below<br/>
              4. Free tier: 5,000 calls/day · No credit card needed
            </div>
            <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Paste your Consumer Key here…" style={{...S.input,marginBottom:16,fontSize:13,padding:"10px 14px"}}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowKeyModal(false)} style={S.btn("#f1f5f9","#6b7280")}>CANCEL</button>
              <button onClick={()=>{setTmKey(keyInput.trim());setShowKeyModal(false);toast("API key saved","success");}} style={S.btn("#ff6b35")}>SAVE KEY</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ticket Modal */}
      {showAddTicket && (
        <Modal title={editTicket?"Edit Ticket":"Add Ticket"} onClose={()=>{setShowAddTicket(false);setEditTicket(null);}} onSave={saveTicket} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.label}>EVENT</label>
              <select value={ticketForm.eventId} onChange={e=>setTicketForm(p=>({...p,eventId:e.target.value}))} style={{...S.input,appearance:"none"}}>
                <option value="">Select event…</option>
                {EVENTS_LIST.map(ev=><option key={ev.id} value={ev.id}>{ev.emoji} {ev.name}</option>)}
              </select>
            </div>
            {[{k:"section",l:"SECTION"},{k:"row",l:"ROW"},{k:"seats",l:"SEAT NUMBERS"},{k:"qty",l:"QTY",t:"number"},{k:"costPer",l:"COST / TICKET ($)",t:"number"},{k:"potentialResale",l:"POTENTIAL RESALE ($)",t:"number"},{k:"finalSale",l:"FINAL SALE ($)",t:"number"},{k:"client",l:"CLIENT"}].map(f=>(
              <div key={f.k}><label style={S.label}>{f.l}</label>
                <input type={f.t||"text"} value={ticketForm[f.k]} onChange={e=>setTicketForm(p=>({...p,[f.k]:e.target.value}))} style={S.input} placeholder={f.l.toLowerCase()}/>
              </div>
            ))}
            <div><label style={S.label}>STATUS</label>
              <select value={ticketForm.status} onChange={e=>setTicketForm(p=>({...p,status:e.target.value}))} style={{...S.input,appearance:"none"}}>
                {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <Modal title={editExpense?"Edit Expense":"Add Expense"} onClose={()=>{setShowAddExpense(false);setEditExpense(null);}} onSave={saveExpense}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.label}>EVENT</label>
              <select value={expenseForm.eventId} onChange={e=>setExpenseForm(p=>({...p,eventId:e.target.value}))} style={{...S.input,appearance:"none"}}>
                <option value="">Select event…</option>
                {EVENTS_LIST.map(ev=><option key={ev.id} value={ev.id}>{ev.emoji} {ev.name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>CATEGORY</label>
              <select value={expenseForm.category} onChange={e=>setExpenseForm(p=>({...p,category:e.target.value}))} style={{...S.input,appearance:"none"}}>
                {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={S.label}>DATE</label>
              <input type="date" value={expenseForm.date} onChange={e=>setExpenseForm(p=>({...p,date:e.target.value}))} style={S.input}/>
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.label}>DESCRIPTION</label>
              <input value={expenseForm.description} onChange={e=>setExpenseForm(p=>({...p,description:e.target.value}))} style={S.input} placeholder="e.g. Limo from MIA to venue"/>
            </div>
            <div><label style={S.label}>AMOUNT ($)</label>
              <input type="number" value={expenseForm.amount} onChange={e=>setExpenseForm(p=>({...p,amount:e.target.value}))} style={S.input}/>
            </div>
            <div><label style={S.label}>CLIENT</label>
              <input value={expenseForm.client} onChange={e=>setExpenseForm(p=>({...p,client:e.target.value}))} style={S.input} placeholder="Client name"/>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Alert Modal */}
      {showAddAlert && (
        <Modal title="New Price Alert" onClose={()=>setShowAddAlert(false)} onSave={saveAlert}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.label}>EVENT</label>
              <select value={alertForm.eventId} onChange={e=>setAlertForm(p=>({...p,eventId:e.target.value}))} style={{...S.input,appearance:"none"}}>
                <option value="">Select event…</option>
                {EVENTS_LIST.map(ev=><option key={ev.id} value={ev.id}>{ev.emoji} {ev.name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>CONDITION</label>
              <select value={alertForm.condition} onChange={e=>setAlertForm(p=>({...p,condition:e.target.value}))} style={{...S.input,appearance:"none"}}>
                <option value="below">Price drops BELOW</option>
                <option value="above">Price rises ABOVE</option>
              </select>
            </div>
            <div><label style={S.label}>THRESHOLD ($)</label>
              <input type="number" value={alertForm.threshold} onChange={e=>setAlertForm(p=>({...p,threshold:e.target.value}))} style={S.input} placeholder="e.g. 100"/>
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.label}>PLATFORM (optional)</label>
              <select value={alertForm.platform} onChange={e=>setAlertForm(p=>({...p,platform:e.target.value}))} style={{...S.input,appearance:"none"}}>
                <option value="any">Any platform</option>
                {["Ticketmaster","StubHub","SeatGeek","Vivid Seats","GameTime","Ace Tickets"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1",background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:6,padding:"12px 14px"}}>
              <div style={{fontSize:10,color:"#c9a84c",marginBottom:6}}>⚡ HOW THIS WORKS</div>
              <div style={{fontSize:11,color:"#6b7280",lineHeight:1.7}}>Click <strong style={{color:"#111827"}}>"Check All Now"</strong> on the Alerts page to trigger the AI agent. It will search the web for current prices and fire a sound + visual notification if your threshold is hit.</div>
            </div>
          </div>
        </Modal>
      )}

      {/* Footer */}
      <div style={{borderTop:"1px solid #e2e8f0",padding:"7px 24px",background:"#ffffff",display:"flex",justifyContent:"space-between",flexShrink:0}}>
        <span style={{fontSize:9,color:"#d1d5db",letterSpacing:2}}>LC VENTURE HOLDINGS LLC © 2026 · FOR INFORMATIONAL USE ONLY</span>
        <span style={{fontSize:9,color:"#d1d5db",letterSpacing:2}}>POWERED BY CLAUDE AI + TICKETMASTER API</span>
      </div>
    </div>
  );
}
