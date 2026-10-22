import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownUp, Check, CircleHelp, Download, FlaskConical,
  GitBranch, Minus, Moon, MousePointer2, Move, Play, Plus, RotateCcw,
  RotateCw, Shuffle, SkipForward, Square, Sun, Trash2, ZoomIn, ZoomOut
} from 'lucide-react';
import {
  PRESETS, createPresetGraph, createVertex, addEdge, deleteVertex, deleteEdge, getConflicts,
  getGraphStats, getNeighbors, isValidColoring, greedyColoring, welshPowellColoring,
  backtrackingColoring, validateGraph, type Graph, type Edge, type AlgorithmRun
} from '@/lib/graph-coloring';
import './index.css';

type Run = AlgorithmRun;
const palette = ['#218b79','#d27b37','#557ec5','#9a68ae','#d1a83a','#cc5b5b','#48a6b2','#829342','#d36e9b','#66717d'];
const utility = { createPresetGraph, createVertex, addEdge, deleteVertex, deleteEdge, getConflicts, getGraphStats, getNeighbors, isValidColoring, greedyColoring, welshPowellColoring, backtrackingColoring, validateGraph };
const presetList = PRESETS;

function safeGraph(value: any): Graph {
  if (!value || !Array.isArray(value.vertices) || !Array.isArray(value.edges)) return { vertices: [], edges: [] };
  const candidate = { vertices: value.vertices.map((v: any) => ({ id: String(v.id), label: String(v.label ?? v.id), x: Number(v.x)||0, y: Number(v.y)||0, color: Number.isInteger(v.color) ? v.color : null })), edges: value.edges.map((e: any) => ({ source: String(e.source), target: String(e.target) })) };
  const validation = utility.validateGraph(candidate);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return candidate;
}
function makePresetGraph(p: any): Graph {
  try { return safeGraph(utility.createPresetGraph(p?.id ?? p?.key ?? p?.name ?? p)); } catch {
    try { return safeGraph(utility.createPresetGraph(p?.name ?? p)); } catch { return { vertices: [], edges: [] }; }
  }
}
function identifyPreset(value: Graph): string {
  const vertices = value.vertices.map(v => `${v.id}:${v.label}`).sort().join(',');
  const edges = value.edges.map(e => [e.source,e.target].sort().join('~')).sort().join(',');
  const index = presetList.findIndex(p => {
    const candidate = safeGraph(p.graph);
    return candidate.vertices.map(v => `${v.id}:${v.label}`).sort().join(',') === vertices
      && candidate.edges.map(e => [e.source,e.target].sort().join('~')).sort().join(',') === edges;
  });
  return index >= 0 ? String(index) : 'custom';
}
function useSavedGraph() {
  const [graph,setGraph] = useState<Graph>(() => {
    try { const saved = localStorage.getItem('graphlab-graph-v1'); if(saved) return safeGraph(JSON.parse(saved)); } catch { /* corrupted saved state falls back to a known graph */ }
    return makePresetGraph(presetList[0]);
  });
  useEffect(() => { try { localStorage.setItem('graphlab-graph-v1', JSON.stringify(graph)); } catch { /* storage may be unavailable */ } }, [graph]);
  return [graph,setGraph] as const;
}
function getPresetValue(p: any, keys: string[], fallback?: any) {
  for (const key of keys) if (p?.[key] !== undefined) return p[key];
  return fallback;
}

function App() {
  const [location] = useLocation();
  const [dark,setDark] = useState(() => localStorage.getItem('graphlab-theme-v2') !== 'light');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('graphlab-theme-v2', dark ? 'dark' : 'light'); },[dark]);
  const [graph,setGraph] = useSavedGraph();
  const [selected,setSelected] = useState<string[]>([]);
  const [mode,setMode] = useState<'select'|'edge'>('select');
  const [activeColor,setActiveColor] = useState(0);
  const [algorithm,setAlgorithm] = useState<'greedy'|'welsh'|'backtracking'>('greedy');
  const [run,setRun] = useState<Run|null>(null);
  const [stepIndex,setStepIndex] = useState(-1);
  const [playing,setPlaying] = useState(false);
  const [speed,setSpeed] = useState(2);
  const [backtrackingLimit,setBacktrackingLimit] = useState(3);
  const [zoom,setZoom] = useState(1);
  const [pan,setPan] = useState({x:0,y:0});
  const [notice,setNotice] = useState('');
  const [presetIndex,setPresetIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('graphlab-graph-v1');
      if (saved) return identifyPreset(safeGraph(JSON.parse(saved)));
      return localStorage.getItem('graphlab-preset-v1') ?? '0';
    } catch { return 'custom'; }
  });
  const [history,setHistory] = useState<Graph[]>([]);
  const [future,setFuture] = useState<Graph[]>([]);
  const [challenge,setChallenge] = useState(false);
  const [help,setHelp] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string|null>(null);
  const dragOrigin = useRef<Graph|null>(null);
  const dragMoved = useRef(false);
  const panStart = useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const [challengeStart,setChallengeStart] = useState<number|null>(null);
  const [smallScreen,setSmallScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 520);
  useEffect(() => {
    const resize = () => setSmallScreen(window.innerWidth <= 520);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  },[]);
  useEffect(() => { localStorage.setItem('graphlab-preset-v1', presetIndex); },[presetIndex]);

  const saveGraph = useCallback((next: Graph) => {
    setHistory(h => [...h.slice(-29), graph]); setFuture([]); setGraph(safeGraph(next)); setRun(null); setStepIndex(-1); setPlaying(false);
  },[graph,setGraph]);
  const markCustomStructure = () => { setPresetIndex('custom'); setChallenge(false); setChallengeStart(null); };
  const conflicts = useMemo(() => {
    try { const c = utility.getConflicts(graph); return Array.isArray(c) ? c : []; } catch { return []; }
  },[graph]);
  const stats = useMemo(() => {
    try { return utility.getGraphStats(graph) || {}; } catch { return {}; }
  },[graph]);
  const manualValid = useMemo(() => {
    try { return !!utility.isValidColoring(graph, Object.fromEntries(graph.vertices.map(v=>[v.id,v.color]))); } catch { return false; }
  },[graph]);
  const currentStep = run?.steps?.[stepIndex] ?? null;
  const visibleColors = currentStep?.colors ?? null;
  const preset = presetIndex !== 'custom' ? presetList[Number(presetIndex)] : null;
  const knownChromatic = Number(getPresetValue(preset, ['chromaticNumber','chromatic','knownChromaticNumber'], NaN));

  useEffect(() => {
    if (!playing || !run) return;
    const interval = window.setInterval(() => setStepIndex(i => {
      if (i >= run.steps.length - 1) { setPlaying(false); return i; }
      return i + 1;
    }), Math.max(160, 1100 - speed * 230));
    return () => window.clearInterval(interval);
  },[playing,run,speed]);
  useEffect(() => {
    if (run && stepIndex >= 0 && run.steps[stepIndex]) {
      const colors = run.steps[stepIndex].colors;
      setGraph(g => ({...g,vertices:g.vertices.map(v => ({...v,color:colors[v.id] ?? null}))}));
    }
  },[stepIndex,run,setGraph]);

  const svgPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (matrix) {
      const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
      return {x:(point.x-pan.x-450)/zoom+450,y:(point.y-pan.y-270)/zoom+270};
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return {x:0,y:0};
    const rawX = (event.clientX-rect.left)/rect.width*900;
    const rawY = (event.clientY-rect.top)/rect.height*540;
    return {x:(rawX-pan.x-450)/zoom+450,y:(rawY-pan.y-270)/zoom+270};
  };
  const onNodePointerDown = (event: React.PointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    if (mode === 'edge') { chooseVertex(id); return; }
    if (!selected.includes(id) || selected.length > 1) setSelected([id]);
    dragId.current = id;
    dragOrigin.current = graph;
    dragMoved.current = false;
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
  };
  const chooseVertex = (id: string) => {
    if(selected.includes(id)) { setSelected(selected.filter(i=>i!==id)); return; }
    const next=[...selected,id];
    if(next.length===2) {
      const [source,target]=next;
      if(source!==target&&!graph.edges.some(e=>(e.source===source&&e.target===target)||(e.source===target&&e.target===source))) {
        try { saveGraph(utility.addEdge(graph,source,target)); } catch { saveGraph({...graph,edges:[...graph.edges,{source,target}]}); }
        markCustomStructure();
        setNotice('Connection added.');window.setTimeout(()=>setNotice(''),1800);
      } else {setNotice('Those vertices are already connected.');window.setTimeout(()=>setNotice(''),1800);}
      setSelected([]);
    } else setSelected(next);
  };
  const onCanvasPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(event);
    if(dragId.current) {
      const id=dragId.current;
      setGraph(g=>{
        const current = g.vertices.find(v=>v.id===id);
        if(!current)return g;
        const x=Math.max(32,Math.min(868,p.x)),y=Math.max(32,Math.min(508,p.y));
        if(Math.abs(current.x-x)<.5&&Math.abs(current.y-y)<.5)return g;
        dragMoved.current=true;
        return {...g,vertices:g.vertices.map(v=>v.id===id?{...v,x,y}:v)};
      });
    } else if(panStart.current && event.buttons===1) {
      setPan({x:panStart.current.px + (event.clientX-panStart.current.x),y:panStart.current.py + (event.clientY-panStart.current.y)});
    }
  };
  const onCanvasPointerUp = () => {
    if(dragMoved.current&&dragOrigin.current) {
      setHistory(h=>[...h.slice(-29),dragOrigin.current as Graph]);
      setFuture([]);
    }
    dragId.current=null;dragOrigin.current=null;dragMoved.current=false;panStart.current=null;
  };
  const addNode = () => {
    markCustomStructure();
    let position = { x: 450, y: 270 };
    let bestSpacing = -1;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const candidate = { x: 48 + Math.random() * 804, y: 48 + Math.random() * 444 };
      const nearest = graph.vertices.length
        ? Math.min(...graph.vertices.map(v => Math.hypot(v.x - candidate.x, v.y - candidate.y)))
        : Infinity;
      if (nearest > bestSpacing) { position = candidate; bestSpacing = nearest; }
    }
    try {
      saveGraph(utility.createVertex(graph, position.x, position.y));
    } catch {
      const id=`v${graph.vertices.length+1}`;
      saveGraph({...graph,vertices:[...graph.vertices,{id,label:id.toUpperCase(),x:450,y:270,color:null}]});
    }
  };
  const removeSelected = () => {
    if(!selected.length) return;
    markCustomStructure();
    let next=graph;
    for(const id of selected) { try { next=utility.deleteVertex(next,id); } catch { next={...next,vertices:next.vertices.filter(v=>v.id!==id),edges:next.edges.filter(e=>e.source!==id&&e.target!==id)}; } }
    saveGraph(next);setSelected([]);
  };
  const removeEdge = (edge: Edge) => {
    markCustomStructure();
    const index=graph.edges.findIndex(e=>(e.source===edge.source&&e.target===edge.target)||(e.source===edge.target&&e.target===edge.source));
    try { saveGraph(utility.deleteEdge(graph,index)); } catch { saveGraph({...graph,edges:graph.edges.filter((_,i)=>i!==index)}); }
  };
  const addRandomGraph = () => {
    const n=6+Math.floor(Math.random()*4);
    const vertices=Array.from({length:n},(_,i)=>({id:`v${i+1}`,label:String.fromCharCode(65+i),x:450+180*Math.cos(i*2*Math.PI/n),y:270+170*Math.sin(i*2*Math.PI/n),color:null}));
    const edges: Edge[]=[];
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(Math.random()<.31) edges.push({source:vertices[i].id,target:vertices[j].id});
    saveGraph({vertices,edges});setSelected([]);markCustomStructure();
  };
  const assignColor = (id:string,index:number|null) => {
    saveGraph({...graph,vertices:graph.vertices.map(v=>v.id===id?{...v,color:index}:v)});
  };
  const runAlgorithm = () => {
    if(!graph.vertices.length){setNotice('Add vertices before running an algorithm.');return;}
    const fn=algorithm==='greedy'?utility.greedyColoring:algorithm==='welsh'?utility.welshPowellColoring:(g:Graph)=>utility.backtrackingColoring(g,backtrackingLimit);
    try {
      const result=fn(graph) as Run;
      if(!result || !Array.isArray(result.steps)) throw new Error('Algorithm returned no trace.');
      setGraph(g=>({...g,vertices:g.vertices.map(v=>({...v,color:null}))}));
      setRun(result);setStepIndex(-1);setPlaying(false);setNotice(result.message || 'Algorithm ready.');window.setTimeout(()=>setNotice(''),2400);
    } catch { setNotice('This algorithm could not process the current graph. Check that the graph is not empty.'); }
  };
  const resetRun = () => {setPlaying(false);setRun(null);setStepIndex(-1);setGraph(g=>({...g,vertices:g.vertices.map(v=>({...v,color:null}))}));};
  const pickPreset = (value:string) => {
    setPresetIndex(value);
    if(value==='custom'){setChallenge(false);setChallengeStart(null);return;}
    const next=makePresetGraph(presetList[Number(value)]);
    if(next.vertices.length) {saveGraph(next);setSelected([]);setChallenge(false);setBacktrackingLimit(Number(presetList[Number(value)]?.chromaticNumber ?? next.vertices.length));}
    else setNotice('Preset data is unavailable. Try another graph.');
  };
  const undo = () => { if(!history.length)return; const prev=history[history.length-1];setFuture(f=>[graph,...f]);setHistory(h=>h.slice(0,-1));setGraph(prev);setRun(null);setStepIndex(-1);markCustomStructure(); };
  const redo = () => { if(!future.length)return;const next=future[0];setHistory(h=>[...h,graph]);setFuture(f=>f.slice(1));setGraph(next);setRun(null);setStepIndex(-1);markCustomStructure(); };
  const clearGraph = () => { if(window.confirm('Clear the current graph? This cannot be undone after leaving the page.')) {saveGraph({vertices:[],edges:[]});setSelected([]);markCustomStructure();} };
  const exportGraph = () => {
    const blob=new Blob([JSON.stringify(graph,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='graphlab-graph.json';a.click();URL.revokeObjectURL(url);
  };
  const startChallenge = () => {
    if(!Number.isFinite(knownChromatic)){setNotice('Choose a preset with a verified chromatic number to start a scored challenge.');return;}
    setChallenge(true);setChallengeStart(Date.now());setRun(null);setStepIndex(-1);setGraph(g=>({...g,vertices:g.vertices.map(v=>({...v,color:null}))}));setNotice(`Challenge: color every vertex with at most ${knownChromatic} colors.`);window.setTimeout(()=>setNotice(''),3000);
  };
  const challengeComplete = challenge && manualValid && new Set(graph.vertices.map(v=>v.color).filter(v=>v!==null)).size===knownChromatic;
  const pageTitle = location==='/algorithms'?'Algorithms':location==='/learn'?'Field guide':location==='/about'?'About GraphLab':'Graph coloring lab';

  return <div className="app-shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="GraphLab home"><span className="brand-mark"><FlaskConical size={18}/></span><span><span className="brand-name">GraphLab</span><span className="brand-sub">Graph Coloring Simulator</span></span></Link>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/" className={location==='/'?'active':''}>Simulator</Link><Link href="/algorithms" className={location==='/algorithms'?'active':''}>Algorithms</Link><Link href="/learn" className={location==='/learn'?'active':''}>Learn</Link><Link href="/about" className={location==='/about'?'active':''}>About</Link>
      </nav>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><button className="icon-button" onClick={resetRun} aria-label="Reset coloring and algorithm" title="Reset coloring"><RotateCcw size={15}/></button><button className="icon-button" onClick={()=>setHelp(true)} aria-label="Open help" title="Help"><CircleHelp size={16}/></button><button className="icon-button" onClick={()=>setDark(v=>!v)} aria-label={dark?'Use light theme':'Use dark theme'} title="Toggle theme">{dark?<Sun size={16}/>:<Moon size={16}/>}</button></div>
    </header>
    <main className="content">
      {location==='/'?<><div className="page-heading"><div><div className="eyebrow">Interactive graph theory</div><h1>{pageTitle}</h1><p>Build a graph. Choose an order. See what the coloring reveals.</p></div><div className="heading-note">EXPERIMENT 01&nbsp; / &nbsp;COLORING</div></div>
        <div className="sim-layout">
          <section className="panel canvas-panel" aria-label="Graph editor">
            <div className="canvas-toolbar">
              <div className="tool-group">
                <button className={`tool-button ${mode==='select'?'selected':''}`} onClick={()=>setMode('select')} aria-label="Select and move vertices"><MousePointer2 size={15}/> Select</button>
                <button className={`tool-button ${mode==='edge'?'selected':''}`} onClick={()=>{setMode('edge');setSelected([]);}} aria-label="Add edge by selecting two vertices"><GitBranch size={15}/> Add edge</button>
                <button className="tool-button" onClick={addNode} aria-label="Add vertex"><Plus size={15}/> Vertex</button>
                <button className="tool-button" onClick={addRandomGraph} aria-label="Generate random graph"><Shuffle size={14}/> Random</button>
              </div>
              <div className="editor-actions">
                <button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Undo" title="Undo"><RotateCcw size={14}/></button>
                <button className="icon-button" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo"><RotateCw size={14}/></button>
                <button className="icon-button" onClick={exportGraph} aria-label="Export graph as JSON" title="Export JSON"><Download size={14}/></button>
                <button className="icon-button" onClick={clearGraph} aria-label="Clear graph" title="Clear graph"><Trash2 size={14}/></button>
              </div>
            </div>
            <div className="canvas-wrap">
              {graph.vertices.length===0 ? <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',textAlign:'center',padding:25}}><div><div style={{margin:'auto auto 12px',width:44,height:44,borderRadius:14,background:'hsl(var(--muted))',display:'grid',placeItems:'center',color:'hsl(var(--primary))'}}><GitBranch size={20}/></div><strong style={{fontFamily:'var(--app-font-serif)'}}>A graph starts with vertices</strong><p style={{fontSize:12,color:'hsl(var(--muted-foreground))'}}>Choose a preset, add a vertex, or generate a random graph.</p><button className="tool-button primary" style={{margin:'auto'}} onClick={addNode}><Plus size={14}/> Add first vertex</button></div></div> :
               <svg ref={svgRef} className="graph-svg" viewBox="0 0 900 540" role="group" aria-label="Editable graph canvas" onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerLeave={onCanvasPointerUp} onPointerDown={e=>{if(e.target===svgRef.current){if(e.shiftKey) panStart.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};else setSelected([]);}}} onWheel={e=>{setZoom(z=>Math.max(.65,Math.min(1.8,z+(e.deltaY<0?.08:-.08))));}}>
                <g transform={`translate(${pan.x} ${pan.y}) translate(450 270) scale(${zoom}) translate(-450 -270)`}>
                  {graph.edges.map((edge,i)=>{const a=graph.vertices.find(v=>v.id===edge.source),b=graph.vertices.find(v=>v.id===edge.target);if(!a||!b)return null;const conflict=conflicts.some((c:any)=>String(c.source??c[0]??c.vertices?.[0])===edge.source&&String(c.target??c[1]??c.vertices?.[1])===edge.target)||conflicts.some((c:any)=>String(c.source??c[0]??c.vertices?.[0])===edge.target&&String(c.target??c[1]??c.vertices?.[1])===edge.source);
                    return <g key={`${edge.source}-${edge.target}-${i}`}><line className={`edge-line ${conflict?'conflict':''} ${currentStep?.neighbors?.includes(edge.source)||currentStep?.neighbors?.includes(edge.target)?'highlight':''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="16" onDoubleClick={()=>removeEdge(edge)} onKeyDown={e=>{if(e.key==='Delete'||e.key==='Backspace'||e.key==='Enter'){e.preventDefault();removeEdge(edge);}}} tabIndex={0} style={{cursor:'pointer'}} aria-label={`Delete edge ${a.label} to ${b.label}`} role="button"/></g>})}
                  {graph.vertices.map(v=>{const color=visibleColors?.[v.id] ?? v.color;const current=currentStep?.currentVertex===v.id;const neighbor=currentStep?.neighbors?.includes(v.id);return <g key={v.id} className={`node-group ${selected.includes(v.id)?'selected':''} ${current?'current':''} ${neighbor?'neighbor':''}`} transform={`translate(${v.x} ${v.y})`} onPointerDown={e=>onNodePointerDown(e,v.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mode==='edge'?chooseVertex(v.id):setSelected([v.id]);}if(e.key==='Delete'||e.key==='Backspace'){setSelected([v.id]);}}} tabIndex={0} role="button" aria-label={`Vertex ${v.label}, ${color===null?'uncolored':`color ${color+1}`}. Select to color or move.`} data-testid={`vertex-${v.id}`}>
                    <circle r={smallScreen?34:22} fill={color===null?'#7f8c8a':palette[color%palette.length]} className="node-circle"/>
                    <text className="node-label" y="1" style={smallScreen?{fontSize:28}:undefined}>{v.label}</text>
                    {selected.includes(v.id)&&<circle r={smallScreen?42:28} fill="none" stroke="hsl(var(--primary))" strokeDasharray="3 4" strokeWidth="1.5"/>}
                    </g>})}
                </g>
              </svg>}
              <div className="canvas-hint"><Move size={13}/>{mode==='edge'?'Select two vertices to connect':selected.length?'Select a color to assign':'Drag vertices · double-click an edge to remove'}</div>
              <div className="zoom-controls"><button onClick={()=>setZoom(z=>Math.min(1.8,z+.12))} aria-label="Zoom in"><ZoomIn size={15}/></button><button onClick={()=>setZoom(z=>Math.max(.65,z-.12))} aria-label="Zoom out"><ZoomOut size={15}/></button><button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} aria-label="Reset zoom"><span style={{font:'10px var(--app-font-mono)'}}>{Math.round(zoom*100)}%</span></button></div>
            </div>
            <div className="canvas-footer"><span>{graph.vertices.length} vertices &nbsp;·&nbsp; {graph.edges.length} edges{Number.isFinite(Number((stats as any).density))?` · density ${Number((stats as any).density).toFixed(2)}`:''}</span><span>SHIFT + DRAG TO PAN &nbsp;·&nbsp; SCROLL TO ZOOM</span></div>
          </section>
          <aside className="sidebar-stack">
      <section className="panel side-panel"><h2 className="section-title">Graph specimen <small>01 / INPUT</small></h2>
              <select className="select-control" aria-label="Choose a graph preset" value={presetIndex} onChange={e=>pickPreset(e.target.value)}><option value="custom">Custom graph</option>{presetList.map((p:any,i)=><option key={p.id??p.name??i} value={String(i)}>{getPresetValue(p,['label','name','title'],`Preset ${i+1}`)}</option>)}</select>
               <p className="preset-copy">{preset?getPresetValue(preset,['description','summary'],'A prepared graph for exploring structure and coloring.'):'Edit the canvas directly, or start with a specimen graph.'}</p>
               {preset&&<p className="preset-properties">{preset.expectedProperties}</p>}
              {preset&&Number.isFinite(knownChromatic)&&<div className="challenge-box"><strong>Verified chromatic number: χ(G) = {knownChromatic}</strong><p>Use this specimen to test whether your manual coloring can reach the known minimum.</p></div>}
            </section>
            <section className="panel side-panel"><h2 className="section-title">Run an algorithm <small>02 / METHOD</small></h2>
              <div className="algorithm-tabs" role="tablist" aria-label="Coloring algorithm">
                <button className={algorithm==='greedy'?'active':''} onClick={()=>setAlgorithm('greedy')}>Greedy</button><button className={algorithm==='welsh'?'active':''} onClick={()=>setAlgorithm('welsh')}>Welsh–Powell</button><button className={algorithm==='backtracking'?'active':''} onClick={()=>setAlgorithm('backtracking')}>Backtracking</button>
              </div>
              <div className="control-row"><button className="tool-button primary" onClick={runAlgorithm}><Play size={14}/> Run</button><button className="tool-button" onClick={()=>setPlaying(v=>!v)} disabled={!run}>{playing?<Square size={13}/>:<Play size={13}/>} {playing?'Pause':'Resume'}</button><button className="tool-button" onClick={()=>{if(run)setStepIndex(i=>Math.min(run.steps.length-1,i+1));}} disabled={!run}><SkipForward size={14}/> Step</button></div>
              {algorithm==='backtracking'&&<label className="limit-control">Maximum colors<input type="number" min="1" max={Math.max(1,graph.vertices.length)} value={backtrackingLimit} onChange={e=>setBacktrackingLimit(Math.max(1,Number(e.target.value)||1))} aria-label="Backtracking color limit"/></label>}
              <div className="speed-row"><span>PACE</span><input type="range" min="0" max="4" value={speed} onChange={e=>setSpeed(Number(e.target.value))} aria-label="Animation speed"/><span>{['slow','1×','2×','3×','fast'][speed]}</span></div>
              {run&&<><div className="progress-track"><div className="progress-fill" style={{width:`${Math.max(0,(stepIndex+1)/Math.max(1,run.steps.length)*100)}%`}}/></div><p className="step-copy" aria-live="polite">{currentStep?.description||'Ready to step through the algorithm.'}</p><div className="control-row"><button className="tool-button" onClick={resetRun}><RotateCcw size={13}/> Reset</button><span style={{font:'10px var(--app-font-mono)',alignSelf:'center',color:'hsl(var(--muted-foreground))'}}>{Math.max(0,stepIndex+1)} / {run.steps.length} steps</span></div></>}
            </section>
            <section className="panel side-panel"><h2 className="section-title">Readout <small>LIVE</small></h2>
              <div className="stat-row"><div className="stat-cell"><strong>{graph.vertices.length}</strong><span>Vertices</span></div><div className="stat-cell"><strong>{graph.edges.length}</strong><span>Edges</span></div><div className="stat-cell"><strong>{run?run.colorsUsed:new Set(graph.vertices.map(v=>v.color).filter(v=>v!==null)).size}</strong><span>Colors</span></div></div>
              <div className={`status-line ${conflicts.length?'warning':''}`}><span className="status-dot"/><span>{conflicts.length?`${conflicts.length} coloring conflict${conflicts.length===1?'':'s'} found`:manualValid&&graph.vertices.length?'Valid proper coloring · no conflicts':graph.vertices.length?'Incomplete coloring · color every vertex to verify it':'Empty graph · no vertices to color'}</span></div>
              {run&&<div style={{display:'flex',justifyContent:'space-between',marginTop:10,font:'10px var(--app-font-mono)',color:'hsl(var(--muted-foreground))'}}><span>{run.solved?'SOLVED':'RUN COMPLETE'} · {run.valid?'VALID':'INVALID'}</span><span>{Number(run.executionMs).toFixed(2)} ms</span></div>}
              {conflicts.length>0&&<ul className="conflict-list">{conflicts.slice(0,4).map((c:any,i)=><li key={i}>Adjacent vertices {String(c.source??c[0]??'?')} and {String(c.target??c[1]??'?')} share a color.</li>)}</ul>}
              <p className="rule-note">A proper coloring gives every connected pair of vertices different colors. Click a vertex, then choose a swatch below.</p>
            </section>
            <section className="panel side-panel"><h2 className="section-title">Manual bench <small>03 / EXPLORE</small></h2>
              <div className="palette" aria-label="Choose a color">{palette.map((c,i)=><button key={c} className={`swatch ${activeColor===i?'active':''}`} style={{background:c}} onClick={()=>{setActiveColor(i);if(selected.length===1)assignColor(selected[0],i);}} aria-label={`Choose color ${i+1}`} title={`Color ${i+1}`}/>)}</div>
              <div className="control-row"><button className="tool-button" onClick={()=>{if(selected.length===1)assignColor(selected[0],null);}} disabled={selected.length!==1}><Minus size={13}/> Uncolor</button><button className="tool-button danger" onClick={removeSelected} disabled={!selected.length}><Trash2 size={13}/> Delete selected</button></div>
              <button className="tool-button button-wide" onClick={startChallenge}><Check size={14}/> {challenge?'Restart challenge':'Start minimum-color challenge'}</button>
              {challenge&&<div className="status-line" style={{marginTop:9}}><span className="status-dot"/><span>{challengeComplete?`Challenge complete · ${Math.max(0,Math.round(((Date.now()-(challengeStart||Date.now()))/1000)))} seconds`:`Target: ${Number.isFinite(knownChromatic)?knownChromatic:'—'} colors · ${new Set(graph.vertices.map(v=>v.color).filter(v=>v!==null)).size} used`}</span></div>}
            </section>
          </aside>
        </div>
        {notice&&<div role="status" style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:20,background:'hsl(var(--foreground))',color:'hsl(var(--background))',padding:'10px 16px',borderRadius:9,fontSize:12,boxShadow:'0 8px 28px #0002'}}>{notice}</div>}
        <div className="footer-mini">Graph coloring is a model. Your ordering is part of the experiment.</div>
      </>:location==='/algorithms'?<AlgorithmsPage/>:location==='/learn'?<LearnPage/>:location==='/about'?<AboutPage/>:<div className="not-found"><div className="eyebrow" style={{justifyContent:'center'}}>404 / specimen not found</div><h1>That page isn’t in the lab.</h1><Link href="/" className="tool-button primary" style={{display:'inline-flex',textDecoration:'none'}}>Return to simulator</Link></div>}
    </main>
    {help&&<div role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={()=>setHelp(false)} style={{position:'fixed',inset:0,zIndex:30,background:'#15201d88',display:'grid',placeItems:'center',padding:16}}><div className="panel" onClick={e=>e.stopPropagation()} style={{maxWidth:470,padding:24}}><div className="eyebrow">Quick start</div><h2 id="help-title" style={{font:'700 24px var(--app-font-serif)',margin:'10px 0'}}>Your graph, your rules</h2><p style={{fontSize:12,lineHeight:1.7,color:'hsl(var(--muted-foreground))'}}>Choose a specimen or add vertices. Drag nodes to rearrange them. Use Add edge, then select two vertices. Click a vertex and choose a color to color it manually. Adjacent vertices must differ for a proper coloring. Run the algorithms to inspect their decisions one step at a time.</p><button className="tool-button primary" onClick={()=>setHelp(false)} style={{marginTop:8}}>Got it</button></div></div>}
  </div>;
}

function AlgorithmsPage() {
  const [comparison,setComparison]=useState<{name:string;colors:number;time:number;valid:boolean}[]>([]);
  const [error,setError]=useState('');
  const [sample,setSample]=useState<Graph>(()=>makePresetGraph(presetList[0]));
  const [sampleIndex,setSampleIndex]=useState('0');
  const compare=()=>{
    setError('');
    if(!sample.vertices.length){setError('The selected specimen has no vertices to compare.');setComparison([]);return;}
    const list=[['Greedy',utility.greedyColoring],['Welsh–Powell',utility.welshPowellColoring],['Backtracking',(g:Graph)=>utility.backtrackingColoring(g,utility.greedyColoring(g).colorsUsed)]] as [string,(g:Graph)=>Run][];
    try {
      const results=list.map(([name,fn])=>{const started=performance.now();const r=fn(sample);return {name,colors:r.colorsUsed,time:Number(r.executionMs)||performance.now()-started,valid:!!r.valid};});
      setComparison(results);
    } catch {setError('Comparison failed on this specimen. Select another graph and try again.');}
  };
  return <div className="page-prose"><div className="prose-hero"><div className="eyebrow">Methods / 03 working algorithms</div><h1>Three ways to<br/>color a graph.</h1><p>Each method makes a different tradeoff between speed, simplicity, and search. The same graph can produce different outcomes depending on the strategy.</p></div>
    <div className="article-grid">
      <article className="article-card"><span className="article-index">01 / CONSTRUCTIVE</span><h2>Greedy coloring</h2><p>Process vertices in their current order. Assign each vertex the smallest-numbered color not used by an already-colored neighbor. It is fast and easy to follow, but the outcome can depend strongly on vertex order. Its color count is not a proof of optimality.</p><pre className="pseudo">{`for v in the chosen vertex order:\n  forbidden = colors of colored neighbors of v\n  color[v] = smallest nonnegative color not in forbidden`}</pre><div className="complexity">Time: O(V + E) with adjacency lists · Space: O(V)</div></article>
      <article className="article-card"><span className="article-index">02 / DEGREE-ORDERED</span><h2>Welsh–Powell</h2><p>Sort vertices by decreasing degree, then color them using the greedy rule. High-degree vertices receive attention early, often reducing color waste. This is still a heuristic: degree order can improve a coloring without guaranteeing the minimum.</p><pre className="pseudo">{`order vertices by decreasing degree\nwhile uncolored vertices remain:\n  for v in order:\n    if v has no neighbor in this color group:\n      add v to the group`}</pre><div className="complexity">Worst case: O(V² + V·E), plus degree sorting</div></article>
      <article className="article-card"><span className="article-index">03 / SEARCH</span><h2>Backtracking</h2><p>Explore color assignments systematically. When a choice creates a conflict, undo it and try another. Search can establish a solution within a fixed color limit, or prove no such assignment exists.</p><pre className="pseudo">{`search(i):\n  if every vertex is assigned: succeed\n  for each allowed color c:\n    if no colored neighbor uses c:\n      assign c; if search(i + 1): succeed\n      remove the assignment  // backtrack\n  fail`}</pre><div className="complexity">Worst case: O(k^V · (V + E)) for a k-color limit</div></article>
      <article className="article-card"><span className="article-index">THE QUESTION</span><h2>What should you compare?</h2><p>Look at the colors used and the time taken, but also inspect the trace. A faster heuristic may use more colors; an exact search may take longer to prove that fewer are possible.</p></article>
    </div>
    <section className="article-card" style={{marginTop:16}}><div className="eyebrow">Run an experiment</div><h2>Compare on one specimen</h2><p>All three algorithms operate on the same preset graph. Results below come from the graph-coloring utilities—not illustrative estimates.</p>
       <div style={{display:'flex',gap:9,marginTop:14,flexWrap:'wrap'}}><select className="select-control" style={{maxWidth:300}} value={sampleIndex} onChange={e=>{setSampleIndex(e.target.value);setSample(makePresetGraph(presetList[Number(e.target.value)]));setComparison([]);}} aria-label="Comparison graph">{presetList.map((p:any,i)=><option key={i} value={String(i)}>{getPresetValue(p,['name','label','title'],`Preset ${i+1}`)}</option>)}</select><button className="tool-button primary" onClick={compare}><Activity size={14}/> Compare algorithms</button></div>
       <p className="preset-copy">For comparison, Backtracking uses the Greedy result as its fixed color limit. It may improve that result, but does not claim a minimum unless smaller limits are also ruled out.</p>
      {error&&<p role="alert" style={{color:'hsl(var(--destructive))',fontSize:12}}>{error}</p>}
      {comparison.length>0?<table className="compare-table"><thead><tr><th>Algorithm</th><th>Colors used</th><th>Execution time</th><th>Valid</th></tr></thead><tbody>{comparison.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.colors}</td><td>{r.time.toFixed(3)} ms</td><td>{r.valid?'Yes':'No'}</td></tr>)}</tbody></table>:<div className="info-strip">Run the comparison to populate measured color counts and execution times for this specimen.</div>}
    </section>
  </div>;
}

function LearnPage() {
  const topics=[
    ['01','Graph','A graph G = (V, E) consists of vertices V and edges E. Vertices represent objects; an edge records a relationship between a pair. In this lab, edges are undirected and there are no self-loops.'],
    ['02','Proper coloring','A vertex coloring assigns a color to every vertex. It is proper exactly when the endpoints of every edge have different colors. Non-adjacent vertices may share a color.'],
    ['03','Chromatic number','The chromatic number χ(G) is the smallest number of colors that can produce a proper coloring of G. Finding it is computationally difficult for general graphs. A heuristic’s color count is not automatically the chromatic number.'],
    ['04','Greedy coloring','Visit vertices in an order and give each one the lowest available color. It never creates a conflict when implemented correctly, but its result can change with the order.'],
    ['05','Welsh–Powell','Order vertices by decreasing degree before applying a greedy strategy. Degree counts how many neighbors a vertex has; treating high-degree vertices first can make the heuristic more effective.'],
    ['06','Backtracking','Try assignments recursively and back up when a choice blocks progress. Backtracking can search for a smaller coloring, but exploring many branches may cost substantial time.'],
    ['07','Applications','Coloring models resource conflicts: exam schedules where students share classes, map regions that share borders, radio frequencies for interfering transmitters, and register allocation in a compiler.']
  ];
  return <div className="page-prose"><div className="prose-hero"><div className="eyebrow">Learn / graph theory</div><h1>Learn to see<br/>the structure.</h1><p>Graph coloring turns relationships into a constraint. Work through the vocabulary, then test the ideas on the simulator.</p></div>
    <div className="article-grid learn-examples">
      <article className="article-card"><span className="article-index">A TWO-COLOR EXAMPLE</span><h2>Color a path without conflicts</h2><p>Each edge connects unlike colors. Vertices that are not adjacent may reuse a color.</p>
        <svg className="learn-diagram" viewBox="0 0 420 112" role="img" aria-labelledby="path-title path-description"><title id="path-title">Proper two-coloring of a four-vertex path</title><desc id="path-description">A path A to B to C to D, colored teal, violet, teal, violet.</desc><path d="M55 52H365" stroke="hsl(var(--muted-foreground))" strokeOpacity=".55" strokeWidth="2"/>{[['A',55,'#42c7bb'],['B',158,'#a78bfa'],['C',262,'#42c7bb'],['D',365,'#a78bfa']].map(([label,x,color])=><g key={String(label)}><circle cx={Number(x)} cy="52" r="24" fill={String(color)}/><text x={Number(x)} y="57" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{String(label)}</text></g>)}</svg>
        <div className="example-note">A and C share a color because they are not connected. B and D can share the other color.</div>
      </article>
      <article className="article-card"><span className="article-index">A GREEDY TRACE</span><h2>Why a triangle needs three</h2><ol className="trace-list"><li><strong>A</strong> takes color 1; no neighbor is colored yet.</li><li><strong>B</strong> cannot use color 1 because it touches A, so it takes color 2.</li><li><strong>C</strong> touches both A and B, so colors 1 and 2 are blocked. It takes color 3.</li></ol><div className="complexity">The triangle is K₃, so χ(G) = 3.</div></article>
    </div>
    <article className="article-card learn-pseudocode"><span className="article-index">GREEDY / PSEUDOCODE</span><h2>Make the smallest safe choice</h2><pre className="pseudo">{`for each vertex v in order:\n  unavailable = { color[u] for u adjacent to v if u is colored }\n  color[v] = the smallest color not in unavailable`}</pre></article>
    <div style={{display:'grid',gap:10}}>{topics.map(([n,title,body])=><article className="article-card" key={n} style={{display:'grid',gridTemplateColumns:'74px 1fr',gap:8}}><span className="article-index">{n} / NOTE</span><div><h2 style={{marginTop:0}}>{title}</h2><p>{body}</p></div></article>)}</div>
    <div className="info-strip"><strong>Keep the distinction clear:</strong> a proper coloring is valid; a minimum coloring is valid and uses exactly χ(G) colors. A successful greedy run establishes the former, not necessarily the latter.</div>
    <Link href="/" className="tool-button primary" style={{display:'inline-flex',textDecoration:'none',marginTop:8}}>Open the simulator <ArrowDownUp size={14}/></Link>
  </div>;
}

function AboutPage() {
  return <div className="page-prose"><div className="prose-hero"><div className="eyebrow">About this project</div><h1>A small lab<br/>for a big idea.</h1><p>GraphLab is a client-side learning tool for exploring vertex coloring through direct manipulation and algorithm traces.</p></div>
    <div className="article-grid"><article className="article-card"><span className="article-index">PURPOSE</span><h2>Learn by changing the order</h2><p>Move vertices, alter the edges, and compare strategies on the same structure. The goal is to make a mathematical constraint visible and testable.</p></article><article className="article-card"><span className="article-index">IN THE BROWSER</span><h2>Your work stays local</h2><p>The current graph is saved in this browser. You can export it as JSON; no account or remote service is required for the simulator.</p></article></div>
    <div className="info-strip"><strong>Learning note:</strong> GraphLab is an educational demonstration. Runtime and heuristic results depend on graph size and structure; only known, verified preset values are presented as chromatic numbers.</div>
  </div>;
}

export default App;
