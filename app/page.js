'use client';
import { useState, useEffect } from 'react';
import { PLATFORMS } from '../lib/platforms';

// ─── tiny helpers ─────────────────────────────────────────────────────────────
function exportData(obj, fmt) {
  let out;
  if (fmt === 'json') out = JSON.stringify(obj, null, 2);
  else if (fmt === 'csv') out = Object.entries(obj).map(([k,v]) => `"${k}","${String(v).replace(/"/g,'""')}"`).join('\n');
  else out = Object.entries(obj).map(([k,v]) => `${k}: ${v}`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'text/plain' }));
  a.download = `cloudsint_${Date.now()}.${fmt}`;
  a.click();
}

const Pill = ({ color, children }) => <span className={`pill pill-${color}`}>{children}</span>;

const KV = ({ label, value }) => (
  <div className="kv-row">
    <span className="kv-k">{label}</span>
    <span className="kv-v">{value}</span>
  </div>
);

const Card = ({ title, badge, children }) => (
  <div className="card">
    <div className="card-head">
      <span className="card-title">{title}</span>
      {badge && <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{badge}</span>}
    </div>
    <div className="card-body">{children}</div>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="empty-state">{children}</div>
);

const LoadingState = ({ label }) => (
  <div className="loading-state">
    <div className="scan-bar"><div className="scan-fill" /></div>
    <div className="loading-label">{label}</div>
  </div>
);

const ExportRow = ({ obj }) => (
  <div className="export-btns">
    {['json','csv','txt'].map(f => (
      <button key={f} className="export-btn" onClick={() => exportData(obj, f)}>{f.toUpperCase()}</button>
    ))}
  </div>
);

const ResultHeader = ({ title, query, exportObj }) => (
  <div className="result-header">
    <div className="result-title">{title}: <span>{query || '—'}</span></div>
    {exportObj && <ExportRow obj={exportObj} />}
  </div>
);

const DNSRow = ({ type, value, small }) => (
  <div className="dns-row">
    <span className="dns-t">{type}</span>
    <span className="dns-v" style={small ? { fontSize:10 } : {}}>{value}</span>
  </div>
);

// ─── USERNAME PANEL ───────────────────────────────────────────────────────────
function UsernamePanel({ query }) {
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState([]);
  const [checked, setChecked] = useState(0);
  const [found, setFound] = useState(0);

  useEffect(() => {
    if (!query) { setStatus('idle'); return; }
    let cancelled = false;
    setStatus('scanning');
    setResults(PLATFORMS.map(p => ({ ...p, state:'checking', url: p.u.replace('{}', encodeURIComponent(query)) })));
    setChecked(0); setFound(0);

    (async () => {
      const chunks = [];
      for (let i = 0; i < PLATFORMS.length; i += 6) chunks.push(PLATFORMS.slice(i, i+6));
      let tc = 0, tf = 0;
      for (const chunk of chunks) {
        if (cancelled) break;
        await Promise.all(chunk.map(async p => {
          const url = p.u.replace('{}', encodeURIComponent(query));
          let state = 'not-found';
          try { await fetch(url, { method:'HEAD', mode:'no-cors', signal: AbortSignal.timeout(4000) }); state = 'found'; tf++; } catch {}
          tc++;
          if (!cancelled) {
            setResults(prev => prev.map(r => r.n === p.n ? { ...r, state, url } : r));
            setChecked(tc); setFound(tf);
          }
        }));
        await new Promise(r => setTimeout(r, 60));
      }
      if (!cancelled) setStatus('done');
    })();

    return () => { cancelled = true; };
  }, [query]);

  const foundMap = Object.fromEntries(
    results.filter(r => r.state === 'found').map(r => [r.n, r.url])
  );

  if (status === 'idle') return (
    <EmptyState>
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="14" r="7"/><path d="M6 38a14 14 0 0128 0"/></svg>
      <p>Enter a username above to scan {PLATFORMS.length}+ platforms</p>
    </EmptyState>
  );

  return (
    <div>
      <ResultHeader title="Username" query={query} exportObj={status === 'done' ? foundMap : null} />
      <div className="summary-strip">
        <div className="sstat"><div className="sstat-num blue">{PLATFORMS.length}</div><div className="sstat-label">Platforms</div></div>
        <div className="sstat"><div className="sstat-num green">{found}</div><div className="sstat-label">Found</div></div>
        <div className="sstat"><div className="sstat-num">{checked}</div><div className="sstat-label">Checked</div></div>
        <div className="sstat"><div className={`sstat-num ${status==='done'?'':'yellow'}`}>{PLATFORMS.length - checked}</div><div className="sstat-label">Remaining</div></div>
      </div>
      <Card title="Platform Scan" badge={status === 'scanning' ? `${Math.round(checked/PLATFORMS.length*100)}%` : 'complete'}>
        <div className="plat-grid">
          {results.map(r => (
            <div key={r.n} className={`plat-card ${r.state}`}>
              <div className={`plat-dot ${r.state==='found'?'on':r.state==='checking'?'chk':'off'}`} />
              <span className="plat-name">{r.n}</span>
              {r.state === 'found' && <a className="plat-link" href={r.url} target="_blank" rel="noopener noreferrer">↗</a>}
            </div>
          ))}
        </div>
      </Card>
      <p className="notice">Due to CORS restrictions, &ldquo;found&rdquo; means the server responded. Click ↗ to verify the profile exists.</p>
    </div>
  );
}

// ─── EMAIL PANEL ──────────────────────────────────────────────────────────────
function EmailPanel({ query }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setRes(null); return; }
    setLoading(true); setRes(null);
    const email = query.trim();
    const atIdx = email.indexOf('@');
    const local = atIdx >= 0 ? email.slice(0, atIdx) : email;
    const domain = atIdx >= 0 ? email.slice(atIdx + 1) : '';
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const DISP = ['mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com','throwam.com','yopmail.com','sharklasers.com','fakeinbox.com','trashmail.com','maildrop.cc'];
    const FREE = ['gmail.com','yahoo.com','hotmail.com','outlook.com','protonmail.com','icloud.com','aol.com','live.com','zoho.com'];
    const disposable = DISP.includes(domain.toLowerCase());
    const isFree = FREE.includes(domain.toLowerCase());

    Promise.all([
      fetch(`https://dns.google/resolve?name=${domain}&type=MX`).then(r=>r.json()).catch(()=>({Answer:[]})),
      fetch(`https://dns.google/resolve?name=${domain}&type=TXT`).then(r=>r.json()).catch(()=>({Answer:[]})),
      fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`).then(r=>r.json()).catch(()=>({Answer:[]})),
    ]).then(([mxR, txtR, dmarcR]) => {
      const mx = mxR.Answer || [];
      const txts = (txtR.Answer || []).map(t => t.data);
      const hasSPF = txts.some(t => t.includes('v=spf1'));
      const hasDMARC = (dmarcR.Answer || []).some(t => t.data && t.data.includes('v=DMARC1'));
      const hasDKIM = txts.some(t => t.includes('v=DKIM1'));
      const patterns = [];
      if (/^[a-z]+\.[a-z]+$/.test(local)) patterns.push('firstname.lastname');
      if (/^\w\.[a-z]+$/.test(local)) patterns.push('initial.lastname');
      if (/\d{4}$/.test(local)) patterns.push('ends-with-year');
      if (local.includes('_')) patterns.push('underscore-separated');
      if (local.includes('+')) patterns.push('plus-alias');
      const riskLevel = disposable ? 'HIGH' : !mx.length ? 'MEDIUM' : 'LOW';
      setRes({ email, local, domain, valid, disposable, isFree, mx, txts, hasSPF, hasDMARC, hasDKIM, patterns, riskLevel });
      setLoading(false);
    });
  }, [query]);

  if (!query) return <EmptyState><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="8" width="32" height="24" rx="2"/><path d="M4 12l16 12L36 12"/></svg><p>Enter an email address above to analyze</p></EmptyState>;
  if (loading) return <LoadingState label="Analyzing email address..." />;
  if (!res) return null;

  const exportObj = { email:res.email, local:res.local, domain:res.domain, valid:res.valid, deliverable:String(!!res.mx.length), disposable:String(res.disposable), spf:String(res.hasSPF), dmarc:String(res.hasDMARC), risk:res.riskLevel };

  return (
    <div>
      <ResultHeader title="Email" query={res.email} exportObj={exportObj} />
      <div className="summary-strip">
        <div className="sstat"><div className={`sstat-num ${res.valid?'green':'red'}`}>{res.valid?'✓':'✗'}</div><div className="sstat-label">Format</div></div>
        <div className="sstat"><div className={`sstat-num ${res.mx.length?'green':'red'}`}>{res.mx.length?'✓':'✗'}</div><div className="sstat-label">Deliverable</div></div>
        <div className="sstat"><div className={`sstat-num ${!res.disposable?'green':'red'} sm`}>{res.disposable?'DISP':'OK'}</div><div className="sstat-label">Disposable</div></div>
        <div className="sstat"><div className={`sstat-num ${res.riskLevel==='LOW'?'green':res.riskLevel==='MEDIUM'?'yellow':'red'} sm`}>{res.riskLevel}</div><div className="sstat-label">Risk</div></div>
      </div>
      <Card title="Address Analysis">
        <KV label="Local part" value={res.local} />
        <KV label="Domain" value={res.domain} />
        <KV label="Format valid" value={<Pill color={res.valid?'green':'red'}>{res.valid?'VALID':'INVALID'}</Pill>} />
        <KV label="Provider type" value={res.disposable ? <Pill color="red">DISPOSABLE</Pill> : res.isFree ? <Pill color="yellow">FREE PROVIDER</Pill> : <Pill color="blue">CORPORATE</Pill>} />
        <KV label="MX / Deliverable" value={<Pill color={res.mx.length?'green':'red'}>{res.mx.length?'YES':'NO MX RECORDS'}</Pill>} />
        {res.patterns.length > 0 && <KV label="Patterns" value={res.patterns.map(p => <Pill key={p} color="purple">{p}</Pill>)} />}
      </Card>
      {res.mx.length > 0 && <Card title="Mail Servers (MX)">{res.mx.map((r,i) => <DNSRow key={i} type="MX" value={r.data} />)}</Card>}
      <Card title="Email Security Posture">
        <KV label="SPF" value={<Pill color={res.hasSPF?'green':'red'}>{res.hasSPF?'CONFIGURED':'MISSING'}</Pill>} />
        <KV label="DMARC" value={<Pill color={res.hasDMARC?'green':'red'}>{res.hasDMARC?'CONFIGURED':'MISSING'}</Pill>} />
        <KV label="DKIM" value={<Pill color={res.hasDKIM?'green':'yellow'}>{res.hasDKIM?'FOUND IN TXT':'NOT DETECTED'}</Pill>} />
      </Card>
      <Card title="Breach & Exposure Lookup">
        <KV label="HaveIBeenPwned" value={<a href={`https://haveibeenpwned.com/account/${encodeURIComponent(res.email)}`} target="_blank" rel="noopener noreferrer">Check on HIBP ↗</a>} />
        <KV label="IntelligenceX" value={<a href={`https://intelx.io/?s=${encodeURIComponent(res.email)}`} target="_blank" rel="noopener noreferrer">Search IntelX ↗</a>} />
        <KV label="DeHashed" value={<a href={`https://dehashed.com/search?query=${encodeURIComponent(res.email)}`} target="_blank" rel="noopener noreferrer">Search DeHashed ↗</a>} />
      </Card>
      {res.txts.length > 0 && <Card title="TXT Records">{res.txts.map((t,i) => <DNSRow key={i} type="TXT" value={t} small />)}</Card>}
    </div>
  );
}

// ─── PHONE PANEL ──────────────────────────────────────────────────────────────
function PhonePanel({ query }) {
  if (!query) return <EmptyState><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="2" width="20" height="36" rx="3"/><circle cx="20" cy="33" r="1.5" fill="currentColor"/></svg><p>Enter a phone number above to analyze</p></EmptyState>;

  const raw = query.trim();
  const clean = raw.replace(/[\s\-\(\)]/g, '');
  const digits = clean.replace(/\D/g, '');
  const cc = clean.startsWith('+') ? (digits.length > 11 ? digits.slice(0,2) : digits.slice(0,1)) : '?';
  const REGIONS = {'1':'North America','44':'United Kingdom','49':'Germany','33':'France','61':'Australia','91':'India','86':'China','81':'Japan','55':'Brazil','7':'Russia'};
  const valid = digits.length >= 7 && digits.length <= 15;
  const region = REGIONS[cc] || 'Unknown region';
  const exportObj = { raw, normalized:clean, digits, country_code:'+'+cc, region, valid:String(valid) };

  return (
    <div>
      <ResultHeader title="Phone" query={raw} exportObj={exportObj} />
      <div className="summary-strip">
        <div className="sstat"><div className={`sstat-num ${valid?'green':'red'}`}>{valid?'✓':'✗'}</div><div className="sstat-label">Valid</div></div>
        <div className="sstat"><div className="sstat-num blue sm">+{cc}</div><div className="sstat-label">Country Code</div></div>
        <div className="sstat"><div className="sstat-num">{digits.length}</div><div className="sstat-label">Digits</div></div>
      </div>
      <Card title="Number Analysis">
        <KV label="Raw input" value={raw} />
        <KV label="Normalized" value={clean} />
        <KV label="Digits only" value={digits} />
        <KV label="Country code" value={`+${cc}`} />
        <KV label="Region" value={region} />
        <KV label="Validity" value={<Pill color={valid?'green':'red'}>{valid?'VALID FORMAT':'INVALID FORMAT'}</Pill>} />
      </Card>
      <Card title="Lookup Resources">
        <KV label="Truecaller" value={<a href={`https://www.truecaller.com/search/us/${digits}`} target="_blank" rel="noopener noreferrer">Search Truecaller ↗</a>} />
        <KV label="WhoCalledUs" value={<a href={`https://whocalledus.com/numbers/${digits}`} target="_blank" rel="noopener noreferrer">WhoCalledUs ↗</a>} />
        <KV label="800Notes" value={<a href={`https://800notes.com/Phone.aspx/${digits}`} target="_blank" rel="noopener noreferrer">800Notes ↗</a>} />
        <KV label="Sync.me" value={<a href={`https://sync.me/search/?number=${encodeURIComponent(clean)}`} target="_blank" rel="noopener noreferrer">Sync.me ↗</a>} />
        <KV label="NumVerify" value={<a href="https://numverify.com/" target="_blank" rel="noopener noreferrer">NumVerify API ↗</a>} />
      </Card>
      <Card title="Social Reverse Lookup">
        <KV label="WhatsApp" value={<a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">Click-to-chat ↗</a>} />
        <KV label="Telegram" value={<a href={`https://t.me/${digits}`} target="_blank" rel="noopener noreferrer">Telegram lookup ↗</a>} />
        <KV label="Facebook" value={<a href={`https://www.facebook.com/search/people/?q=${encodeURIComponent(raw)}`} target="_blank" rel="noopener noreferrer">Facebook search ↗</a>} />
      </Card>
      <p className="notice">Carrier/line-type detection requires a paid API (NumVerify, AbstractAPI). Above links connect to free public services.</p>
    </div>
  );
}

// ─── IP PANEL ─────────────────────────────────────────────────────────────────
function IPPanel({ query }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true); setRes(null); setErr('');
    const url = query?.trim() ? `https://ipapi.co/${encodeURIComponent(query.trim())}/json/` : 'https://ipapi.co/json/';
    fetch(url).then(r => r.json()).then(async d => {
      if (d.error) throw new Error(d.reason || 'Invalid IP address');
      let rdns = '—';
      try {
        const r = await fetch(`https://dns.google/resolve?name=${d.ip}&type=PTR`).then(r => r.json());
        rdns = r.Answer?.[0]?.data || '—';
      } catch {}
      const isProxy = !!(d.org && /vpn|proxy|tor|hosting|cloud|aws|azure|gcp|digitalocean|linode|vultr|ovh|hetzner/i.test(d.org));
      setRes({ ...d, rdns, isProxy }); setLoading(false);
    }).catch(e => { setErr(e.message); setLoading(false); });
  }, [query]);

  if (loading) return <LoadingState label="Fetching IP intelligence..." />;
  if (err) return <div style={{ color:'var(--red)', fontSize:12, padding:'20px 0', fontFamily:'var(--mono)' }}>Error: {err}</div>;
  if (!res) return null;

  const exportObj = { ip:res.ip, country:res.country_name||'', city:res.city||'', region:res.region||'', asn:res.asn||'', org:res.org||'', lat:String(res.latitude), lng:String(res.longitude), timezone:res.timezone||'' };

  return (
    <div>
      <ResultHeader title="IP Address" query={res.ip} exportObj={exportObj} />
      <div className="summary-strip">
        <div className="sstat"><div className="sstat-num blue sm">{res.country_code || '—'}</div><div className="sstat-label">Country</div></div>
        <div className="sstat"><div className="sstat-num sm">{(res.city || '—').slice(0,10)}</div><div className="sstat-label">City</div></div>
        <div className="sstat"><div className={`sstat-num ${res.isProxy?'yellow':'green'} sm`}>{res.isProxy?'PROXY':'CLEAN'}</div><div className="sstat-label">Risk</div></div>
      </div>
      <Card title="Geolocation">
        <KV label="IP Address" value={res.ip} />
        <KV label="Version" value={res.version} />
        <KV label="Country" value={`${res.country_name} (${res.country_code})`} />
        <KV label="Region" value={res.region || '—'} />
        <KV label="City" value={res.city || '—'} />
        <KV label="Postal" value={res.postal || '—'} />
        <KV label="Coordinates" value={`${res.latitude}, ${res.longitude}`} />
        <KV label="Timezone" value={`${res.timezone} (${res.utc_offset})`} />
      </Card>
      <Card title="Network Intelligence">
        <KV label="ASN" value={res.asn || '—'} />
        <KV label="Organization" value={res.org || '—'} />
        <KV label="Network" value={res.network || '—'} />
        <KV label="Reverse DNS" value={res.rdns} />
        <KV label="Proxy / VPN" value={<Pill color={res.isProxy?'yellow':'green'}>{res.isProxy?'LIKELY PROXY/HOSTING':'NOT DETECTED'}</Pill>} />
      </Card>
      <Card title="Regional & Tools">
        <KV label="Calling code" value={res.country_calling_code || '—'} />
        <KV label="Currency" value={`${res.currency} — ${res.currency_name}`} />
        <KV label="Languages" value={res.languages} />
        <KV label="Google Maps" value={<a href={`https://www.google.com/maps?q=${res.latitude},${res.longitude}`} target="_blank" rel="noopener noreferrer">View location ↗</a>} />
        <KV label="Shodan" value={<a href={`https://www.shodan.io/host/${res.ip}`} target="_blank" rel="noopener noreferrer">View on Shodan ↗</a>} />
        <KV label="GreyNoise" value={<a href={`https://viz.greynoise.io/ip/${res.ip}`} target="_blank" rel="noopener noreferrer">View on GreyNoise ↗</a>} />
      </Card>
    </div>
  );
}

// ─── DOMAIN PANEL ─────────────────────────────────────────────────────────────
function DomainPanel({ query }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setRes(null); return; }
    const domain = query.trim().replace(/^https?:\/\//, '').split('/')[0];
    setLoading(true); setRes(null);
    const types = ['A','AAAA','MX','NS','TXT','CNAME','SOA','CAA'];
    const dns = {};
    Promise.all([
      ...types.map(t => fetch(`https://dns.google/resolve?name=${domain}&type=${t}`).then(r=>r.json()).then(d=>{dns[t]=d.Answer||[];}).catch(()=>{dns[t]=[];})),
      fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`).then(r=>r.json()).then(d=>{dns._dmarc=d.Answer||[];}).catch(()=>{dns._dmarc=[];}),
    ]).then(async () => {
      const txts = (dns.TXT || []).map(t => t.data);
      const hasSPF = txts.some(t => t.includes('v=spf1'));
      const hasDMARC = (dns._dmarc || []).some(t => t.data && t.data.includes('v=DMARC1'));
      const hasCAA = (dns.CAA || []).length > 0;
      const ip = dns.A?.[0]?.data;
      let geo = null;
      if (ip) { try { geo = await fetch(`https://ipapi.co/${ip}/json/`).then(r=>r.json()); if (geo.error) geo = null; } catch {} }
      setRes({ domain, dns, txts, hasSPF, hasDMARC, hasCAA, ip, geo });
      setLoading(false);
    });
  }, [query]);

  if (!query) return <EmptyState><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="10" width="36" height="22" rx="2"/><path d="M2 18h36M10 10v22M30 10v22"/></svg><p>Enter a domain name to inspect</p></EmptyState>;
  if (loading) return <LoadingState label="Enumerating DNS records..." />;
  if (!res) return null;

  const DR = (type) => (res.dns[type] || []).map((r,i) => <DNSRow key={i} type={type} value={r.data} />);

  return (
    <div>
      <ResultHeader title="Domain" query={res.domain} exportObj={{ domain:res.domain, ip:res.ip||'—', spf:String(res.hasSPF), dmarc:String(res.hasDMARC), caa:String(res.hasCAA) }} />
      <div className="summary-strip">
        <div className="sstat"><div className={`sstat-num ${res.dns.A.length?'green':'red'} sm`}>{res.dns.A.length?'UP':'DOWN'}</div><div className="sstat-label">Resolves</div></div>
        <div className="sstat"><div className={`sstat-num ${res.hasSPF?'green':'red'}`}>{res.hasSPF?'✓':'✗'}</div><div className="sstat-label">SPF</div></div>
        <div className="sstat"><div className={`sstat-num ${res.hasDMARC?'green':'red'}`}>{res.hasDMARC?'✓':'✗'}</div><div className="sstat-label">DMARC</div></div>
        <div className="sstat"><div className={`sstat-num ${res.hasCAA?'green':'yellow'}`}>{res.hasCAA?'✓':'✗'}</div><div className="sstat-label">CAA</div></div>
      </div>
      {(res.dns.A.length || res.dns.AAAA.length || res.dns.CNAME.length) ? <Card title="Host Records">{DR('A')}{DR('AAAA')}{DR('CNAME')}</Card> : null}
      {res.dns.MX?.length ? <Card title="Mail Servers (MX)">{DR('MX')}</Card> : null}
      {res.dns.NS?.length ? <Card title="Nameservers (NS)">{DR('NS')}</Card> : null}
      <Card title="Email Security Posture">
        <KV label="SPF" value={<Pill color={res.hasSPF?'green':'red'}>{res.hasSPF?'CONFIGURED':'MISSING'}</Pill>} />
        <KV label="DMARC" value={<Pill color={res.hasDMARC?'green':'red'}>{res.hasDMARC?'CONFIGURED':'MISSING'}</Pill>} />
        <KV label="CAA Records" value={<Pill color={res.hasCAA?'green':'yellow'}>{res.hasCAA?'PRESENT':'ABSENT'}</Pill>} />
      </Card>
      {res.geo && (
        <Card title={`Server Location (${res.ip})`}>
          <KV label="IP" value={res.ip} />
          <KV label="Country" value={`${res.geo.country_name} (${res.geo.country_code})`} />
          <KV label="City" value={res.geo.city || '—'} />
          <KV label="ISP / Host" value={res.geo.org || '—'} />
          <KV label="ASN" value={res.geo.asn || '—'} />
        </Card>
      )}
      {res.txts.length > 0 && <Card title="TXT Records">{res.txts.map((t,i) => <DNSRow key={i} type="TXT" value={t} small />)}</Card>}
      <Card title="External Intelligence Tools">
        <KV label="Shodan" value={<a href={`https://www.shodan.io/search?query=${res.domain}`} target="_blank" rel="noopener noreferrer">Shodan ↗</a>} />
        <KV label="VirusTotal" value={<a href={`https://www.virustotal.com/gui/domain/${res.domain}`} target="_blank" rel="noopener noreferrer">VirusTotal ↗</a>} />
        <KV label="SecurityTrails" value={<a href={`https://securitytrails.com/domain/${res.domain}/dns`} target="_blank" rel="noopener noreferrer">SecurityTrails ↗</a>} />
        <KV label="Wayback Machine" value={<a href={`https://web.archive.org/web/*/${res.domain}`} target="_blank" rel="noopener noreferrer">Archive.org ↗</a>} />
        <KV label="crt.sh" value={<a href={`https://crt.sh/?q=${res.domain}`} target="_blank" rel="noopener noreferrer">Certificate Transparency ↗</a>} />
      </Card>
    </div>
  );
}

// ─── DISCORD PANEL ────────────────────────────────────────────────────────────
function DiscordPanel({ query }) {
  if (!query) return <EmptyState><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 28s-2 2.5-6 3c1-1.5 2-3 2-5a14 14 0 1 1 8 2z"/></svg><p>Enter a Discord User ID (17–19 digit snowflake)</p></EmptyState>;

  const clean = query.trim().replace(/\D/g,'');
  const valid = /^\d{17,19}$/.test(clean);
  let created = '—', year = '—', workerId = '—', processId = '—';
  if (valid) {
    try {
      const sf = BigInt(clean);
      const ms = Number(sf >> 22n) + 1420070400000;
      created = new Date(ms).toUTCString();
      year = String(new Date(ms).getFullYear());
      workerId = String(Number((sf >> 17n) & 0x1Fn));
      processId = String(Number((sf >> 12n) & 0x1Fn));
    } catch {}
  }

  return (
    <div>
      <ResultHeader title="Discord ID" query={clean} />
      <div className="summary-strip">
        <div className="sstat"><div className={`sstat-num ${valid?'green':'red'}`}>{valid?'✓':'✗'}</div><div className="sstat-label">Valid Snowflake</div></div>
        <div className="sstat"><div className="sstat-num blue sm">{year}</div><div className="sstat-label">Account Year</div></div>
      </div>
      <Card title="Snowflake Decode">
        <KV label="Discord ID" value={clean} />
        <KV label="Valid format" value={<Pill color={valid?'green':'red'}>{valid?'YES — 17–19 digits':'INVALID'}</Pill>} />
        <KV label="Account created" value={created} />
        {valid && <><KV label="Worker ID" value={workerId} /><KV label="Process ID" value={processId} /></>}
      </Card>
      <Card title="Lookup Resources">
        <KV label="Profile URL" value={<a href={`https://discord.com/users/${clean}`} target="_blank" rel="noopener noreferrer">discord.com/users/{clean} ↗</a>} />
        <KV label="Discord.id" value={<a href={`https://discord.id/?prefill=${clean}`} target="_blank" rel="noopener noreferrer">discord.id lookup ↗</a>} />
        <KV label="DiscordLookup" value={<a href={`https://discordlookup.com/user/${clean}`} target="_blank" rel="noopener noreferrer">discordlookup.com ↗</a>} />
        <KV label="Avatar CDN" value={<a href={`https://cdn.discordapp.com/avatars/${clean}/`} target="_blank" rel="noopener noreferrer">cdn.discordapp.com ↗</a>} />
      </Card>
      <p className="notice">Full profile data (username, avatar hash, badges) requires Discord API bot access.</p>
    </div>
  );
}

// ─── AI ANALYST PANEL ─────────────────────────────────────────────────────────
function AIPanel({ query }) {
  const [prompt, setPrompt] = useState('');
  const [res, setRes] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (query) setPrompt(query); }, [query]);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setRes(''); setErr('');
    try {
      const data = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt }),
      }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setRes(data.result);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const formatted = res
    .replace(/^([A-Z][A-Z\s]+:)/gm, '<span class="ai-section">$1</span>')
    .replace(/\n/g, '<br>');

  return (
    <div>
      <div className="result-header"><div className="result-title">AI <span>Analyst</span></div></div>
      <Card title="Intelligence Request">
        <textarea
          style={{ width:'100%', minHeight:90, resize:'vertical', marginBottom:10, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:6, padding:'10px 12px', fontSize:12, fontFamily:'var(--mono)', color:'var(--text)', outline:'none' }}
          placeholder="Describe your target, paste OSINT findings, or ask a methodology question... (Ctrl+Enter to run)"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && run()}
        />
        <button className="go-btn" onClick={run} disabled={loading} style={{ width:'100%' }}>
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </Card>
      {loading && <LoadingState label="AI analyst processing..." />}
      {err && <div style={{ color:'var(--red)', fontSize:12, fontFamily:'var(--mono)', padding:'12px 0' }}>Error: {err}</div>}
      {res && <Card title="Analysis Output"><div className="ai-output" dangerouslySetInnerHTML={{ __html: formatted }} /></Card>}
      {!res && !loading && (
        <EmptyState>
          <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="20" r="16"/><path d="M20 12v8l5 3"/></svg>
          <p>Powered by Claude — describe a target or paste OSINT findings</p>
          <p className="sub">Set ANTHROPIC_API_KEY in Vercel environment variables</p>
        </EmptyState>
      )}
    </div>
  );
}

// ─── MAIN APP SHELL ───────────────────────────────────────────────────────────
const MODULES = [
  { id:'username', label:'Username',   ph:'Enter username to scan 50+ platforms...' },
  { id:'email',    label:'Email',      ph:'Enter email address (user@domain.com)...' },
  { id:'phone',    label:'Phone',      ph:'Enter phone number (+1 555 000 0000)...' },
  { id:'ip',       label:'IP Address', ph:'Enter IP or leave blank for your IP...' },
  { id:'domain',   label:'Domain',     ph:'Enter domain (example.com)...' },
  { id:'discord',  label:'Discord',    ph:'Enter Discord User ID (17–19 digits)...' },
  { id:'ai',       label:'AI Analyst', ph:'Describe target or paste collected intel...' },
];

function SidebarIcon({ id }) {
  const icons = {
    username: <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z" />,
    email:    <><rect x="1" y="4" width="14" height="10" rx="1" stroke="currentColor" fill="none" strokeWidth="1.2"/><path d="M1 6l7 5 7-5" stroke="currentColor" fill="none" strokeWidth="1.2"/></>,
    phone:    <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zm4 10a.5.5 0 100 1 .5.5 0 000-1z" />,
    ip:       <><circle cx="8" cy="8" r="6" stroke="currentColor" fill="none" strokeWidth="1.2"/><path d="M8 2v12M2 8h12" stroke="currentColor" fill="none" strokeWidth="1.2"/></>,
    domain:   <><rect x="1" y="4" width="14" height="9" rx="1" stroke="currentColor" fill="none" strokeWidth="1.2"/><path d="M1 8h14" stroke="currentColor" fill="none" strokeWidth="1.2"/></>,
    discord:  <path d="M13.5 2A1.5 1.5 0 0115 3.5v9.25a1.5 1.5 0 01-1.5 1.5H3.75l-.5-1.5L2 14.5V3.5A1.5 1.5 0 013.5 2h10zm-7 5.5a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2z" />,
    ai:       <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 3a1 1 0 00-1 1v3a1 1 0 002 0V5a1 1 0 00-1-1zm0 7a1 1 0 100 2 1 1 0 000-2z" />,
  };
  return <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">{icons[id]}</svg>;
}

export default function Home() {
  const [mod, setMod] = useState('username');
  const [input, setInput] = useState('');
  // committedKey changes whenever user hits Search, re-mounting the panel
  const [committedKey, setCommittedKey] = useState(0);
  const [committedQuery, setCommittedQuery] = useState('');

  const switchMod = (id) => {
    setMod(id);
    setInput('');
    setCommittedQuery('');
    setCommittedKey(k => k + 1);
  };

  const search = () => {
    setCommittedQuery(input.trim());
    setCommittedKey(k => k + 1);
  };

  const current = MODULES.find(m => m.id === mod);

  const renderPanel = () => {
    const key = `${mod}-${committedKey}`;
    const q = committedQuery;
    switch(mod) {
      case 'username': return <UsernamePanel key={key} query={q} />;
      case 'email':    return <EmailPanel    key={key} query={q} />;
      case 'phone':    return <PhonePanel    key={key} query={q} />;
      case 'ip':       return <IPPanel       key={key} query={q} />;
      case 'domain':   return <DomainPanel   key={key} query={q} />;
      case 'discord':  return <DiscordPanel  key={key} query={q} />;
      case 'ai':       return <AIPanel       key={key} query={q} />;
      default: return null;
    }
  };

  return (
    <div className="app">
      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-left">
          <div className="logo-mark">
            <svg viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="var(--bg)" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42" stroke="var(--bg)" strokeWidth="1.2" />
            </svg>
          </div>
          <span className="logo-name">CLOUD<span>SINT</span></span>
          <span className="logo-tag">v2.0 — OSINT Platform</span>
        </div>
        <div className="hdr-status">
          <div className="status-dot" />
          <span>All modules operational</span>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="search-zone">
        <div className="type-row">
          {MODULES.map(m => (
            <button
              key={m.id}
              className={`type-btn${mod === m.id ? ' active' : ''}`}
              onClick={() => switchMod(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="search-row">
          <input
            className="search-input"
            placeholder={current?.ph}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button className="go-btn" onClick={search}>SEARCH</button>
        </div>
      </div>

      {/* BODY */}
      <div className="main">
        <nav className="sidebar">
          <div className="sidebar-section">Modules</div>
          {MODULES.slice(0, 6).map(m => (
            <div
              key={m.id}
              className={`sidebar-item${mod === m.id ? ' active' : ''}`}
              onClick={() => switchMod(m.id)}
            >
              <SidebarIcon id={m.id} />
              {m.label}
            </div>
          ))}
          <div className="sidebar-divider" />
          <div className="sidebar-section">Intelligence</div>
          <div className={`sidebar-item${mod === 'ai' ? ' active' : ''}`} onClick={() => switchMod('ai')}>
            <SidebarIcon id="ai" />
            AI Analyst
          </div>
        </nav>

        <main className="content">
          <div className="content-inner">
            {renderPanel()}
          </div>
        </main>
      </div>
    </div>
  );
}
