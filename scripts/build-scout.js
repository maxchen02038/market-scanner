/*
 * build-scout.js
 * Pre-computes the Stock Scout rankings so the scout page loads instantly.
 * Runs on GitHub Actions, scores all sectors, writes scout-data.json.
 *
 * API key from FINNHUB_KEY env var (GitHub Secret), NOT hardcoded.
 * Produces momentum SIGNAL RANKINGS, not predictions. Not financial advice.
 */

const fs = require('fs');
const FKEY = process.env.FINNHUB_KEY;
if (!FKEY) { console.error('ERROR: FINNHUB_KEY not set.'); process.exit(1); }
const FBASE = 'https://finnhub.io/api/v1';

const WEIGHTS = {
  XLK:{beatMag:39,beatStreak:17,momentum:39,analyst:5,target:0},
  XLF:{beatMag:25,beatStreak:19,momentum:37,analyst:19,target:0},
  XLE:{beatMag:17,beatStreak:17,momentum:33,analyst:33,target:0},
  XLV:{beatMag:18,beatStreak:9,momentum:37,analyst:36,target:0},
  XLP:{beatMag:29,beatStreak:24,momentum:24,analyst:23,target:0},
  XLI:{beatMag:24,beatStreak:18,momentum:35,analyst:23,target:0},
  XLU:{beatMag:14,beatStreak:22,momentum:21,analyst:43,target:0},
  XLRE:{beatMag:15,beatStreak:15,momentum:31,analyst:39,target:0},
  XLB:{beatMag:19,beatStreak:12,momentum:44,analyst:25,target:0},
  XLC:{beatMag:33,beatStreak:17,momentum:33,analyst:17,target:0},
  XLY:{beatMag:28,beatStreak:17,momentum:39,analyst:16,target:0},
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

async function get(path) {
  const r = await fetch(FBASE + path + '&token=' + FKEY);
  if (r.status === 429) { await new Promise(x=>setTimeout(x,2000)); const r2 = await fetch(FBASE + path + '&token=' + FKEY); return r2.ok?r2.json():null; }
  return r.ok ? r.json() : null;
}
const fq = s => get('/quote?symbol='+encodeURIComponent(s));
const fp = async s => { try { return await get('/stock/profile2?symbol='+encodeURIComponent(s))||{}; } catch { return {}; } };
const fEarnings = async s => { try { return await get('/stock/earnings?symbol='+encodeURIComponent(s))||[]; } catch { return []; } };
const fRec = async s => { try { const d = await get('/stock/recommendation?symbol='+encodeURIComponent(s)); return d&&d.length?d[0]:null; } catch { return null; } };
const fTarget = async s => { try { return await get('/stock/price-target?symbol='+encodeURIComponent(s))||null; } catch { return null; } };

function calcScore(q, earnings, rec, target, etf) {
  const W = WEIGHTS[etf] || {beatMag:33,beatStreak:17,momentum:39,analyst:11,target:0};
  const recent = (earnings||[]).slice(0,4).filter(e => e.surprisePercent != null && Math.abs(e.surprisePercent) <= 100);  // drop outliers from near-zero EPS estimates
  const avgSurp = recent.length?recent.reduce((s,e)=>s+e.surprisePercent,0)/recent.length:null;
  const magScore = avgSurp===null?0:avgSurp>15?W.beatMag:avgSurp>10?Math.round(W.beatMag*.73):avgSurp>5?Math.round(W.beatMag*.47):avgSurp>0?Math.round(W.beatMag*.23):0;
  let streak=0; for(const e of (earnings||[]).slice(0,4)){ if((e.surprisePercent??-1)>0)streak++; else break; }
  const ss = streak>=4?W.beatStreak:streak===3?Math.round(W.beatStreak*.67):streak===2?Math.round(W.beatStreak*.4):streak===1?Math.round(W.beatStreak*.2):0;
  const dp = q?.dp||0;
  const ms = dp>10?W.momentum:dp>5?Math.round(W.momentum*.74):dp>1?Math.round(W.momentum*.46):dp>=0?Math.round(W.momentum*.23):0;
  let as2=0, ad='No data';
  if(rec){ const sb=rec.strongBuy||0,b=rec.buy||0,h=rec.hold||0,s=(rec.sell||0)+(rec.strongSell||0),tot=sb+b+h+s||1,bull=(sb+b)/tot;
    if(bull>.65&&sb>b){as2=W.analyst;ad='Strong Buy';}else if(bull>.55){as2=Math.round(W.analyst*.7);ad='Buy';}else if(h>sb+b){as2=Math.round(W.analyst*.3);ad='Hold';}else{ad='Sell';} }
  let ts=0, td='No data';
  if(target?.targetMean&&q?.c){ const up=((target.targetMean-q.c)/q.c)*100; td=(up>=0?'+':'')+up.toFixed(0)+'%'; ts=up>20?W.target:up>10?Math.round(W.target*.7):up>5?Math.round(W.target*.4):up>0?Math.round(W.target*.2):0; }
  return { total: magScore+ss+ms+as2+ts, signals: {
    beatMag:{score:magScore,max:W.beatMag,detail:avgSurp!==null?avgSurp.toFixed(1)+'%':'\u2014'},
    beatStreak:{score:ss,max:W.beatStreak,detail:streak+'Q'},
    momentum:{score:ms,max:W.momentum,detail:(dp>=0?'+':'')+dp.toFixed(2)+'%'},
    analyst:{score:as2,max:W.analyst,detail:ad},
    target:{score:ts,max:W.target,detail:td},
  }};
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function main() {
  console.log('Building scout data at', new Date().toISOString());
  const spy = await fq('SPY');
  if (!spy) { console.error('Cannot reach Finnhub.'); process.exit(1); }

  const result = { generatedAt: new Date().toISOString(), sectors: {} };

  for (const sec of SECTORS) {
    console.log('Scanning', sec.etf, '('+sec.name+')...');
    const stocks = sec.stocks.map(sym => ({ sym, etf: sec.etf, sectorName: sec.name }));

    // Quote + pre-filter to positive momentum
    const quoted = [];
    for (let i=0;i<stocks.length;i+=10) {
      const batch = stocks.slice(i,i+10);
      const res = await Promise.all(batch.map(async s=>{ const q=await fq(s.sym); return q&&q.c?{...s,dp:q.dp,c:q.c,_q:q}:null; }));
      quoted.push(...res.filter(s=>s&&(s.dp??0)>0));
      await sleep(500);
    }

    // Score, keep top 5
    const scored = [];
    for (let i=0;i<quoted.length;i+=3) {
      const batch = quoted.slice(i,i+3);
      await Promise.all(batch.map(async s=>{
        const [e,rec,tgt,prof] = await Promise.all([fEarnings(s.sym),fRec(s.sym),fTarget(s.sym),fp(s.sym)]);
        const sc = calcScore(s._q,e,rec,tgt,s.etf);
        scored.push({ sym:s.sym, name:prof?.name||s.sym, dp:s.dp, c:s.c, etf:s.etf, sectorName:s.sectorName, marketCap:prof?.marketCapitalization||null, score:sc.total, signals:sc.signals });
      }));
      await sleep(1200);
    }
    scored.sort((a,b)=>b.score-a.score);
    result.sectors[sec.etf] = { name: sec.name, scanned: stocks.length, afterFilter: quoted.length, top: scored.slice(0,5) };
    console.log('  '+sec.etf+': '+quoted.length+' movers, top score '+(scored[0]?.score??'n/a'));
  }

  fs.writeFileSync('scout-data.json', JSON.stringify(result, null, 2));
  console.log('scout-data.json written.');
}

main().catch(err => { console.error('Scout build failed:', err); process.exit(1); });
