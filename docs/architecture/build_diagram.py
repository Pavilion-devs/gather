"""Build Gather's original, editable SVG architecture overview (stdlib only)."""
from pathlib import Path
from html import escape
P = Path(__file__).resolve().parent
S = []
def add(s): S.append(s)
def text(x,y,s,cls='body',anchor='start'):
    add(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{escape(s)}</text>')
def rect(x,y,w,h,cls='card',rx=20):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{cls}"/>')
icons = {
 'browser':'<rect x="3" y="5" width="30" height="26" rx="4"/><path d="M3 13h30M9 9h1m5 0h1"/>',
 'shield':'<path d="m18 3 13 5v10c0 8-13 15-13 15S5 26 5 18V8Z"/><path d="m11 18 5 5 10-11"/>',
 'spark':'<path d="m18 3 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z"/>',
 'doc':'<path d="M9 3h13l7 7v23H9ZM22 3v8h7M14 17h10M14 23h10M14 28h6"/>',
 'mail':'<rect x="3" y="7" width="30" height="23" rx="4"/><path d="m4 9 14 11L32 9"/>',
 'db':'<ellipse cx="18" cy="7" rx="13" ry="5"/><path d="M5 7v21c0 7 26 7 26 0V7M5 17c0 7 26 7 26 0"/>',
 'cloud':'<path d="M9 28h20a6 6 0 0 0 0-12 10 10 0 0 0-19-3 7.5 7.5 0 0 0-1 15Z"/>',
 'clock':'<circle cx="18" cy="18" r="13"/><path d="M18 9v10l7 4"/>',
 'check':'<path d="m7 18 7 7 16-17"/>',
 'globe':'<circle cx="18" cy="18" r="14"/><ellipse cx="18" cy="18" rx="6" ry="14"/><path d="M4 18h28M7 10h22M7 26h22"/>',
}
def icon(x,y,name,color='sage',size=36):
    add(f'<g transform="translate({x} {y}) scale({size/36})" class="icon {color}" aria-hidden="true">{icons[name]}</g>')
def card(x,y,w,h,title,lines,name,color='sage'):
    rect(x,y,w,h)
    rect(x+24,y+24,54,54,'tile '+color,14)
    icon(x+33,y+33,name,color)
    text(x+95,y+59,title,'heading')
    for i,line in enumerate(lines): text(x+24,y+116+i*34,line)
def edge(d,color='sage',both=False,dashed=False):
    add(f'<path d="{d}" class="edge {color}{" support" if dashed else ""}" marker-end="url(#{color})"'+(f' marker-start="url(#{color}-back)"' if both else '')+'/>')
def label(x,y,s,anchor='middle'):text(x,y,s,'label',anchor)
add('''<svg xmlns="http://www.w3.org/2000/svg" width="2240" height="1600" viewBox="0 0 2240 1600" role="img" aria-labelledby="title desc">
<title id="title">Gather architecture — from evidence to a reviewed event plan</title>
<desc id="desc">A React application is served on Convex static hosting and uses Better Auth email-code sessions. Convex queries and mutations protect workspaces and persist evidence, candidate facts, plan revisions, email records and public snapshots. Scheduled ingestion retrieves venue text with Firecrawl and proposes cited facts with OpenAI. People review facts before deterministic calculations update the plan. Approved mail is sent through AgentMail; replies are checked on demand and explicitly imported for review. Only confirmed publication creates a revocable public report.</desc>
<defs><style>
text{font-family:Arial,Helvetica,sans-serif;fill:#34352f}.wordmark{font-family:Georgia,serif;font-size:72px;letter-spacing:-3px}.subtitle{font-size:27px;fill:#69695f}.heading{font-size:28px;font-weight:700;letter-spacing:-.5px}.body{font-size:24px;fill:#666960}.small{font-size:22px;fill:#74766d}.eyebrow{font-size:20px;font-weight:700;letter-spacing:2px;fill:#77776e}.card{fill:#fffefa;stroke:#e2e1d8;stroke-width:2;filter:url(#shadow)}.boundary{fill:#f0edf6;fill-opacity:.45;stroke:#cbc3dd;stroke-width:2;stroke-dasharray:9 8}.tile{stroke:none}.tile.sage{fill:#edf1e7}.tile.lilac{fill:#eee8fa}.tile.amber{fill:#fbf1dc}.tile.grey{fill:#f0f0ec}.icon{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.icon.sage,.edge.sage{stroke:#7a8b65}.icon.lilac,.edge.lilac{stroke:#9580b5}.icon.amber,.edge.amber{stroke:#b09757}.icon.grey,.edge.grey{stroke:#93958a}.edge{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.support{stroke-dasharray:7 7}.label{font-size:21px;fill:#6f7167;paint-order:stroke;stroke:#faf9f4;stroke-width:8;stroke-linejoin:round}.review{font-size:27px;font-weight:700;fill:#947438}
</style>
<filter id="shadow" x="-15%" y="-20%" width="130%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#423944" flood-opacity=".045"/></filter>
<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#e9e7df" stroke-width=".65"/></pattern>''')
for name,col in [('sage','#7a8b65'),('lilac','#9580b5'),('grey','#93958a'),('amber','#b09757')]:
    add(f'<marker id="{name}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 12 6 0 12Z" fill="{col}"/></marker>')
    add(f'<marker id="{name}-back" markerWidth="12" markerHeight="12" refX="2" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M12 0 0 6 12 12Z" fill="{col}"/></marker>')
add('</defs><rect width="2240" height="1600" fill="#faf9f4"/><rect width="2240" height="1600" fill="url(#grid)"/>')
text(64,124,'Gather','wordmark')
text(66,176,'Architecture · Check the plan. Before you pay deposits.','subtitle')
text(2176,100,'EVIDENCE → REVIEW → DECISION','eyebrow','end')
text(2176,145,'Convex · OpenAI · Firecrawl · AgentMail','subtitle','end')
rect(610,240,1030,1120,'boundary',28)
text(650,283,'CONVEX DEPLOYMENT','eyebrow')
text(1600,283,'API keys stay server-side','small','end')
rect(650,310,950,110)
icon(674,344,'cloud')
text(729,353,'Static hosting','heading')
text(729,390,'Public convex.site app','small')
add('<path d="M1120 336v58" stroke="#e2e1d8" stroke-width="2"/>')
icon(1145,344,'shield','lilac')
text(1200,353,'Better Auth','heading')
text(1200,390,'Email code · saved session','small')
# The left-hand user surface makes each decision boundary visible.
card(64,440,360,640,'React workspace',['Venue URL · PDF · text','PDF.js reads PDF text','Sources · plan · inbox'],'browser')
rect(88,681,312,202,'tile amber',16)
icon(110,707,'shield','amber')
text(163,736,'Human review','review')
text(110,783,'Accept selected facts')
text(110,824,'Approve exact email')
text(110,865,'Confirm report sharing')
text(88,946,'Deterministic preview','small')
text(88,983,'Same rules as the backend','small')
text(88,1047,'React + Vite','small')
edge('M244 440 V365 H650','grey',False,True)
label(470,340,'app + sign-in')
card(650,540,380,220,'Queries & updates',['Workspace access checks','Reactive source + plan views','Save imports and drafts'],'cloud')
card(1220,540,380,220,'Source ingestion',['Scheduled Convex action','Exact-quote validation','Store proposed facts'],'doc','lilac')
edge('M424 650 H650','sage',True)
label(537,622,'commands')
label(537,688,'live queries')
edge('M1030 615 H1220','sage')
label(1125,589,'queue import')
edge('M1220 715 H1030','lilac')
label(1125,749,'review data')
card(650,930,380,230,'Review & plan',['Selected facts + citations','Version-checked mutation','Timing checks + history'],'shield')
edge('M840 760 V930','amber')
label(862,834,'After explicit review','start')
label(862,870,'accept selected facts','start')
card(1220,930,380,230,'Email workflow',['Approved sends · stable IDs','On-demand inbox checks','Match sender and thread'],'mail')
edge('M1030 1030 H1220','sage')
label(1125,1000,'approved send')
edge('M1410 930 V760','lilac')
label(1437,837,'Import reply','start')
label(1437,872,'for review','start')
# External providers remain outside the deployment boundary.
text(1850,420,'EXTERNAL SERVICES','eyebrow')
card(1850,460,326,155,'Firecrawl',['Venue page → Markdown'],'globe','amber')
card(1850,660,326,190,'OpenAI',['GPT-5.6 Luna','Cited, structured proposals'],'spark','lilac')
card(1850,975,326,185,'AgentMail',['Send email · fetch replies','Also delivers sign-in codes'],'mail')
edge('M1600 585 H1740 V538 H1850','amber',True)
label(1724,512,'venue URL / text')
edge('M1600 704 H1735 V749 H1850','lilac',True)
label(1725,679,'text / facts')
edge('M1600 1060 H1850','sage',True)
label(1725,1034,'send / sync')
text(1850,1210,'Supplier email: organizer only','small')
text(1850,1247,'Replies never auto-apply','small')
# A common persistence layer is intentionally grouped rather than repeating every DB edge.
rect(650,1230,950,95,'tile sage',16)
icon(674,1254,'db')
text(730,1266,'Convex database + file storage','heading')
text(730,1303,'Sources · proposals · facts · revisions · messages · reports','small')
text(1125,1205,'Shared persistence for queries, mutations and actions','small','middle')
card(64,1150,360,184,'Published report',['Immutable snapshot','Read-only · revocable link'],'doc')
edge('M650 1110 H530 V1240 H424','grey',False,True)
label(533,1139,'publish')
# The footer is the product loop, distinct from the system connectors above.
rect(64,1410,2112,120)
text(94,1455,'THE REVIEW LOOP','eyebrow')
text(94,1495,'Evidence stays attached','small')
for x,n,title in [(480,'doc','Import'),(800,'shield','Review'),(1130,'clock','Check'),(1450,'mail','Clarify'),(1810,'check','Recheck')]:
    icon(x,1449,n)
    text(x+54,1478,title,'heading')
text(64,1571,'AI proposes facts. People accept them. Code checks the timing.','small')
text(2176,1571,'Same-day timing + delivery charge · September 2026','small','end')
add('</svg>')
(P/'gather-architecture.svg').write_text('\n'.join(S)+'\n')
