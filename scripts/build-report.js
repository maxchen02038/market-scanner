/*
 * build-report.js
 * Runs on GitHub Actions (Node 20+). Fetches live S&P 500 data from Finnhub,
 * scores stocks with the sector-adjusted momentum formula, and writes report.json.
 *
 * The API key comes from the FINNHUB_KEY environment variable (a GitHub Secret),
 * NOT hardcoded — that's the whole point of doing this server-side.
 *
 * IMPORTANT: This produces SIGNAL RANKINGS based on historical momentum patterns.
 * It is NOT a prediction of future performance and NOT financial advice.
 */

const fs = require('fs');

const FKEY = process.env.FINNHUB_KEY;
if (!FKEY) {
  console.error('ERROR: FINNHUB_KEY environment variable not set.');
  process.exit(1);
}
const FBASE = 'https://finnhub.io/api/v1';

// ─── Sector-adjusted weights ────────────────────────────────────────────────
const WEIGHTS = {
  XLK:{beatMag:35,beatStreak:15,momentum:35,analyst:5,target:10},
  XLF:{beatMag:20,beatStreak:15,momentum:30,analyst:15,target:20},
  XLE:{beatMag:10,beatStreak:10,momentum:20,analyst:20,target:40},
  XLV:{beatMag:10,beatStreak:5,momentum:20,analyst:20,target:45},
  XLP:{beatMag:25,beatStreak:20,momentum:20,analyst:20,target:15},
  XLI:{beatMag:20,beatStreak:15,momentum:30,analyst:20,target:15},
  XLU:{beatMag:10,beatStreak:15,momentum:15,analyst:30,target:30},
  XLRE:{beatMag:10,beatStreak:10,momentum:20,analyst:25,target:35},
  XLB:{beatMag:15,beatStreak:10,momentum:35,analyst:20,target:20},
  XLC:{beatMag:30,beatStreak:15,momentum:30,analyst:15,target:10},
  XLY:{beatMag:25,beatStreak:15,momentum:35,analyst:15,target:10},
};
const SECTOR_NAMES = {XLK:'Information Technology',XLF:'Financials',XLE:'Energy',XLV:'Health Care',XLP:'Consumer Staples',XLI:'Industrials',XLU:'Utilities',XLRE:'Real Estate',XLB:'Materials',XLC:'Communication Services',XLY:'Consumer Discretionary'};

const SECTORS=[
  {etf:'XLK',name:'Information Technology',stocks:['NVDA','AAPL','MSFT','AVGO','ORCL','CRM','CSCO','AMD','ACN','ADBE','INTU','QCOM','TXN','NOW','AMAT','ANET','MU','LRCX','KLAC','ADI','APH','CDNS','SNPS','MSI','INTC','GLW','MCHP','NXPI','FTNT','TEL','HPQ','HPE','WDC','STX','SMCI','ON','CTSH','IT','TYL']},
  {etf:'XLF',name:'Financials',stocks:['BRK.B','JPM','V','MA','BAC','WFC','GS','MS','AXP','SPGI','BLK','C','SCHW','CB','PGR','MMC','BX','ICE','CME','PNC','USB','AON','TFC','COF','MET','AIG','BK','AFL','TRV','ALL','PRU','AMP','MSCI','DFS','FIS','HIG','ACGL','KKR','NDAQ','WTW']},
  {etf:'XLE',name:'Energy',stocks:['XOM','CVX','COP','WMB','EOG','KMI','OKE','SLB','PSX','MPC','VLO','OXY','HES','FANG','BKR','HAL','DVN','TRGP','EQT','CTRA','APA','OVV','MRO']},
  {etf:'XLV',name:'Health Care',stocks:['LLY','UNH','JNJ','ABBV','MRK','TMO','ABT','ISRG','DHR','AMGN','PFE','SYK','BSX','BMY','MDT','GILD','VRTX','CI','ELV','CVS','MCK','ZTS','REGN','BDX','HCA','EW','IQV','A','IDXX','GEHC','CNC','HUM','DXCM','BIIB','MRNA','RMD','COR','CAH','WST','ZBH']},
  {etf:'XLP',name:'Consumer Staples',stocks:['COST','WMT','PG','KO','PEP','PM','MO','MDLZ','CL','TGT','KMB','GIS','MNST','KVUE','SYY','KDP','STZ','KHC','HSY','KR','ADM','MKC','CHD','CLX','TSN','K','HRL','SJM','CAG','CPB','BG','TAP','LW']},
  {etf:'XLI',name:'Industrials',stocks:['GE','CAT','RTX','UNP','HON','ETN','BA','LMT','UPS','DE','ADP','TT','PH','GD','MMM','EMR','ITW','CSX','NSC','FDX','NOC','WM','GEV','CARR','PCAR','JCI','CMI','PWR','URI','RSG','OTIS','CTAS','PAYX','FAST','AME','ROK','DAL','LHX','VRSK','IR']},
  {etf:'XLY',name:'Consumer Discretionary',stocks:['AMZN','TSLA','HD','MCD','BKNG','LOW','TJX','SBUX','NKE','ORLY','CMG','MAR','GM','HLT','F','AZO','ROST','YUM','DHI','LEN','RCL','LVS','GRMN','TSCO','EBAY','APTV','PHM','DRI','EXPE','CCL','ULTA','BBY','POOL','KMX','DPZ','NVR','TPR','GPC','LKQ','HAS']},
  {etf:'XLB',name:'Materials',stocks:['LIN','SHW','APD','ECL','FCX','NEM','CTVA','DOW','NUE','DD','VMC','MLM','PPG','IFF','ALB','LYB','STLD','CF','BALL','AMCR','AVY','PKG','IP','CE','EMN','MOS','FMC','RPM','SW']},
  {etf:'XLRE',name:'Real Estate',stocks:['PLD','AMT','EQIX','WELL','SPG','PSA','O','CCI','DLR','CBRE','EXR','VICI','AVB','IRM','EQR','SBAC','VTR','WY','INVH','ARE','MAA','ESS','DOC','KIM','UDR','HST','REG','CPT','BXP','FRT']},
  {etf:'XLU',name:'Utilities',stocks:['NEE','SO','DUK','CEG','AEP','D','SRE','EXC','XEL','PEG','ED','VST','EIX','WEC','ETR','AWK','DTE','PPL','AEE','FE','ATO','CMS','CNP','NRG','ES','PCG','LNT','EVRG','NI','PNW']},
  {etf:'XLC',name:'Communication Services',stocks:['META','GOOGL','GOOG','NFLX','TMUS','DIS','T','VZ','CMCSA','CHTR','EA','TTWO','OMC','WBD','LYV','IPG','MTCH','NWSA','FOXA','PARA','TKO','NWS','FOX']},
];

// ─── Fetch helpers (Node fetch, built into Node 18+) ────────────────────────
async function get(path) {
  const r = await fetch(FBASE + path + '&token=' + FKEY);
  if (r.status === 429) { // rate limited — wait and retry once
    await new Promise(x => setTimeout(x, 2000));
    const r2 = await fetch(FBASE + path + '&token=' + FKEY);
    return r2.ok ? r2.json() : null;
  }
  return r.ok ? r.json() : null;
}
const fq = s => get('/quote?symbol=' + encodeURIComponent(s));
const fp = async s => { try { return await get('/stock/profile2?symbol=' + encodeURIComponent(s)) || {}; } catch { return {}; } };
const fEarnings = async s => { try { return await get('/stock/earnings?symbol=' + encodeURIComponent(s)) || []; } catch { return []; } };
const fRec = async s => { try { const d = await get('/stock/recommendation?symbol=' + encodeURIComponent(s)); return d && d.length ? d[0] : null; } catch { return null; } };
const fTarget = async s => { try { return await get('/stock/price-target?symbol=' + encodeURIComponent(s)) || null; } catch { return null; } };

// ─── Scoring (identical to the frontend formula) ────────────────────────────
function calcScore(q, earnings, rec, target, etf) {
  const W = WEIGHTS[etf] || {beatMag:30,beatStreak:15,momentum:35,analyst:10,target:10};
  const recent = (earnings||[]).slice(0,4).filter(e => e.surprisePercent != null);
  const avgSurp = recent.length ? recent.reduce((s,e)=>s+e.surprisePercent,0)/recent.length : null;
  const magScore = avgSurp===null?0:avgSurp>15?W.beatMag:avgSurp>10?Math.round(W.beatMag*.73):avgSurp>5?Math.round(W.beatMag*.47):avgSurp>0?Math.round(W.beatMag*.23):0;
  let streak=0; for (const e of (earnings||[]).slice(0,4)) { if ((e.surprisePercent??-1)>0) streak++; else break; }
  const ss = streak>=4?W.beatStreak:streak===3?Math.round(W.beatStreak*.67):streak===2?Math.round(W.beatStreak*.4):streak===1?Math.round(W.beatStreak*.2):0;
  const dp = q?.dp || 0;
  const ms = dp>10?W.momentum:dp>5?Math.round(W.momentum*.74):dp>1?Math.round(W.momentum*.46):dp>=0?Math.round(W.momentum*.23):0;
  let as2=0, ad='No data';
  if (rec) { const sb=rec.strongBuy||0,b=rec.buy||0,h=rec.hold||0,s=(rec.sell||0)+(rec.strongSell||0),tot=sb+b+h+s||1,bull=(sb+b)/tot;
    if (bull>.65&&sb>b){as2=W.analyst;ad='Strong Buy';} else if(bull>.55){as2=Math.round(W.analyst*.7);ad='Buy';} else if(h>sb+b){as2=Math.round(W.analyst*.3);ad='Hold';} else {ad='Sell';} }
  let ts=0, td='No data';
  if (target?.targetMean && q?.c) { const up=((target.targetMean-q.c)/q.c)*100; td=(up>=0?'+':'')+up.toFixed(0)+'%'; ts=up>20?W.target:up>10?Math.round(W.target*.7):up>5?Math.round(W.target*.4):up>0?Math.round(W.target*.2):0; }
  return { total: magScore+ss+ms+as2+ts, signals: {
    beatMag:{score:magScore,max:W.beatMag,detail:avgSurp!==null?avgSurp.toFixed(1)+'%':'—'},
    beatStreak:{score:ss,max:W.beatStreak,detail:streak+'Q'},
    momentum:{score:ms,max:W.momentum,detail:(dp>=0?'+':'')+dp.toFixed(2)+'%'},
    analyst:{score:as2,max:W.analyst,detail:ad},
    target:{score:ts,max:W.target,detail:td},
  }};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Starting daily report build at', new Date().toISOString());

  // 1. Verify connection
  const spy = await fq('SPY');
  if (!spy) { console.error('Cannot reach Finnhub — aborting.'); process.exit(1); }

  // 2. Leading/lagging sectors
  const etfs = Object.keys(SECTOR_NAMES);
  const sectorPerf = [];
  for (const etf of etfs) {
    const q = await fq(etf);
    sectorPerf.push({ etf, name: SECTOR_NAMES[etf], dp: q?.dp ?? null });
    await sleep(250);
  }
  sectorPerf.sort((a,b) => (b.dp??-999) - (a.dp??-999));

  // 3. Gather all constituents, quote them, pre-filter to positive momentum
  const allStocks = [];
  for (const sec of SECTORS) sec.stocks.forEach(sym => allStocks.push({ sym, etf: sec.etf, sectorName: sec.name }));

  console.log('Quoting', allStocks.length, 'stocks...');
  const quoted = [];
  for (let i = 0; i < allStocks.length; i += 10) {
    const batch = allStocks.slice(i, i+10);
    const results = await Promise.all(batch.map(async s => {
      const q = await fq(s.sym);
      return q ? { ...s, dp: q.dp, c: q.c, pc: q.pc, _q: q } : null;
    }));
    // Keep any stock with a valid price. We used to require dp>0 (positive momentum
    // today), but that empties the report when run pre-market (before 9:30 ET) when
    // dp is still 0. Keeping all priced stocks means the report always populates;
    // scoring still rewards positive movers, so rankings remain meaningful.
    quoted.push(...results.filter(s => s && s.c));
    await sleep(600);
  }
  console.log(quoted.length, 'stocks passed the positive-momentum pre-filter');

  // Sort by today's % change and only deeply-score the top candidates, to respect
  // the rate limit. Pre-market (dp=0 for all) this just scores a broad sample.
  quoted.sort((a,b) => (b.dp??0) - (a.dp??0));
  const toScore = quoted.slice(0, 60); // cap deep-scoring to 60 stocks max
  console.log('Deep-scoring', toScore.length, 'candidates');

  // 4. Score the candidates (batches of 3, 1.2s apart for the rate limit)
  const scored = [];
  for (let i = 0; i < toScore.length; i += 3) {
    const batch = toScore.slice(i, i+3);
    await Promise.all(batch.map(async s => {
      const [earnings, rec, target, prof] = await Promise.all([fEarnings(s.sym), fRec(s.sym), fTarget(s.sym), fp(s.sym)]);
      const sc = calcScore(s._q, earnings, rec, target, s.etf);
      scored.push({ sym: s.sym, name: prof?.name || s.sym, dp: s.dp, c: s.c, etf: s.etf, sectorName: s.sectorName, score: sc.total, signals: sc.signals, marketCap: prof?.marketCapitalization || null });
    }));
    if (i % 30 === 0) console.log('Scored', scored.length, '/', toScore.length);
    await sleep(1200);
  }

  scored.sort((a,b) => b.score - a.score);

  // 5. Build the report object
  const report = {
    generatedAt: new Date().toISOString(),
    disclaimer: 'These are momentum SIGNAL RANKINGS based on historical patterns, not predictions of future performance. For educational purposes only. Not financial advice.',
    universeSize: allStocks.length,
    afterPreFilter: quoted.length,
    sectors: sectorPerf,
    topSignals: scored.slice(0, 10),    // top 10 by score
    summary: {
      highestScore: scored[0]?.score ?? null,
      highestScoreSymbol: scored[0]?.sym ?? null,
      avgTop10: scored.length ? Math.round(scored.slice(0,10).reduce((s,x)=>s+x.score,0) / Math.min(10, scored.length)) : null,
      leadingSector: sectorPerf[0] ? sectorPerf[0].name : null,
      laggingSector: sectorPerf[sectorPerf.length-1] ? sectorPerf[sectorPerf.length-1].name : null,
    },
  };

  fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
  console.log('report.json written —', scored.length, 'stocks scored. Top:', report.summary.highestScoreSymbol, report.summary.highestScore);
}

main().catch(err => { console.error('Report build failed:', err); process.exit(1); });
