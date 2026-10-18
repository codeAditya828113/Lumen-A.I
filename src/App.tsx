import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, History, FileText, BarChart3, Link as LinkIcon, 
  ShieldAlert, BookOpen, Download, User as UserIcon,
  LogOut, Sparkles, ChevronRight, ChevronLeft, MessageSquare, Plus, Layers, Box as BoxIcon,
  X, Copy, Check, ExternalLink, Settings, Bot, Cpu, Sun, Moon, Sliders, CheckCircle2, Activity,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, signInAnon, sanitizeFirestoreData, firebaseConfigError } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db } from './lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ResearchPaper, OperationType, AgentProgressUpdate, AgentSettings } from './types';
import { conductResearch, summarizeMedia, checkPlagiarism, handleFirestoreError } from './services/gemini';
import { GlassCard } from './components/ui/GlassCard';
import { ConceptModelViewer, PREDEFINED_MODELS } from './components/ui/ConceptModelViewer';
import { exportToPDF, exportToDOCX, exportToLaTeX } from './lib/export';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';
import { IntroScreen } from './components/ui/IntroScreen';
import { InteractiveBackground } from './components/ui/InteractiveBackground';
import { Scroll3DButton } from './components/ui/Scroll3DButton';
import { Scroll3DSection } from './components/ui/Scroll3DSection';
import { HighlightedPlagiarismText } from './components/ui/HighlightedPlagiarismText';
import { CitationWeb } from './components/ui/CitationWeb';
import { AgentExecutionPanel } from './components/ui/AgentExecutionPanel';
import { AgentSettingsModal } from './components/ui/AgentSettingsModal';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Canvas, useFrame } from '@react-three/fiber';

const Processing3DVisual = ({ colorHex }: { colorHex: string }) => {
  const meshRef = React.useRef<any>(null);
  const ringRef = React.useRef<any>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5;
      meshRef.current.rotation.x += delta * 0.5;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 1;
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
    }
  });

  return (
    <group>
      {/* Center Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial 
          color={colorHex} 
          wireframe={true} 
          emissive={colorHex}
          emissiveIntensity={0.8}
        />
      </mesh>
      {/* Outer rings */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.5, 0.05, 16, 100]} />
        <meshStandardMaterial 
          color={colorHex} 
          emissive={colorHex}
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.02, 16, 100]} />
        <meshBasicMaterial color={colorHex} transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

const ProcessingAnimation = ({ text, colorHex }: { text: string, colorHex: string }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initializing analysis process...');

  useEffect(() => {
    const stages = [
      { p: 10, text: 'Securing request channel...' },
      { p: 25, text: 'Parsing document structure and elements...' },
      { p: 45, text: 'Synthesizing key knowledge pillars...' },
      { p: 65, text: 'Cross-verifying source citation records...' },
      { p: 85, text: 'Structuring analytical presentation...' },
      { p: 98, text: 'Finalizing scholarly synthesis...' }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + (Math.random() * 5), 98);
        
        while(currentStage < stages.length && next >= stages[currentStage].p) {
          setStage(stages[currentStage].text);
          currentStage++;
        }
        
        return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: '2rem' }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="w-full relative overflow-hidden rounded-2xl border bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-20 transition-all duration-500"
      style={{ borderColor: `${colorHex}40`, boxShadow: `0 0 40px ${colorHex}15` }}
    >
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: `${colorHex}30` }} />
      <motion.div 
        animate={{ x: ["-100%", "200%"] }} 
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="absolute top-0 left-0 w-1/2 h-[2px]"
        style={{ backgroundColor: colorHex, boxShadow: `0 0 10px ${colorHex}` }}
      />
      
      <div className="flex flex-col md:flex-row items-center gap-8 py-10 px-8 w-full">
        
        {/* 3D Visual Section */}
        <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none z-10 rounded-full" />
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color={colorHex} />
            <Processing3DVisual colorHex={colorHex} />
          </Canvas>
        </div>
        
        {/* Text & Progress Section */}
        <div className="flex-1 flex flex-col items-center md:items-start max-w-lg w-full">
          <p className="font-display font-bold tracking-[0.2em] uppercase text-xl text-center md:text-left mb-6" style={{ color: colorHex }}>
            {text}
          </p>
          
          <div className="p-4 bg-black/50 border border-white/5 rounded-xl w-full mb-4 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${colorHex}, transparent 70%)` }} />
            <div className="text-xs font-mono font-bold uppercase tracking-wider mb-2 text-white/40">Current Process</div>
            <div className="text-sm font-mono text-white/90 leading-relaxed truncate" style={{ textShadow: `0 0 10px ${colorHex}40` }}>
              {">"} {stage}
            </div>
          </div>
          
          {/* Progress System */}
          <div className="w-full space-y-3">
            <div className="flex justify-between items-end">
              <div className="text-xs font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                Queue Status 
                <span className="animate-pulse inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorHex, boxShadow: `0 0 8px ${colorHex}` }}></span>
              </div>
              <div className="text-sm font-mono font-bold" style={{ color: colorHex }}>
                {Math.round(progress)}%
              </div>
            </div>
            
            <div className="h-2 w-full bg-black/80 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                className="h-full relative rounded-full"
                style={{ backgroundColor: colorHex, boxShadow: `0 0 15px ${colorHex}` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeInOut", duration: 0.8 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <div className="absolute right-0 top-0 bottom-0 w-20 animate-pulse bg-gradient-to-r from-transparent to-white/50 blur-sm" />
              </motion.div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

const FeatureLockOverlay = ({ onLockClick, isSigningIn, title = "Sign-In Required" }: { onLockClick: () => void, isSigningIn: boolean, title?: string }) => {
  return (
    <div className="absolute inset-x-0 inset-y-0 bg-slate-950/95 backdrop-blur-xl rounded-[inherit] flex flex-col items-center justify-center p-8 text-center z-40 border border-white/5 shadow-2xl overflow-hidden group">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />
      
      <div className="relative z-10 flex flex-col items-center max-w-md">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-cyan-400/10 blur-xl rounded-full scale-110 animate-pulse" />
          <div className="relative p-5 bg-black/50 border border-cyan-500/30 rounded-2xl text-cyan-400 group-hover:scale-105 transition-transform duration-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <UserIcon className="w-10 h-10 animate-pulse" />
          </div>
        </div>
        
        <h3 className="text-xl md:text-2xl font-display font-semibold tracking-wider text-white mb-3">
          {title}
        </h3>
        
        <p className="text-sm text-slate-300 font-sans tracking-wide leading-relaxed mb-8 max-w-sm">
          Please link your Google Account to unlock this interactive module. Sign-in is required to secure research quota limits, scholarly database lookup APIs, and personalized cloud history.
        </p>
        
        <button
          onClick={onLockClick}
          disabled={isSigningIn}
          className="group/btn relative px-8 py-4 bg-white/10 hover:bg-cyan-500/20 border border-white/20 hover:border-cyan-500/60 rounded-xl font-mono text-xs tracking-widest text-cyan-300 uppercase transition-all duration-300 flex items-center gap-3 disabled:opacity-50 shadow-lg hover:shadow-[0_0_25px_rgba(6,182,212,0.2)] cursor-pointer active:scale-95"
        >
          {isSigningIn ? (
            <div className="w-4 h-4 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-400 group-hover/btn:scale-110 duration-300" />
              <span>Sign In with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export function getPaperCategory(topic: string, summary: string = ""): string {
  const text = `${topic} ${summary}`.toLowerCase();
  
  if (
    text.includes("medicine") || text.includes("medical") || text.includes("disease") || 
    text.includes("cancer") || text.includes("health") || text.includes("clinical") || 
    text.includes("therapy") || text.includes("virus") || text.includes("drug") || 
    text.includes("biology") || text.includes("gene") || text.includes("dna") ||
    text.includes("rna") || text.includes("genomic") || text.includes("covid") || 
    text.includes("vaccine") || text.includes("pathogen") || text.includes("anatom") ||
    text.includes("neurology") || text.includes("cardio") || text.includes("pharmacology") ||
    text.includes("patient") || text.includes("symptom") || text.includes("surgery")
  ) {
    return "Medicine";
  }
  
  if (
    text.includes("technology") || text.includes("computer") || text.includes("software") || 
    text.includes("algorithm") || text.includes("ai") || text.includes("artificial intelligence") || 
    text.includes("machine learning") || text.includes("network") || text.includes("quantum") || 
    text.includes("hardware") || text.includes("robotic") || text.includes("cyber") || 
    text.includes("digital") || text.includes("blockchain") || text.includes("internet") || 
    text.includes("database") || text.includes("programming") || text.includes("encryption") ||
    text.includes("computing") || text.includes("neural network") || text.includes("web") ||
    text.includes("cloud") || text.includes("app") || text.includes("server")
  ) {
    return "Technology";
  }

  if (
    text.includes("science") || text.includes("physics") || text.includes("chemistry") || 
    text.includes("astronomy") || text.includes("space") || text.includes("galaxy") || 
    text.includes("molecule") || text.includes("atom") || text.includes("laboratory") || 
    text.includes("experiment") || text.includes("geology") || text.includes("climate") || 
    text.includes("energy") || text.includes("material") || text.includes("thermodynamic") ||
    text.includes("fusion") || text.includes("nanotech") || text.includes("chemical") ||
    text.includes("ecosystem") || text.includes("evolution") || text.includes("planet") ||
    text.includes("solar") || text.includes("particle")
  ) {
    return "Science";
  }

  if (
    text.includes("history") || text.includes("ancient") || text.includes("medieval") || 
    text.includes("war") || text.includes("century") || text.includes("archeology") || 
    text.includes("civilization") || text.includes("empire") || text.includes("dynasty") ||
    text.includes("revolution") || text.includes("historical") || text.includes("archaeological")
  ) {
    return "History";
  }

  if (
    text.includes("economy") || text.includes("finance") || text.includes("market") || 
    text.includes("business") || text.includes("trade") || text.includes("inflation") || 
    text.includes("gdp") || text.includes("investment") || text.includes("commerce") ||
    text.includes("banking") || text.includes("fiscal") || text.includes("monetary")
  ) {
    return "Economics";
  }

  if (
    text.includes("philosophy") || text.includes("art") || text.includes("literature") || 
    text.includes("music") || text.includes("culture") || text.includes("linguistic") || 
    text.includes("language") || text.includes("sociology") || text.includes("political") ||
    text.includes("government") || text.includes("psychology") || text.includes("ethics")
  ) {
    return "Humanities";
  }

  return "General";
}

export function getCategoryBadgeStyle(category: string): { bg: string, text: string, border: string, glow: string } {
  switch (category) {
    case 'Medicine':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/25',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
      };
    case 'Technology':
      return {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/25',
        glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]'
      };
    case 'Science':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/25',
        glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]'
      };
    case 'History':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/25',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]'
      };
    case 'Economics':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/25',
        glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
      };
    case 'Humanities':
      return {
        bg: 'bg-pink-500/10',
        text: 'text-pink-400',
        border: 'border-pink-500/25',
        glow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]'
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/25',
        glow: 'shadow-[0_0_15px_rgba(100,116,139,0.15)]'
      };
  }
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function VisualizationCard({
  viz,
  idx,
  COLORS,
  onAppendToMemo
}: {
  viz: any;
  idx: number;
  COLORS: string[];
  onAppendToMemo?: (text: string) => void;
}) {
  const [chartType, setChartType] = useState<string>(viz.type || 'bar');

  const chartData = useMemo(() => {
    if (!viz.data || !Array.isArray(viz.data)) return [];
    return viz.data.map((d: any) => {
      let name = d.name;
      let value = d.value;
      
      if (name === undefined || value === undefined) {
        const keys = Object.keys(d);
        const nameKey = keys.find(k => typeof d[k] === 'string' || k.toLowerCase().includes('name') || k.toLowerCase().includes('label') || k.toLowerCase() === 'x') || keys[0];
        const valKey = keys.find(k => k !== nameKey && !isNaN(Number(d[k]))) || keys[1] || keys[0];
        
        name = name ?? d[nameKey];
        value = value ?? d[valKey];
      }
      return { ...d, name: String(name ?? ''), value: Number(value) || 0 };
    });
  }, [viz.data]);

  return (
    <GlassCard className="border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.1)] p-5 flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-pink-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-pink-400/80">{viz.title}</h2>
          </div>
          
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 max-w-full overflow-x-auto">
            {['bar', 'line', 'pie', 'area', 'radar', 'scatter'].map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={cn(
                  "px-2 py-1 text-[9px] font-mono font-bold rounded-md uppercase transition-all cursor-pointer whitespace-nowrap",
                  chartType === t
                    ? "bg-pink-600 border-b border-pink-400 text-white shadow-lg font-black"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="h-56 min-h-[14rem] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </PieChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`colorValue-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Area type="monotone" dataKey="value" stroke="#ec4899" fillOpacity={1} fill={`url(#colorValue-${idx})`} />
              </AreaChart>
            ) : chartType === 'radar' ? (
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="name" stroke="#ffffff40" fontSize={9} />
                <PolarRadiusAxis stroke="rgba(255,255,255,0.1)" angle={30} domain={[0, 'auto']} fontSize={8} />
                <Radar name={viz.title} dataKey="value" stroke="#ec4899" fill="#ec4899" fillOpacity={0.5} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
              </RadarChart>
            ) : chartType === 'scatter' ? (
              <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="category" dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="value" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="value" range={[50, 300]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Scatter name={viz.title} data={chartData} fill="#ec4899">
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#ec4899', r: 4, strokeWidth: 0 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
        {onAppendToMemo && (
          <button 
            onClick={() => onAppendToMemo(`**Data Synthesized from ${viz.title} (${chartType.toUpperCase()} Chart)**\n\n| Attribute / Class | Metric Value |\n| --- | --- |\n${chartData.map(d => `| ${d.name} | ${d.value} |`).join('\n')}`)}
            className="self-end px-2 py-1 bg-pink-500/10 hover:bg-pink-500/25 border border-pink-500/20 text-[9px] font-mono tracking-wider font-bold text-pink-300 rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            title="Append raw chart dataset to workspace Notebook"
          >
            <BookOpen className="w-3 h-3" />
            APPEND VALUES TO WORKSPACE
          </button>
        )}
        {viz.apaCitation && (
          <div>
            <p className="text-[9px] text-white/30 font-mono tracking-wider mb-1">SYNTHESIZED MEDIA REFERENCE</p>
            <p className="text-[10px] text-white/50 font-serif leading-relaxed italic">{viz.apaCitation}</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function ResearchDocumentViewer({ currentResearch, onAppendToMemo }: { currentResearch: ResearchPaper; onAppendToMemo?: (text: string) => void }) {
  const [isCopied, setIsCopied] = useState(false);
  const [paperPageIndex, setPaperPageIndex] = useState(0);
  const [showAgentPlan, setShowAgentPlan] = useState(false);

  const paperPages = React.useMemo(() => {
    if (!currentResearch) return [];
    
    // Fallbacks
    const dateStr = currentResearch.createdAt?.toDate?.() 
      ? currentResearch.createdAt.toDate().toLocaleDateString() 
      : new Date().toLocaleDateString();

    const titlePage = `# ${currentResearch.topic}\n\n**Generated By:** Lumen AI Research Intelligence\n\n**Date:** ${dateStr}`;
    const result: string[] = [titlePage];
    
    const lines = (currentResearch.paper || '').split('\n');
    let hasAbstractInPaper = false;
    for (let l of lines) {
      if (l.match(/^#+\s.*abstract/i)) {
        hasAbstractInPaper = true;
        break;
      }
    }

    if (!hasAbstractInPaper && currentResearch.summary) {
      result.push(`# Abstract\n\n${currentResearch.summary}`);
    }

    let currentPage = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeading = line.match(/^##?\s/);
      const llower = line.toLowerCase();
      const isMajorSection = line.match(/^#+\s/) && (
        llower.includes('abstract') || 
        llower.includes('introduction') ||
        llower.includes('conclusion') ||
        llower.includes('reference') ||
        llower.includes('appendix') || 
        llower.includes('literature') || 
        llower.includes('methodology') || 
        llower.includes('result') || 
        llower.includes('discussion')
      );

      if (isHeading || isMajorSection) {
        if (currentPage.trim()) {
           result.push(currentPage.trim());
        }
        
        const cleanHeading = line.replace(/^#+\s/, '').trim();
        if (cleanHeading.toLowerCase() === (currentResearch.topic || '').toLowerCase()) {
           currentPage = ""; // skip duplicate title heading
        } else {
           currentPage = line + '\n';
        }
      } else {
        currentPage += line + '\n';
      }
    }
    if (currentPage.trim()) {
      result.push(currentPage.trim());
    }
    
    return result;
  }, [currentResearch]);

  React.useEffect(() => {
    setPaperPageIndex(0);
  }, [currentResearch]);

  const handleCopySummary = () => {
    if (currentResearch?.summary) {
      navigator.clipboard.writeText(currentResearch.summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const category = getPaperCategory(currentResearch.topic, currentResearch.summary);
  const badgeStyle = getCategoryBadgeStyle(category);

  return (
    <div className="w-full space-y-6">
      {/* Dynamic Tagging & Metadata Header Row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn(
          "px-3 py-1 text-xs font-mono font-bold tracking-wider rounded-full border uppercase transition-all duration-300 flex items-center gap-1.5",
          badgeStyle.bg, badgeStyle.text, badgeStyle.border, badgeStyle.glow
        )}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'currentColor' }} />
          Category: {category}
        </span>
        <span className="px-3 py-1 text-xs font-mono text-white/50 bg-white/5 border border-white/10 rounded-full uppercase tracking-wider">
          📄 {paperPages.length} {paperPages.length === 1 ? 'Page' : 'Pages'}
        </span>
        <span className="px-3 py-1 text-xs font-mono text-white/50 bg-white/5 border border-white/10 rounded-full uppercase tracking-wider">
          🔗 {currentResearch.citations?.length || 0} Sources
        </span>
        <span className="px-3 py-1 text-xs font-mono text-white/50 bg-white/5 border border-white/10 rounded-full uppercase tracking-wider">
          📊 {currentResearch.visualizations?.length || 0} Visuals
        </span>

        {currentResearch.intent?.interpretedSubject && currentResearch.intent.interpretedSubject !== currentResearch.topic && (
          <span className="px-3 py-1 text-xs font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full tracking-wider flex items-center gap-1.5 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Disambiguated: {currentResearch.intent.interpretedSubject}
          </span>
        )}

        {currentResearch.qualityGateAudit && (
          <span className="px-3 py-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full uppercase tracking-wider flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Quality Gate: {currentResearch.qualityGateAudit.score}%
          </span>
        )}

        {currentResearch.agentPlan && currentResearch.agentPlan.length > 0 && (
          <button
            onClick={() => setShowAgentPlan(!showAgentPlan)}
            className="px-3 py-1 text-xs font-mono font-bold tracking-wider rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            Agent Plan ({currentResearch.agentPlan.length} Tasks • {currentResearch.verificationScore || 85}% Rigor)
          </button>
        )}
      </div>

      {currentResearch.benchmarkNote && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong className="text-amber-200 uppercase tracking-wider block mb-0.5">Benchmark Comparability Advisory</strong>
            <span>{currentResearch.benchmarkNote}</span>
          </div>
        </div>
      )}

      {currentResearch.conflicts && currentResearch.conflicts.length > 0 && (
        <GlassCard className="border-amber-500/30 bg-amber-950/15 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2.5 text-amber-300 font-mono text-xs uppercase font-bold tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Discrepancies & Conflicting Evidence Detected ({currentResearch.conflicts.length})
          </div>
          <div className="space-y-3">
            {currentResearch.conflicts.map((conflict, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-black/40 border border-amber-500/20 text-xs font-mono space-y-2">
                <div className="font-bold text-amber-400">{conflict.topicOrMetric}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-white/70">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="font-bold text-white/90 block mb-0.5">{conflict.sourceA.sourceTitle}:</span>
                    {conflict.sourceA.claim}
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="font-bold text-white/90 block mb-0.5">{conflict.sourceB.sourceTitle}:</span>
                    {conflict.sourceB.claim}
                  </div>
                </div>
                <p className="text-[11px] text-amber-200/90 font-sans italic leading-relaxed pt-1">
                  <strong>Root Cause & Reconciled Synthesis:</strong> {conflict.differenceExplanation} {conflict.synthesis}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <AnimatePresence>
        {showAgentPlan && currentResearch.agentPlan && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard className="border-cyan-500/30 bg-black/60 shadow-[0_0_30px_rgba(6,182,212,0.15)] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase font-bold tracking-wider">
                  <Bot className="w-4 h-4" />
                  Autonomous Agent Plan & Verification Audit
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/50">
                  <span>Iterations: {currentResearch.iterationCount || 'N/A'}</span>
                  <span>•</span>
                  <span>Facts Grounded: {currentResearch.evidenceCount || currentResearch.findings.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentResearch.agentPlan.map((task, idx) => (
                  <div key={task.id || idx} className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white/90 truncate">{idx + 1}. {task.description}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                        {task.type}
                      </span>
                    </div>
                    {task.toolUsed && (
                      <div className="text-[10px] text-cyan-400/80">Tool: {task.toolUsed}</div>
                    )}
                    {task.resultSummary && (
                      <p className="text-[10px] text-white/50 font-sans line-clamp-2">{task.resultSummary}</p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32"
      >
      <div className="lg:col-span-2 space-y-8">
        {currentResearch.summary && (
          <GlassCard className="border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
             <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
               <div className="flex items-center gap-3">
                 <FileText className="w-5 h-5 text-cyan-400" />
                 <h2 className="text-lg font-display font-bold uppercase tracking-widest text-cyan-400">Research Summary</h2>
               </div>
               <div className="flex items-center gap-2">
                 {onAppendToMemo && (
                   <button 
                     onClick={() => onAppendToMemo(`**Abstract / Summary of ${currentResearch.topic}:**\n> ${currentResearch.summary}`)}
                     className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg text-[10px] font-mono font-bold text-purple-300 transition-all flex items-center gap-1 cursor-pointer"
                     title="Send to Workspace Notebook"
                   >
                     <BookOpen className="w-3 h-3" />
                     SEND TO WORKSPACE
                   </button>
                 )}
                 <button 
                   onClick={handleCopySummary}
                   className="p-2 hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-xs font-mono font-bold text-white/50 hover:text-white" 
                   title="Copy Summary"
                 >
                   {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                   {isCopied ? 'COPIED' : 'COPY'}
                 </button>
               </div>
             </div>
             <p className="text-white/80 font-mono text-sm leading-relaxed">{currentResearch.summary}</p>
          </GlassCard>
        )}
        <GlassCard className="border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
          <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-display font-bold uppercase tracking-widest text-purple-400">Main Document</h2>
            </div>
            <div className="flex items-center gap-2">
              {onAppendToMemo && (
                <button 
                  onClick={() => onAppendToMemo(`**Excerpt from "${currentResearch.topic}" (Page ${paperPageIndex + 1}):**\n\n${paperPages[paperPageIndex] || ''}`)}
                  className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg text-[10px] font-mono font-bold text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer mr-2"
                  title="Send current page text to Workspace note"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">SEND VIEW TO WORKSPACE</span>
                </button>
              )}
              <button onClick={() => exportToPDF(currentResearch)} className="p-2 hover:bg-white/10 rounded-lg transition-all" title="Export PDF"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToDOCX(currentResearch)} className="p-2 hover:bg-white/10 rounded-lg transition-all" title="Export DOCX"><ChevronRight className="w-4 h-4 rotate-90" /></button>
              <button onClick={() => exportToLaTeX(currentResearch)} className="p-2 hover:bg-white/10 rounded-lg transition-all text-xs font-bold" title="Export LaTeX">TeX</button>
            </div>
          </div>
          <div className="prose prose-invert max-w-none prose-p:text-white/80 prose-p:leading-relaxed prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline break-words [&_a]:break-all overflow-hidden font-sans relative transition-all duration-500 ease-in-out min-h-[400px]">
            <ReactMarkdown>{paperPages[paperPageIndex] || ''}</ReactMarkdown>
          </div>
          
          {paperPages.length > 1 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
              <button 
                onClick={() => setPaperPageIndex(Math.max(0, paperPageIndex - 1))}
                disabled={paperPageIndex === 0}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-mono font-bold uppercase disabled:hover:bg-white/5"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs font-mono text-white/50">
                Page {paperPageIndex + 1} of {paperPages.length}
              </span>
              <button 
                onClick={() => setPaperPageIndex(Math.min(paperPages.length - 1, paperPageIndex + 1))}
                disabled={paperPageIndex === paperPages.length - 1}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-mono font-bold uppercase disabled:hover:bg-white/5"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="space-y-8">
        <GlassCard id="key-findings" className="bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-emerald-400">Key Extracts</h2>
          </div>
          <ul className="space-y-4">
            {currentResearch.findings.map((finding, i) => (
              <li key={i} className="group flex flex-col gap-2 text-sm text-white/80 pl-4 py-3 leading-relaxed relative hover:text-white transition-colors bg-white/5 hover:bg-emerald-500/10 rounded-r-xl border-l-[3px] border-emerald-500/40 hover:border-emerald-400">
                <span className="opacity-80 group-hover:opacity-100">{finding}</span>
                {onAppendToMemo && (
                  <button 
                    onClick={() => onAppendToMemo(`**Extract Key Finding from "${currentResearch.topic}":**\n* ${finding}`)}
                    className="text-[9px] w-fit font-mono text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 mt-1 transition-all bg-purple-500/10 hover:bg-purple-500/25 px-2 py-1 rounded-md border border-purple-500/15 cursor-pointer opacity-70 group-hover:opacity-100"
                    title="Send to Workspace"
                  >
                    <BookOpen className="w-3 h-3" /> Append to Workspace Note
                  </button>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>

        {currentResearch.citationWeb && currentResearch.citationWeb.length > 0 && (
          <GlassCard className="border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400/80">Semantic Citation Web</h2>
            </div>
            <CitationWeb nodes={currentResearch.citationWeb} />
          </GlassCard>
        )}

        {currentResearch.visualizations && currentResearch.visualizations.length > 0 && (
          currentResearch.visualizations.map((viz, idx) => (
            <VisualizationCard 
              key={idx} 
              viz={viz} 
              idx={idx} 
              COLORS={COLORS} 
              onAppendToMemo={onAppendToMemo} 
            />
          ))
        )}

        <GlassCard className="border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
          <div className="flex items-center gap-3 mb-6">
            <LinkIcon className="w-5 h-5 text-orange-400" />
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-orange-400">Telemetry Sources</h2>
          </div>
          <div className="space-y-4 overflow-hidden">
            {currentResearch.citations.map((cite, i) => (
              <a 
                key={i} 
                href={cite.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-gradient-to-r from-black/60 to-black/40 hover:from-orange-500/10 hover:to-orange-500/5 transition-all border border-white/5 hover:border-orange-500/40 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] overflow-hidden group relative"
              >
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
                    <span className="text-xs font-mono font-bold text-orange-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-medium text-white/90 truncate group-hover:text-orange-400 transition-colors pr-6" title={cite.title}>{cite.title}</p>
                    <p className="text-[10px] text-white/40 truncate font-mono mt-1 opacity-70 group-hover:opacity-100 transition-opacity" title={cite.url}>{cite.url}</p>
                    {cite.warning && (
                      <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono">
                        <span className="font-bold">⚠️ Notice:</span> {cite.warning}
                      </div>
                    )}
                    {cite.apa && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                         <p className="text-[9px] text-white/30 font-mono tracking-wider mb-1 uppercase">Generated Reference</p>
                         <p className="text-xs text-white/60 font-serif leading-relaxed italic">{cite.apa}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute top-4 right-4 text-white/20 group-hover:text-orange-400 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>
        </GlassCard>
      </div>
      </motion.div>
    </div>
  );
}

const getNormalizedPercentage = (val: number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  // If the value is <= 1, assume it's a fraction (e.g., 0.85) and convert to %
  const pct = val <= 1 ? val * 100 : val;
  // Clamp between 0 and 100
  return Math.min(Math.max(pct, 0), 100);
};

export default function App() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);
  const [activeTab, setActiveTab] = useState<'overview' | 'research' | 'library' | 'history' | 'summarize' | 'plagiarism'>('overview');
  const [viewMode, setViewMode] = useState<'main' | 'library' | 'history'>('main');
  const [bgIntensity, setBgIntensity] = useState(1);
  const [bgColorPalette, setBgColorPalette] = useState<'default' | 'monochrome' | 'neon'>('default');
  const [showSettings, setShowSettings] = useState(false);
  const [researchTopic, setResearchTopic] = useState('');
  const [detailLevel, setDetailLevel] = useState<'brief' | 'standard' | 'detailed'>('standard');
  const [isResearching, setIsResearching] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgressUpdate | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    depth: 'standard',
    maxIterations: 6,
    sourcePreference: 'general',
    recentSourcesOnly: true,
    requireQuantitativeData: false,
  });
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const [autoScrollToFindings, setAutoScrollToFindings] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [currentResearch, setCurrentResearch] = useState<ResearchPaper | null>(null);
  const [selectedHistoryResearch, setSelectedHistoryResearch] = useState<ResearchPaper | null>(null);
  const [history, setHistory] = useState<ResearchPaper[]>([]);
  const [archiveFilter, setArchiveFilter] = useState<string>('All');

  const filteredHistory = useMemo(() => {
    if (archiveFilter === 'All') return history;
    return history.filter(item => {
      const category = getPaperCategory(item.topic, item.summary || "");
      return category === archiveFilter;
    });
  }, [history, archiveFilter]);
  const [feedback, setFeedback] = useState('');
  const [summarizeUrl, setSummarizeUrl] = useState('');
  const [analyticalLens, setAnalyticalLens] = useState<'default' | 'academic' | 'patent' | 'socio-technical' | 'clinical'>('default');
  const [workspaceMemo, setWorkspaceMemo] = useState<string>('## Lumen Workspace Memo\n\nUse this interactive notebook to synthesize notes, outline drafts, and reference key discoveries.\n\n### Core Extracts:\n- No extracts captured yet. Use the "Send Extracts to Memo" buttons under research sections.\n');
  const [memoTasks, setMemoTasks] = useState<{id: string; text: string; done: boolean}[]>([
    { id: '1', text: 'Analyze synthesized 3D concept structures', done: false },
    { id: '2', text: 'Verify citation connections inside semantic web', done: false }
  ]);
  const [newMemoTaskText, setNewMemoTaskText] = useState('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState('');
  const [plagiarismText, setPlagiarismText] = useState('');
  const [plagiarismResult, setPlagiarismResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isWorkspaceCopied, setIsWorkspaceCopied] = useState(false);
  const [paperPageIndex, setPaperPageIndex] = useState(0);

  const paperPages = useMemo(() => {
    if (!currentResearch) return [];
    
    // Fallbacks
    const dateStr = currentResearch.createdAt?.toDate?.() 
      ? currentResearch.createdAt.toDate().toLocaleDateString() 
      : new Date().toLocaleDateString();

    const titlePage = `# ${currentResearch.topic}\n\n**Generated By:** Lumen AI Research Intelligence\n\n**Date:** ${dateStr}`;
    const result: string[] = [titlePage];
    
    const lines = (currentResearch.paper || '').split('\n');
    let hasAbstractInPaper = false;
    for (let l of lines) {
      if (l.match(/^#+\s.*abstract/i)) {
        hasAbstractInPaper = true;
        break;
      }
    }

    if (!hasAbstractInPaper && currentResearch.summary) {
      result.push(`# Abstract\n\n${currentResearch.summary}`);
    }

    let currentPage = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeading = line.match(/^##?\s/);
      const llower = line.toLowerCase();
      const isMajorSection = line.match(/^#+\s/) && (
        llower.includes('abstract') || 
        llower.includes('introduction') ||
        llower.includes('conclusion') ||
        llower.includes('reference') ||
        llower.includes('appendix') || 
        llower.includes('literature') || 
        llower.includes('methodology') || 
        llower.includes('result') || 
        llower.includes('discussion')
      );

      if (isHeading || isMajorSection) {
        if (currentPage.trim()) {
           result.push(currentPage.trim());
        }
        
        const cleanHeading = line.replace(/^#+\s/, '').trim();
        if (cleanHeading.toLowerCase() === (currentResearch.topic || '').toLowerCase()) {
           currentPage = ""; // skip duplicate title heading
        } else {
           currentPage = line + '\n';
        }
      } else {
        currentPage += line + '\n';
      }
    }
    if (currentPage.trim()) {
      result.push(currentPage.trim());
    }
    
    return result;
  }, [currentResearch]);

  // Reset page index when research changes
  useEffect(() => {
    if (currentResearch) {
      setPaperPageIndex(0);
    }
  }, [currentResearch]);

  useEffect(() => {
    if (!isResearching && currentResearch && autoScrollToFindings) {
      setTimeout(() => {
        const el = document.getElementById('key-findings');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
        setAutoScrollToFindings(false);
      }, 500); // slight delay to allow rendering and animation 
    }
  }, [isResearching, currentResearch, autoScrollToFindings]);

  const handleCopySummary = () => {
    if (currentResearch?.summary) {
      navigator.clipboard.writeText(currentResearch.summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
  React.useEffect(() => {
    if (showIntro) return;
    
    // Initialize Lenis for smooth scrolling on the window
    const lenis = new Lenis({
      syncTouch: true,
      touchMultiplier: 2,
    });

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [showIntro]);

  React.useEffect(() => {
    if (viewMode === 'library' || viewMode === 'history') return;
    const handleScroll = () => {
      if (document.documentElement.dataset.scrolling) return;
      document.documentElement.dataset.scrolling = 'true';
      
      requestAnimationFrame(() => {
        const middle = window.scrollY + window.innerHeight / 2;
        const sections = ['overview', 'research', 'history', 'summarize', 'plagiarism'];
        
        for (const section of sections) {
           const el = document.getElementById(section);
           if (el) {
              const top = el.offsetTop;
              const bottom = top + el.offsetHeight;
              if (middle >= top && middle <= bottom) {
                 if (activeTab !== section) setActiveTab(section as any);
                 break;
              }
           }
        }
        document.documentElement.dataset.scrolling = '';
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, viewMode]);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (!showIntro) {
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setActiveTab('overview');
      }, 50);
    }
  }, [showIntro]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        fetchHistory(u.uid);
      } else {
        try {
          const anonUser = await signInAnon();
          if (anonUser && isMounted) {
            setUser(anonUser);
            fetchHistory(anonUser.uid);
          }
        } catch (err) {
          console.warn("Auto-session fallback:", err);
          if (isMounted) {
            setUser({
              uid: 'guest-session',
              email: null,
              displayName: 'Guest Researcher',
              isAnonymous: true,
            } as any);
            setHistory([]);
          }
        }
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const fetchHistory = (uid: string) => {
    const q = query(
      collection(db, 'researches'),
      where('userId', '==', uid)
    );
    
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResearchPaper));
      // Sort client-side by createdAt descending (newest first)
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setHistory(docs);
    }, (error) => {
      console.error("Firestore error while loading research history:", error);
    });
  };

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setAuthErrorCode(null);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthErrorCode("Login was cancelled. Please try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthErrorCode("A sign-in request is already in progress.");
      } else {
        setAuthErrorCode("Authentication failed. Please check your connection.");
      }
      // Auto-clear error after 5 seconds
      setTimeout(() => setAuthErrorCode(null), 5000);
    } finally {
      setIsSigningIn(false);
    }
  };

  const renderAuthLock = (sectionName: string) => {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 md:px-6 relative overflow-hidden text-center max-w-xl mx-auto">
        <div className="absolute inset-0 bg-cyan-500/5 dark:bg-cyan-500/5 rounded-3xl blur-2xl pointer-events-none" />
        <GlassCard className="p-8 md:p-12 w-full text-center flex flex-col items-center justify-center gap-6 relative select-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-display font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Link Required
            </h3>
            <p className="text-sm text-slate-500 dark:text-white/60 font-sans leading-relaxed">
              Google Account linkage is required to access the <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{sectionName}</span> module as requested by secure integrity protocols.
            </p>
          </div>
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-mono text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-[1.03] disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg active:scale-95"
          >
            {isSigningIn ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserIcon className="w-4 h-4" />
                <span>Establish AI Link</span>
              </>
            )}
          </button>
        </GlassCard>
      </div>
    );
  };

  const handleResearch = async (clarifiedQuery?: string) => {
    const topicToRun = (clarifiedQuery || researchTopic || '').trim();
    if (!topicToRun) return;

    let currentUser = user || auth.currentUser;
    if (!currentUser) {
      try {
        const anon = await signInAnon();
        if (anon) {
          currentUser = anon;
          setUser(anon);
        }
      } catch (authErr) {
        console.warn("Guest session fallback:", authErr);
      }
    }

    const effectiveUid = currentUser?.uid || 'guest-session';
    setIsResearching(true);
    setResearchError(null);
    setCurrentResearch(null);
    if (!clarifiedQuery) {
      setAgentProgress(null);
    }

    let needsClarification = false;
    try {
      const effectiveSettings: AgentSettings = {
        ...agentSettings,
        depth: detailLevel === 'brief' ? 'quick' : detailLevel === 'detailed' ? 'deep' : 'standard',
        maxIterations: detailLevel === 'brief' ? 4 : detailLevel === 'detailed' ? 8 : 6,
      };

      const data = await conductResearch(
        topicToRun, 
        feedback, 
        detailLevel, 
        analyticalLens,
        (progressUpdate) => {
          setAgentProgress(progressUpdate);
        },
        effectiveSettings,
        clarifiedQuery
      );

      // If domain ambiguity is detected and requires user clarification, pause execution
      if (data.intent?.requiresClarification && !clarifiedQuery) {
        needsClarification = true;
        setAgentProgress({
          status: 'clarification_needed',
          stageTitle: 'Clarification Required',
          message: data.intent.clarificationQuestion || 'Multiple meanings found. Please select an option to clarify your subject.',
          progressPercentage: 10,
          sourcesCount: 0,
          evidenceCount: 0,
          claimsCount: 0,
          iteration: 0,
          maxIterations: effectiveSettings.maxIterations,
          intent: data.intent,
          clarificationQuestion: data.intent.clarificationQuestion,
          clarificationOptions: data.intent.clarificationOptions,
        });
        setIsResearching(true);
        return;
      }
      
      if ((data as any)._repaired) {
        setResearchError("The research output was truncated due to length limits. Displaying partial results. Please try a narrower topic for full context.");
      }

      const newResearch: any = {
        topic: data.topic || topicToRun,
        summary: data.summary || '',
        findings: data.findings || [],
        paper: data.paper || 'Research output was truncated or failed to generate. Please try a narrower topic.',
        citations: data.citations || [],
        visualizations: data.visualizations || [],
        conceptModels: data.conceptModels || [],
        citationWeb: data.citationWeb || [],
        // Agent provenance metadata
        ...(data.intent ? { intent: data.intent } : {}),
        agentPlan: (data as any).agentPlan || [],
        claims: (data as any).claims || [],
        conflicts: (data as any).conflicts || [],
        ...((data as any).qualityGateAudit ? { qualityGateAudit: (data as any).qualityGateAudit } : {}),
        ...((data as any).benchmarkNote ? { benchmarkNote: (data as any).benchmarkNote } : {}),
        evidenceCount: (data as any).evidenceCount || 0,
        iterationCount: (data as any).iterationCount || 0,
        verificationScore: (data as any).verificationScore || 85,
        depthLevel: effectiveSettings.depth,
        userId: effectiveUid,
        createdAt: serverTimestamp(),
      };
      
      const cleanResearch = sanitizeFirestoreData(newResearch);
      if (currentUser && effectiveUid !== 'guest-session') {
        try {
          const docRef = await addDoc(collection(db, 'researches'), cleanResearch);
          setCurrentResearch({ ...cleanResearch, id: docRef.id });
        } catch (e) {
          console.warn("Could not save to Firestore, displaying session research:", e);
          setCurrentResearch({ ...cleanResearch, id: `local-${Date.now()}` });
        }
      } else {
        setCurrentResearch({ ...cleanResearch, id: `local-${Date.now()}` });
      }
      setResearchTopic('');
      setFeedback('');
    } catch (error: any) {
      console.error("Research failed:", error);
      let errMsg = error.message || "An unexpected error occurred during research.";
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.error?.code === 429 || parsed.error?.status === "RESOURCE_EXHAUSTED") {
          errMsg = "You have exceeded the free tier quota for this AI model. Please check your plan or try again later.";
        } else if (parsed.error) {
          errMsg = parsed.error.message || JSON.stringify(parsed.error);
        }
      } catch (e) {
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          errMsg = "You have exceeded the free tier quota for this AI model. Please check your plan or try again later.";
        }
      }
      setResearchError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      if (!needsClarification) {
        setIsResearching(false);
      }
    }
  };

  const handleAddMemoTask = () => {
    if (!newMemoTaskText.trim()) return;
    setMemoTasks(prev => [...prev, { id: Date.now().toString(), text: newMemoTaskText.trim(), done: false }]);
    setNewMemoTaskText('');
  };

  const handleToggleMemoTask = (id: string) => {
    setMemoTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleRemoveMemoTask = (id: string) => {
    setMemoTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAppendToMemo = (textToAppend: string) => {
    setWorkspaceMemo(prev => `${prev}\n\n### Appended Extract (${new Date().toLocaleTimeString()}):\n${textToAppend}`);
    setIsWorkspaceOpen(true);
  };

  const handleSummarize = async () => {
    if (!summarizeUrl || !user) return;
    setIsSummarizing(true);
    try {
      const res = await summarizeMedia(summarizeUrl);
      setSummaryResult(res);
    } catch (error) {
      console.error("Summarization failed:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCheckPlagiarism = async () => {
    if (!plagiarismText || !user) return;
    setIsChecking(true);
    try {
      const res = await checkPlagiarism(plagiarismText);
      setPlagiarismResult(res);
    } catch (error) {
      console.error("Plagiarism check failed:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <>
      {showIntro && <IntroScreen onStart={() => setShowIntro(false)} theme={theme} />}
      
      {!showIntro && (
        <div className={cn("flex relative min-h-screen bg-transparent transition-colors duration-500", theme === 'light' ? "text-slate-900" : "text-white/90")}>
          <div className="cyber-glow fixed inset-0 z-0 pointer-events-none"></div>
          <InteractiveBackground activeSection={activeTab} intensity={bgIntensity} colorPalette={bgColorPalette} theme={theme} />

      {/* Missing Firebase Configuration Warning Banner */}
      {firebaseConfigError && (
        <div className="fixed top-2 left-4 right-4 z-50 max-w-4xl mx-auto p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 shadow-2xl backdrop-blur-md flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3 text-xs md:text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <span>{firebaseConfigError}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 w-full flex justify-between items-center p-6 z-50 pointer-events-none">
        {/* Logo */}
        <div 
          className="flex items-center gap-3 pointer-events-auto group select-none cursor-pointer relative"
          onClick={() => {
            setShowIntro(true);
            window.scrollTo(0, 0);
          }}
        >
          <div className={cn("relative flex items-center justify-center w-8 h-8 rounded-lg border backdrop-blur-md overflow-hidden transition-colors duration-500", theme === 'light' ? "bg-white/70 border-slate-200" : "bg-black/40 border-white/10")}>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Sparkles className={cn("w-4 h-4 transition-colors duration-500 relative z-10", theme === 'light' ? "text-slate-700 group-hover:text-cyan-600" : "text-white/70 group-hover:text-cyan-300")} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn("font-display font-black text-lg tracking-widest uppercase transition-colors duration-500", theme === 'light' ? "text-slate-900 group-hover:text-cyan-600" : "text-white/90 group-hover:text-white")}>Lumen</span>
            <span className="font-mono font-bold text-[10px] tracking-[0.3em] text-cyan-400 uppercase">AI</span>
          </div>
          <span className={cn("absolute left-0 bottom-[-2.5rem] px-3 py-1.5 border text-xs font-mono uppercase tracking-widest rounded-md opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all pointer-events-none whitespace-nowrap z-50", theme === 'light' ? "bg-white border-slate-200 text-slate-800" : "bg-black/80 border-white/10 text-white")}>
            Return Home
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 md:gap-4">
          <AnimatePresence>
            {authErrorCode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs font-mono text-red-400 text-center uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                {authErrorCode}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn("p-2.5 rounded-full border backdrop-blur-md shadow-lg transition-all flex items-center justify-center cursor-pointer", theme === 'light' ? "bg-white/75 border-slate-200 text-slate-800 hover:text-cyan-600 hover:border-cyan-500 hover:bg-slate-100" : "bg-black/40 border-white/10 text-white/70 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-white/10")}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 animate-pulse" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600 animate-bounce" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn("p-2.5 rounded-full border backdrop-blur-md shadow-lg transition-all flex items-center justify-center cursor-pointer", theme === 'light' ? "bg-white/75 border-slate-200 text-slate-800 hover:text-cyan-600 hover:border-cyan-500 hover:bg-slate-100" : "bg-black/40 border-white/10 text-white/70 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-white/10")}
            >
              <Settings className="w-5 h-5 transition-transform duration-500 hover:rotate-90" />
            </button>
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className={cn("absolute right-0 top-full mt-4 w-66 p-4 rounded-2xl backdrop-blur-xl border flex flex-col gap-4 z-50 shadow-2xl", theme === 'light' ? "bg-white/95 border-slate-200 text-slate-800" : "bg-black/80 border-white/10 text-white")}
                  style={{ transformOrigin: 'top right' }}
                >
                  <div>
                    <p className={cn("text-xs font-mono uppercase mb-3 tracking-widest", theme === 'light' ? "text-slate-500" : "text-white/50")}>Environment Opacity</p>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.1" 
                      value={bgIntensity}
                      onChange={(e) => setBgIntensity(parseFloat(e.target.value))}
                      className={cn("w-full h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)]", theme === 'light' ? "bg-slate-200" : "bg-white/10")}
                    />
                  </div>
                  <div className={cn("h-px w-full", theme === 'light' ? "bg-slate-200" : "bg-white/10")} />
                  <div>
                    <p className={cn("text-xs font-mono uppercase mb-3 tracking-widest", theme === 'light' ? "text-slate-500" : "text-white/50")}>Color Frequency</p>
                    <div className="flex gap-2">
                      <button onClick={() => setBgColorPalette('default')} className={cn("flex-1 py-1.5 px-2 rounded font-mono text-[10px] uppercase transition-colors tracking-wider border cursor-pointer", bgColorPalette === 'default' ? (theme === 'light' ? "bg-cyan-50 border-cyan-400 text-cyan-700 font-bold" : "bg-white/10 border-cyan-500/50 text-cyan-300") : (theme === 'light' ? "bg-transparent border-slate-200 hover:bg-slate-100 text-slate-600" : "bg-transparent border-transparent hover:bg-white/5 text-white/60"))}>Default</button>
                      <button onClick={() => setBgColorPalette('neon')} className={cn("flex-1 py-1.5 px-2 rounded font-mono text-[10px] uppercase transition-colors tracking-wider border cursor-pointer", bgColorPalette === 'neon' ? (theme === 'light' ? "bg-emerald-50 border-emerald-400 text-emerald-700 font-bold" : "bg-white/10 border-lime-500/50 text-lime-300") : (theme === 'light' ? "bg-transparent border-slate-200 hover:bg-slate-100 text-slate-600" : "bg-transparent border-transparent hover:bg-white/5 text-white/60"))}>Neon</button>
                      <button onClick={() => setBgColorPalette('monochrome')} className={cn("flex-1 py-1.5 px-2 rounded font-mono text-[10px] uppercase transition-colors tracking-wider border cursor-pointer", bgColorPalette === 'monochrome' ? (theme === 'light' ? "bg-slate-100 border-slate-400 text-slate-900 font-bold" : "bg-white/10 border-white/50 text-white") : (theme === 'light' ? "bg-transparent border-slate-200 hover:bg-slate-100 text-slate-600" : "bg-transparent border-transparent hover:bg-white/5 text-white/60"))}>Mono</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Floating Navigation */}
      <div className="fixed md:left-6 md:top-1/2 md:-translate-y-1/2 bottom-4 md:bottom-auto left-1/2 -translate-x-1/2 md:translate-x-0 z-50 pointer-events-auto">
        <nav className="flex md:flex-col items-center gap-2 md:gap-4">
          {[
            { id: 'overview', icon: Layers, label: 'Nexus' },
            { id: 'research', icon: Search, label: 'Research' },
            { id: 'library', icon: BoxIcon, label: 'Schematics' },
            { id: 'history', icon: History, label: 'Archive' },
            { id: 'summarize', icon: LinkIcon, label: 'Synthesis' },
            { id: 'plagiarism', icon: ShieldAlert, label: 'Integrity' },
          ].map((item) => (
            <motion.button
              key={item.id}
              onClick={() => {
                if (item.id === 'library') {
                  setViewMode('library');
                  setActiveTab('library');
                  window.scrollTo(0, 0);
                } else if (item.id === 'history') {
                  setViewMode('history');
                  setActiveTab('history');
                  window.scrollTo(0, 0);
                } else {
                  if (viewMode !== 'main') {
                    setViewMode('main');
                    setActiveTab(item.id as any);
                    setTimeout(() => {
                      const el = document.getElementById(item.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  } else {
                    const el = document.getElementById(item.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
              animate={activeTab === item.id ? { 
                scale: 1.1, 
                rotateY: [0, 15, -15, 0], 
                transition: { rotateY: { repeat: Infinity, duration: 4, ease: "easeInOut" } } 
              } : { scale: 1, rotateY: 0 }}
              style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
              className={cn(
                "group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all duration-300 hover:-translate-y-1 md:hover:-translate-y-0 md:hover:translate-x-1 border cursor-pointer",
                activeTab === item.id 
                  ? (theme === 'light' ? "bg-cyan-500 text-white shadow-[0_4px_15px_rgba(6,182,212,0.4)] border-cyan-400" : "bg-white/20 border-cyan-500/50 text-cyan-400 font-bold")
                  : (theme === 'light' ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.05)]" : "bg-black/60 shadow-[0_5px_15px_rgba(0,0,0,0.5)] border-white/10 hover:bg-white/10 text-white/60")
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", activeTab === item.id ? (theme === 'light' ? "text-white" : "text-cyan-400") : "text-slate-500 dark:text-white/60 group-hover:text-cyan-600 dark:group-hover:text-cyan-300")} />
              {/* Tooltip */}
              <span className={cn("hidden md:block absolute left-full ml-4 px-3 py-1.5 border text-xs font-mono uppercase tracking-widest rounded-md opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 origin-left", theme === 'light' ? "bg-white border-slate-200 text-slate-800" : "bg-black/90 border-white/10 text-white")}>
                {item.label}
              </span>
            </motion.button>
          ))}
          
          <div className={cn("w-px h-5 md:w-6 md:h-px my-0.5 md:my-1", theme === 'light' ? "bg-slate-200" : "bg-white/10")}></div>
        
          {user ? (
            <div className="relative group perspective-1000">
              <button 
                className={cn("flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border transition-all duration-500 hover:-translate-y-1 md:hover:-translate-y-0 md:hover:translate-x-1", theme === 'light' ? "bg-white border-slate-200 shadow-lg" : "bg-black/60 border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.5)]")}
              >
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="avatar" />
              </button>
              
              <div className={cn("absolute md:left-full md:bottom-auto bottom-full md:ml-4 mb-4 md:mb-0 px-4 py-3 border rounded-xl opacity-0 translate-y-2 md:translate-y-0 md:-translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all pointer-events-none group-hover:pointer-events-auto flex flex-col gap-2 min-w-[180px] z-50 origin-bottom md:origin-left", theme === 'light' ? "bg-white shadow-2xl border-slate-200 text-slate-800" : "bg-black/90 backdrop-blur-md border border-white/10 text-white")}>
                <p className={cn("text-xs font-mono font-bold uppercase tracking-widest border-b pb-2 truncate", theme === 'light' ? "text-slate-950 border-slate-100" : "text-white border-white/10")}>{user.displayName}</p>
                <button 
                  onClick={() => auth.signOut()} 
                  className="text-xs uppercase tracking-widest text-red-500 hover:text-red-400 hover:bg-red-50/50 p-2 rounded-lg flex items-center justify-between transition-colors w-full group/btn cursor-pointer"
                >
                  Terminate Link <LogOut className="w-3 h-3 group-hover/btn:rotate-12 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSignIn} 
              disabled={isSigningIn}
              className={cn("group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border transition-all duration-500 disabled:opacity-50 hover:-translate-y-1 md:hover:-translate-y-0 md:hover:translate-x-1 cursor-pointer", theme === 'light' ? "bg-white hover:bg-slate-100 border-slate-200 shadow-md hover:shadow-lg text-slate-700" : "bg-black/60 border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_20px_rgba(34,211,238,0.2)] hover:border-cyan-500/50 hover:bg-white/10 text-white")
            }
            >
              {isSigningIn ? (
                <div className="w-4 h-4 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
              ) : (
                <UserIcon className="w-5 h-5 text-slate-500 dark:text-white/60 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors group-hover:scale-110 duration-500" />
              )}
              {/* Tooltip */}
              <span className={cn("hidden md:block absolute left-full ml-4 px-3 py-1.5 border text-xs font-mono uppercase tracking-widest rounded-md opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 origin-left", theme === 'light' ? "bg-white border-slate-200 text-slate-800" : "bg-black/90 border-white/10 text-white")}>
                Establish Link
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <main 
        ref={scrollRef}
        className="flex-1 relative z-10 min-w-0"
      >
        <div className="space-y-32 p-6 md:p-12 pb-32 w-full">
          {viewMode === 'main' ? (
            <>
              {/* Overview / Nexus Section */}
              <Scroll3DSection id="overview" className="py-24">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="max-w-6xl mx-auto w-full space-y-12"
            >
              <header className="space-y-4 text-center md:text-left mb-16 px-4">
                <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] uppercase">
                  LUMEN <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">NEXUS</span>
                </h1>
                <p className="text-white/60 text-base md:text-lg font-sans tracking-wide max-w-2xl">
                  Central analytical workspace mapping all research and synthesis modules
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 relative px-4">
                {/* Connecting Lines Background effect */}
                <div className="absolute inset-4 border border-white/5 rounded-3xl pointer-events-none hidden lg:block" />
                <div className="absolute inset-y-4 left-1/2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none hidden lg:block" />
                <div className="absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none hidden lg:block" />

                {/* Research Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="lg:col-span-8 group cursor-pointer"
                  onClick={() => document.getElementById('research')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <div className={cn(
                    "h-full backdrop-blur-xl border rounded-3xl p-8 hover:bg-white/5 transition-all duration-500 overflow-hidden relative group-hover:-translate-y-2",
                    theme === 'light'
                      ? "bg-white border-slate-200 shadow-[0_10px_30px_rgba(6,182,212,0.06)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.15)] hover:border-cyan-400"
                      : "bg-black/40 border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:border-cyan-500/50"
                  )}>
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full group-hover:bg-cyan-500/20 transition-colors duration-500" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <div className={cn(
                          "p-3 rounded-2xl w-fit mb-6 ring-1 group-hover:scale-110 transition-transform duration-500",
                          theme === 'light' ? "bg-cyan-50 text-cyan-600 ring-cyan-200" : "bg-cyan-500/20 text-cyan-400 ring-cyan-500/30"
                        )}>
                          <Search className="w-8 h-8" />
                        </div>
                        <h3 className={cn(
                          "text-3xl font-display font-black uppercase tracking-widest mb-4 transition-colors",
                          theme === 'light' ? "text-slate-900 group-hover:text-cyan-600" : "text-white group-hover:text-cyan-300"
                        )}>Deep Research</h3>
                        <p className={cn(
                          "font-sans text-sm tracking-wide leading-relaxed max-w-md",
                          theme === 'light' ? "text-slate-600" : "text-white/60"
                        )}>Conduct structure-guided web synthesis, extracting multi-dimensional insights from public data with complete source transparency and concept modeling.</p>
                      </div>
                      <ChevronRight className={cn(
                        "w-8 h-8 transition-all duration-500 group-hover:translate-x-2",
                        theme === 'light' ? "text-slate-300 group-hover:text-cyan-600" : "text-white/20 group-hover:text-cyan-400"
                      )} />
                    </div>
                  </div>
                </motion.div>

                {/* Synthesis Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-4 group cursor-pointer"
                  onClick={() => document.getElementById('summarize')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <div className={cn(
                    "h-full backdrop-blur-xl border rounded-3xl p-8 hover:bg-white/5 transition-all duration-500 overflow-hidden relative group-hover:-translate-y-2",
                    theme === 'light'
                      ? "bg-white border-slate-200 shadow-[0_10px_30px_rgba(16,185,129,0.06)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.15)] hover:border-emerald-400"
                      : "bg-black/40 border-white/10 shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:border-emerald-500/50"
                  )}>
                    <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-colors duration-500" />
                    <div className="relative z-10 flex flex-col h-full">
                      <div className={cn(
                        "p-3 rounded-2xl w-fit mb-6 ring-1 group-hover:scale-110 transition-transform duration-500",
                        theme === 'light' ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30"
                      )}>
                        <LinkIcon className="w-8 h-8" />
                      </div>
                      <h3 className={cn(
                        "text-2xl font-display font-black uppercase tracking-widest mb-4 transition-colors",
                        theme === 'light' ? "text-slate-900 group-hover:text-emerald-600" : "text-white group-hover:text-emerald-300"
                      )}>Synthesis</h3>
                      <p className={cn(
                        "font-sans text-sm tracking-wide mb-8",
                        theme === 'light' ? "text-slate-600" : "text-white/60"
                      )}>Synthesize multi-modal resources, translating articles and video transcripts into clear scholarly briefs.</p>
                      <div className="mt-auto flex justify-end">
                        <ChevronRight className={cn(
                          "w-6 h-6 transition-all duration-500 group-hover:translate-x-2",
                          theme === 'light' ? "text-slate-300 group-hover:text-emerald-600" : "text-white/20 group-hover:text-emerald-400"
                        )} />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Integrity Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="lg:col-span-5 group cursor-pointer"
                  onClick={() => document.getElementById('plagiarism')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <div className={cn(
                    "h-full backdrop-blur-xl border rounded-3xl p-8 hover:bg-white/5 transition-all duration-500 overflow-hidden relative group-hover:-translate-y-2",
                    theme === 'light'
                      ? "bg-white border-slate-200 shadow-[0_10px_30px_rgba(239,68,68,0.06)] hover:shadow-[0_15px_40px_rgba(239,68,68,0.15)] hover:border-red-400"
                      : "bg-black/40 border-white/10 shadow-[0_0_30px_rgba(239,68,68,0.1)] hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:border-red-500/50"
                  )}>
                    <div className="absolute -top-32 -left-32 w-64 h-64 bg-red-500/10 blur-[100px] rounded-full group-hover:bg-red-500/20 transition-colors duration-500" />
                    <div className="relative z-10 flex flex-col h-full">
                      <div className={cn(
                        "p-3 rounded-2xl w-fit mb-6 ring-1 group-hover:scale-110 transition-transform duration-500",
                        theme === 'light' ? "bg-red-50 text-red-600 ring-red-200" : "bg-red-500/20 text-red-500 ring-red-500/30"
                      )}>
                        <ShieldAlert className="w-8 h-8" />
                      </div>
                      <h3 className={cn(
                        "text-2xl font-display font-black uppercase tracking-widest mb-4 transition-colors",
                        theme === 'light' ? "text-slate-900 group-hover:text-red-600" : "text-white group-hover:text-red-400"
                      )}>Integrity Guard</h3>
                      <p className={cn(
                        "font-sans text-sm tracking-wide mb-8",
                        theme === 'light' ? "text-slate-600" : "text-white/60"
                      )}>Assess structural originality of custom text documents and scan for machine-generation patterns.</p>
                      <div className="mt-auto flex justify-end">
                        <ChevronRight className={cn(
                          "w-6 h-6 transition-all duration-500 group-hover:translate-x-2",
                          theme === 'light' ? "text-slate-300 group-hover:text-red-600" : "text-white/20 group-hover:text-red-400"
                        )} />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Archive Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-7 group cursor-pointer"
                  onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <div className={cn(
                    "h-full backdrop-blur-xl border rounded-3xl p-8 hover:bg-white/5 transition-all duration-500 overflow-hidden relative group-hover:-translate-y-2",
                    theme === 'light'
                      ? "bg-white border-slate-200 shadow-[0_10px_30px_rgba(59,130,246,0.06)] hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)] hover:border-blue-400"
                      : "bg-black/40 border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.1)] hover:shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:border-blue-500/50"
                  )}>
                    <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-colors duration-500" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <div className={cn(
                          "p-3 rounded-2xl w-fit mb-6 ring-1 group-hover:scale-110 transition-transform duration-500",
                          theme === 'light' ? "bg-blue-50 text-blue-600 ring-blue-200" : "bg-blue-500/20 text-blue-400 ring-blue-500/30"
                        )}>
                          <History className="w-8 h-8" />
                        </div>
                        <h3 className={cn(
                          "text-3xl font-display font-black uppercase tracking-widest mb-4 transition-colors",
                          theme === 'light' ? "text-slate-900 group-hover:text-blue-600" : "text-white group-hover:text-blue-300"
                        )}>Archive</h3>
                        <p className={cn(
                          "font-sans text-sm tracking-wide leading-relaxed max-w-sm",
                          theme === 'light' ? "text-slate-600" : "text-white/60"
                        )}>Explore your persistent knowledge library containing historical research maps and documents, organized chronologically.</p>
                      </div>
                      <ChevronRight className={cn(
                        "w-8 h-8 transition-all duration-500 group-hover:translate-x-2",
                        theme === 'light' ? "text-slate-300 group-hover:text-blue-600" : "text-white/20 group-hover:text-blue-400"
                      )} />
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </Scroll3DSection>

          {/* Research Section */}
          <Scroll3DSection id="research">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-6xl mx-auto space-y-12"
            >
              <header className="space-y-4 text-center">
                <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter mix-blend-screen text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] uppercase">
                  ENTER <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 animate-pulse">LUMEN</span>
                </h1>
                <p className="text-white/60 text-sm md:text-base max-w-2xl mx-auto font-sans tracking-wide">
                  Initiate structured research synthesis and discover publication references
                </p>
              </header>

              <GlassCard className="p-2 border-white/20 shadow-[0_0_50px_-12px_rgba(139,92,246,0.5)]">
                <div className="flex flex-col md:flex-row gap-4 p-4">
                  <div className="flex-1 relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-cyan-400 w-6 h-6 z-10" />
                    <input
                      type="text"
                      placeholder="Enter a research topic, academic subject, or thesis query..."
                      className="w-full bg-black/60 border border-white/10 rounded-2xl py-6 pl-16 pr-16 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all font-sans text-white placeholder:text-white/30 text-lg shadow-inner"
                      value={researchTopic}
                      onChange={(e) => setResearchTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isResearching && researchTopic.trim()) {
                          handleResearch();
                        }
                      }}
                    />
                    {researchTopic && (
                      <button
                        onClick={() => setResearchTopic('')}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors z-20 bg-white/5 hover:bg-white/10 p-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer"
                        title="Clear input"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none blur-md"></div>
                  </div>
                  <Scroll3DButton 
                    glowColor="rgba(34,211,238,0.4)"
                    scrollContainerRef={scrollRef}
                    containerClassName="h-full"
                    onClick={() => handleResearch()}
                    disabled={isResearching || !researchTopic.trim()}
                    className="bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 text-white px-10 py-6 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-50 transition-all shrink-0 font-display tracking-wider uppercase shadow-xl h-full cursor-pointer select-none"
                  >
                    {isResearching ? (
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : <Sparkles className="w-6 h-6" />}
                    Initialize
                  </Scroll3DButton>
                </div>
                <div className="px-8 pb-4">
                  {/* Research Nodes Presets */}
                  <div className="mb-6">
                    <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest block mb-2 font-bold">Suggested Core Presets</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Neuromorphic AI Plasticity', topic: 'Neural plasticity and neuromorphic computing paradigms in 2025' },
                        { label: 'Quantum Superconductivity', topic: 'Recent breakthroughs in high-temperature ambient pressure superconductors' },
                        { label: 'Fusion Plasma Diagnostics', topic: 'Nuclear fusion plasma diagnostic controls using deep reinforcement learning' },
                        { label: 'Zero-Knowledge Cryptography', topic: 'Zero-knowledge cryptography scaling implementations in private trust networks' }
                      ].map((item, i) => (
                        <button
                          key={i}
                          disabled={isResearching}
                          onClick={() => setResearchTopic(item.topic)}
                          className={cn(
                            "text-[10px] px-3 py-1.5 rounded-xl border font-mono tracking-wider transition-all cursor-pointer disabled:opacity-50",
                            theme === 'light'
                              ? "bg-cyan-50/50 hover:bg-cyan-100 border-cyan-200 text-cyan-800"
                              : "bg-white/5 hover:bg-cyan-500/10 border-white/10 hover:border-cyan-500/30 text-cyan-400"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 mb-4">
                    <div className="flex-1">
                      <button className="text-sm text-white/40 hover:text-white/60 flex items-center gap-2 transition-all">
                        <MessageSquare className="w-4 h-4" />
                        <span>Add structural feedback or formatting preferences (APA, MLA, IEEE, etc.)</span>
                      </button>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['APA 7th', 'MLA 9th', 'Chicago', 'IEEE', 'Harvard'].map(style => (
                          <button 
                            key={style}
                            onClick={() => setFeedback(prev => `${prev}${prev ? ', ' : ''}Use ${style} citation style`)}
                            className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60"
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Industrial & Scholarly Analytical Lens */}
                    <div className="flex flex-col gap-2 md:items-start min-w-[200px]">
                      <span className="text-xs text-white/40 uppercase font-mono tracking-widest">Analytical Lens</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'default', label: 'General', title: 'Deep general framework' },
                          { id: 'academic', label: 'Scholarly', title: 'Rigorous peer analysis' },
                          { id: 'patent', label: 'Patent Claims', title: 'Industrial IP alignment' },
                          { id: 'socio-technical', label: 'Socio-Tech', title: 'Environmental & ethical impacts' },
                          { id: 'clinical', label: 'Clinical', title: 'Medical trials protocols' }
                        ].map(lens => (
                          <button
                            key={lens.id}
                            title={lens.title}
                            onClick={() => setAnalyticalLens(lens.id as any)}
                            className={cn(
                              "text-[10px] px-2.5 py-1.5 rounded-xl border transition-all font-mono tracking-wide cursor-pointer",
                              analyticalLens === lens.id
                                ? (theme === 'light'
                                  ? "bg-purple-100 border-purple-400 text-purple-800 font-bold"
                                  : "bg-purple-500/20 border-purple-400 text-purple-300 font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]")
                                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {lens.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:items-end">
                       <div className="flex items-center justify-between md:justify-end gap-2 w-full">
                         <span className="text-xs text-white/40 uppercase font-mono tracking-widest text-left md:text-right">Report Depth</span>
                         <button
                           type="button"
                           onClick={() => setShowAgentSettingsModal(true)}
                           className="text-[10px] px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                           title="Configure autonomous agent settings and loop criteria"
                         >
                           <Sliders className="w-3 h-3 text-purple-400" />
                           <span>Agent Config</span>
                         </button>
                       </div>
                       <div className="flex flex-wrap gap-2">
                         {['brief', 'standard', 'detailed'].map(level => (
                           <button
                             key={level}
                             onClick={() => {
                               setDetailLevel(level as any);
                               setAgentSettings(prev => ({
                                 ...prev,
                                 depth: level === 'brief' ? 'quick' : level === 'detailed' ? 'deep' : 'standard',
                                 maxIterations: level === 'brief' ? 4 : level === 'detailed' ? 8 : 6,
                               }));
                             }}
                             className={cn(
                               "text-[10px] px-3 py-1 rounded-full border transition-all font-mono uppercase tracking-wider cursor-pointer", 
                               detailLevel === level 
                                 ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]" 
                                 : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                             )}
                           >
                             {level}
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>
                  {true && (
                    <textarea
                      placeholder="e.g., Focus more on 2024 data, use APA citation style, include a technical methodology section."
                      className="w-full mt-3 bg-white/5 border border-white/5 rounded-xl p-3 text-sm focus:outline-none focus:border-white/20 transition-all h-20"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  )}
                </div>
              </GlassCard>

              {researchError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  <p className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Research Failed</p>
                  <p className="mt-1 opacity-80">{researchError}</p>
                </motion.div>
              )}

              <AnimatePresence>
                {isResearching && (
                  <motion.div
                    id="research-progress-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    key="researching-animation"
                    className="overflow-hidden space-y-4"
                  >
                    <AgentExecutionPanel 
                      progress={agentProgress} 
                      theme={theme} 
                      onResolveClarification={(resolvedQuery) => {
                        setResearchTopic(resolvedQuery);
                        handleResearch(resolvedQuery);
                      }} 
                    />
                    
                    <div className="flex justify-center mt-2 mb-2">
                      <button 
                        onClick={() => setAutoScrollToFindings(true)}
                        disabled={autoScrollToFindings}
                        className="px-5 py-2.5 border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-full font-mono text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {autoScrollToFindings ? (
                          <><Check className="w-3.5 h-3.5" /> Auto-Scroll Enabled</>
                        ) : (
                          <><Search className="w-3.5 h-3.5" /> Auto-Scroll To Findings When Finished</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {currentResearch && !isResearching && (
                <ResearchDocumentViewer currentResearch={currentResearch} onAppendToMemo={handleAppendToMemo} />
              )}

              <AgentSettingsModal
                isOpen={showAgentSettingsModal}
                onClose={() => setShowAgentSettingsModal(false)}
                settings={agentSettings}
                onSave={(newSettings) => {
                  setAgentSettings(newSettings);
                  if (newSettings.depth === 'quick') setDetailLevel('brief');
                  else if (newSettings.depth === 'deep') setDetailLevel('detailed');
                  else setDetailLevel('standard');
                }}
                theme={theme}
              />
            </motion.div>
          </Scroll3DSection>

          {/* Library Section (Only shown in library mode) */}
          </> 
          ) : null}

          {viewMode === 'library' && (
          <Scroll3DSection id="library">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-6xl mx-auto space-y-8 relative min-h-[500px]"
            >
              {!user && <FeatureLockOverlay onLockClick={handleSignIn} isSigningIn={isSigningIn} title="Schematics Locked" />}
              <div className={cn("space-y-8", !user && "opacity-20 pointer-events-none select-none")}>
                <div className="flex items-center gap-4 mb-12">
                  <div className="w-16 h-[2px] bg-cyan-500"></div>
                  <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tighter text-white">Interactive 3D <span className="text-cyan-400">Schematics</span></h2>
                </div>
                
                {currentResearch && currentResearch.conceptModels && currentResearch.conceptModels.length > 0 && (
                  <GlassCard className="p-8 border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.1)] mb-8">
                    <h3 className="text-xl font-display font-bold uppercase tracking-widest text-cyan-400 mb-6">Current Research</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {currentResearch.conceptModels.map((model, idx) => (
                        <div key={idx} className="space-y-4 group">
                          <div className="flex items-center justify-between px-2">
                            <h3 className="font-mono text-sm font-bold text-cyan-300">{model.term}</h3>
                            <span className="text-[10px] text-cyan-500/50 uppercase">[{model.type}]</span>
                          </div>
                          <ConceptModelViewer model={model} keepMounted={true} />
                          {model.apaCitation && (
                            <div className="mt-2 px-2">
                               <p className="text-[10px] text-white/40 font-mono tracking-wider mb-1">SYNTHESIZED MODEL CITATION</p>
                               <p className="text-xs text-white/60 font-serif leading-relaxed italic">{model.apaCitation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

                <GlassCard className="p-8 border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
                  <h3 className="text-xl font-display font-bold uppercase tracking-widest text-cyan-400/50 mb-6">Predefined Library</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {PREDEFINED_MODELS.map((model, idx) => (
                      <div key={idx} className="space-y-4 group">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="font-mono text-sm font-bold text-cyan-300">{model.title}</h3>
                          <span className="text-[10px] text-cyan-500/50 uppercase">[{model.type}]</span>
                        </div>
                        <ConceptModelViewer 
                           model={{
                             term: model.title,
                             type: model.type as any,
                             description: 'Pre-defined library model showcase.'
                           }} 
                        />
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          </Scroll3DSection>
          )}
          
          {viewMode === 'history' && (
          <Scroll3DSection id="history">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header>
                <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Research <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Archive</span>
                </h1>
                <p className="text-white/50 font-sans mt-2 text-sm tracking-wide">Your persistent historical research library</p>
              </header>

              {/* Category Filter Pills */}
              {user && history.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-4 overflow-x-auto border-b border-white/5">
                  <span className="text-xs font-mono font-bold text-white/40 uppercase tracking-widest mr-2">Filter Categories:</span>
                  {['All', 'Science', 'Technology', 'Medicine', 'History', 'Economics', 'Humanities', 'General'].map(cat => {
                    const count = cat === 'All' 
                      ? history.length 
                      : history.filter(item => getPaperCategory(item.topic, item.summary || "") === cat).length;
                    
                    if (cat !== 'All' && count === 0) return null; // Only show categories with items

                    const isSelected = archiveFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setArchiveFilter(cat)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-lg border uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer",
                          isSelected 
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-pulse" 
                            : "bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white"
                        )}
                      >
                        {cat}
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-md font-bold",
                          isSelected ? "bg-cyan-500/30 text-cyan-300" : "bg-white/10 text-white/40"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative min-h-[400px]">
                {!user && <FeatureLockOverlay onLockClick={handleSignIn} isSigningIn={isSigningIn} title="Archives Encrypted" />}
                <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", !user && "opacity-20 pointer-events-none select-none")}>
                  {filteredHistory.map((item, idx) => {
                    const category = getPaperCategory(item.topic, item.summary || "");
                    const badgeStyle = getCategoryBadgeStyle(category);
                    return (
                      <GlassCard 
                        key={item.id} 
                        delay={Math.min(idx * 0.1, 0.5)}
                        className="group cursor-pointer flex flex-col hover:border-cyan-500/50"
                        onClick={() => {
                          setSelectedHistoryResearch(item);
                        }}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 bg-black/40 border border-white/10 rounded-xl group-hover:border-cyan-500/30 transition-all shadow-inner">
                            <FileText className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300" />
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-xs text-cyan-500/50 font-mono">{item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded border tracking-widest",
                              badgeStyle.bg, badgeStyle.text, badgeStyle.border
                            )}>
                              {category}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-lg font-display font-bold tracking-wide mb-3 break-words group-hover:text-cyan-400 transition-colors uppercase">{item.topic}</h3>
                        <p className="text-sm text-white/50 line-clamp-3 mb-6 break-words flex-1 font-mono">{item.summary}</p>
                        <div className="flex items-center gap-4 text-xs text-white/30 font-mono pt-4 border-t border-white/5 mt-auto">
                          <span className="flex items-center gap-1"><History className="w-3 h-3 text-purple-400" /> {item.citations?.length || 0} Sources</span>
                          <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-cyan-400" /> {item.visualizations?.length || 0} Charts</span>
                        </div>
                      </GlassCard>
                    );
                  })}
                  {filteredHistory.length === 0 && history.length > 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <p className="text-white/40 font-mono text-sm">No research papers found in category "{archiveFilter}"</p>
                      <button 
                        onClick={() => setArchiveFilter('All')}
                        className="px-4 py-2 border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl font-mono text-xs uppercase cursor-pointer transition-all"
                      >
                        Reset Filter
                      </button>
                    </div>
                  )}
                  {history.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-6">
                      <div className="w-32 h-32 bg-black/40 rounded-full flex items-center justify-center mx-auto border border-white/10 border-dashed animate-pulse">
                        <Plus className="w-12 h-12 text-white/20" />
                      </div>
                      <p className="text-white/30 font-sans text-sm tracking-wide">Ready to store your synthesized analytical research cards</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </Scroll3DSection>
          )}

          {selectedHistoryResearch && (
            <div data-lenis-prevent onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl overflow-y-auto">
              <div className="min-h-screen p-6 md:p-12 relative pt-24">
                <button 
                  onClick={() => setSelectedHistoryResearch(null)} 
                  className="fixed top-6 right-6 p-4 bg-white/10 hover:bg-white/20 hover:scale-110 rounded-full z-[110] text-white shadow-xl backdrop-blur-md transition-all border border-white/20 focus:outline-none"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="max-w-7xl mx-auto">
                   <div className="flex items-center gap-4 mb-12">
                     <div className="w-16 h-[2px] bg-cyan-500"></div>
                     <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tighter text-white">Archived <span className="text-cyan-400">Research</span></h2>
                   </div>
                   <ResearchDocumentViewer currentResearch={selectedHistoryResearch} onAppendToMemo={handleAppendToMemo} />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'main' && (
          <>
          {/* Summarize Section */}
          <Scroll3DSection id="summarize">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto space-y-10"
            >
              <header className="text-center md:text-left">
                <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Media <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Synthesis</span>
                </h1>
                <p className="text-white/50 font-sans mt-2 text-sm tracking-wide">Synthesize online articles, lecture videos, and digital publications</p>
              </header>

              <GlassCard className="p-2 border-white/20 shadow-[0_0_40px_-5px_rgba(16,185,129,0.3)]">
                {!user && <FeatureLockOverlay onLockClick={handleSignIn} isSigningIn={isSigningIn} title="Decoder Node Locked" />}
                <div className="flex flex-col md:flex-row gap-4 p-4 pb-2">
                  <input
                    type="text"
                    placeholder="Paste YouTube video links, article URLs, or digital publications..."
                    className="flex-1 bg-black/80 border border-emerald-500/20 rounded-2xl p-6 focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 font-sans text-white/90 text-sm md:text-base placeholder:text-white/30"
                    value={summarizeUrl}
                    onChange={(e) => setSummarizeUrl(e.target.value)}
                  />
                  <Scroll3DButton 
                    glowColor="rgba(16,185,129,0.4)"
                    scrollContainerRef={scrollRef}
                    containerClassName="h-full"
                    onClick={handleSummarize}
                    disabled={isSummarizing || !summarizeUrl}
                    className="flex text-center items-center justify-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-emerald-500/50 text-white px-10 py-6 rounded-2xl font-bold transition-all disabled:opacity-50 font-display uppercase tracking-widest shrink-0 h-full shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-2xl"
                  >
                    {isSummarizing ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : <LinkIcon className="w-5 h-5" />}
                    {isSummarizing ? 'Processing...' : 'Synthesize'}
                  </Scroll3DButton>
                </div>
                <div className="px-4 pb-4 pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest font-bold">Suggested Targets:</span>
                  {[
                    { label: 'Quantum Computing Wiki', url: 'https://en.wikipedia.org/wiki/Quantum_computing' },
                    { label: 'Fusion Power Wiki', url: 'https://en.wikipedia.org/wiki/Fusion_power' },
                    { label: 'CRISPR Gene Editing Wiki', url: 'https://en.wikipedia.org/wiki/CRISPR_gene_editing' }
                  ].map((preset, i) => (
                    <button
                      key={i}
                      disabled={!user || isSummarizing}
                      onClick={() => setSummarizeUrl(preset.url)}
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-xl border font-mono tracking-wider transition-all cursor-pointer disabled:opacity-50",
                        theme === 'light'
                          ? "bg-emerald-50/50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
                          : "bg-white/5 hover:bg-emerald-500/10 border-white/10 hover:border-emerald-500/30 text-emerald-400"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <AnimatePresence>
                {isSummarizing && (
                  <ProcessingAnimation text="Extracting Telemetry..." colorHex="#10b981" />
                )}
              </AnimatePresence>

              {summaryResult && !isSummarizing && (
                <GlassCard className="border-emerald-500/20">
                  <h3 className="text-xl font-display font-bold tracking-widest uppercase mb-6 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-emerald-400" /> Extracted Telemetry
                  </h3>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-8 text-white/80 leading-relaxed whitespace-pre-wrap font-mono text-sm shadow-inner">
                    {summaryResult}
                  </div>
                </GlassCard>
              )}
            </motion.div>
          </Scroll3DSection>

          {/* Plagiarism Section */}
          <Scroll3DSection id="plagiarism" className="pb-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto space-y-10"
            >
              <header className="text-center md:text-left">
                <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Integrity <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Scaffold</span>
                </h1>
                <p className="text-white/50 font-sans mt-2 text-sm tracking-wide">Verify matching online publications and evaluate text for AI generation patterns</p>
              </header>

              <GlassCard className="p-2 border-white/20 shadow-[0_0_40px_-5px_rgba(239,68,68,0.3)]">
                {!user && <FeatureLockOverlay onLockClick={handleSignIn} isSigningIn={isSigningIn} title="Integrity Terminal Locked" />}
                <div className="p-4 flex flex-col items-end gap-4">
                  <textarea
                    placeholder="Insert your thesis, article draft, or custom essay here to verify its originality and screen for automated writing indicators..."
                    className="w-full bg-black/80 border border-red-500/20 rounded-2xl p-6 h-64 focus:outline-none focus:border-red-400/50 focus:ring-1 focus:ring-red-400/50 transition-all font-sans text-white/90 text-sm placeholder:text-white/30"
                    value={plagiarismText}
                    onChange={(e) => setPlagiarismText(e.target.value)}
                  />
                  <Scroll3DButton 
                    glowColor="rgba(239,68,68,0.4)"
                    scrollContainerRef={scrollRef}
                    containerClassName="w-full md:w-auto h-full"
                    onClick={handleCheckPlagiarism}
                    disabled={isChecking || !plagiarismText}
                    className="flex text-center items-center justify-center gap-3 w-full md:w-auto bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-red-500/50 text-white px-10 py-6 rounded-2xl font-bold transition-all disabled:opacity-50 font-display uppercase tracking-widest h-full shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-2xl"
                  >
                    {isChecking ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : <ShieldAlert className="w-5 h-5" />}
                    {isChecking ? 'Scanning...' : 'Initiate Scan'}
                  </Scroll3DButton>
                </div>
              </GlassCard>

              <AnimatePresence>
                {isChecking && (
                  <ProcessingAnimation text="Analyzing Integrity Matrix..." colorHex="#ef4444" />
                )}
              </AnimatePresence>

              {plagiarismResult && !isChecking && (
                <div className="space-y-6">
                  {plagiarismResult.aiProbability !== undefined && (() => {
                    const normalizedAIProbability = getNormalizedPercentage(plagiarismResult.aiProbability);
                    return (
                      <GlassCard className={cn(
                        plagiarismResult.aiGenerated 
                          ? "border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]" 
                          : plagiarismResult.plagiarized
                            ? "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
                            : "border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                      )}>
                        <div className="flex items-center gap-4 p-2">
                          {plagiarismResult.aiGenerated ? (
                            <div className="p-4 bg-purple-500/20 rounded-xl border border-purple-500/30">
                              <Bot className="w-8 h-8 text-purple-400" />
                            </div>
                          ) : plagiarismResult.plagiarized ? (
                            <div className="p-4 bg-amber-500/20 rounded-xl border border-amber-500/30">
                              <UserIcon className="w-8 h-8 text-amber-400" />
                            </div>
                          ) : (
                            <div className="p-4 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                              <UserIcon className="w-8 h-8 text-cyan-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="text-lg font-bold font-display uppercase tracking-widest text-white/90">
                              {plagiarismResult.aiGenerated 
                                ? "AI Generation Detected" 
                                : plagiarismResult.plagiarized
                                  ? "Human Authored (Matched Sources)"
                                  : "Likely Human Written (Original)"}
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="h-3 flex-1 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${normalizedAIProbability}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className={cn(
                                    "h-full", 
                                    plagiarismResult.aiGenerated 
                                      ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                                      : plagiarismResult.plagiarized
                                        ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                        : "bg-gradient-to-r from-cyan-500 to-emerald-500"
                                  )} 
                                />
                              </div>
                              <span className="font-mono text-xs font-bold text-white/70 w-12 text-right">
                                {normalizedAIProbability.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })()}

                  <GlassCard className={cn(plagiarismResult.plagiarized ? "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]" : "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]")}>
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                    {plagiarismResult.plagiarized ? (
                      <div className="p-4 bg-red-500/20 rounded-xl">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-500/20 rounded-xl">
                        <Sparkles className="w-10 h-10 text-emerald-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold">
                        {plagiarismResult.plagiarized ? "Potential Matches Found" : "Text Appears Original"}
                      </h3>
                      <p className="text-sm text-white/50">Based on indexed web data and publications.</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-xl font-bold mb-4">Annotated Source Text</h4>
                    <HighlightedPlagiarismText text={plagiarismText} matches={plagiarismResult.matches} />
                  </div>

                  {plagiarismResult.matches && plagiarismResult.matches.length > 0 && (
                    <div className="space-y-4">
                      {plagiarismResult.matches.map((match: any, i: number) => {
                        const severityColors = {
                          high: "text-red-400 bg-red-400/10 border-red-400/20",
                          medium: "text-orange-400 bg-orange-400/10 border-orange-400/20",
                          low: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
                        };
                        const strSeverity = (match.severity || 'high').toLowerCase() as 'high' | 'medium' | 'low';
                        const colorClass = severityColors[strSeverity] || severityColors.high;
                        
                        return (
                        <div key={i} className={cn("p-5 rounded-2xl border backdrop-blur-sm transition-all hover:bg-white/5", colorClass)}>
                          <div className="flex justify-between items-start mb-4 gap-4">
                            <h4 className="font-bold text-lg break-words flex-1 leading-tight text-white/90">{match.source}</h4>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={cn("px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider backdrop-blur-md border", colorClass)}>
                                {match.severity || 'High'} Severity
                              </span>
                              <span className={cn("px-3 py-1 rounded-md text-xs font-bold backdrop-blur-md border", colorClass)}>
                                {getNormalizedPercentage(match.similarity).toFixed(0)}% Match
                              </span>
                            </div>
                          </div>
                          
                          {match.matchedText && (
                            <div className="mb-4">
                              <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 pl-1">Matched Segment</div>
                              <div className="p-4 bg-black/40 rounded-xl font-mono text-sm text-white/70 border border-white/5 relative overflow-hidden group-hover:border-white/10 transition-colors">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-20" />
                                "{match.matchedText}"
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-white/70 mb-5 leading-relaxed">{match.explanation}</p>
                          <a href={match.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition-colors">
                            <LinkIcon className="w-3 h-3" />
                            View Original Source
                          </a>
                        </div>
                      )})}
                    </div>
                  )}
                </GlassCard>
                </div>
              )}
            </motion.div>
           </Scroll3DSection>


           </>
           )}
         </div>
       </main>

       {/* Floating Workspace Drawer Trigger */}
       {!showIntro && (
         <div className="fixed bottom-6 right-6 z-40">
           <button
             id="workspace-toggle-btn"
             onClick={() => setIsWorkspaceOpen(prev => !prev)}
             className={cn(
               "relative w-11 h-11 rounded-full border shadow-lg transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer",
               theme === 'light'
                 ? "bg-purple-600 border-purple-500 text-white hover:bg-purple-700"
                 : "bg-purple-950/80 backdrop-blur-md border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-900/90 hover:border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
             )}
             title="Open Interactive Workspace Notebook"
           >
             <BookOpen className="w-5 h-5" />
             {memoTasks.filter(t => !t.done).length > 0 && (
               <span className="absolute -top-1 -right-1 bg-cyan-400 text-slate-900 font-mono text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-purple-600 shadow-sm">
                 {memoTasks.filter(t => !t.done).length}
               </span>
             )}
           </button>
         </div>
       )}

       {/* Slide-out Workspace Drawer Panel */}
       <AnimatePresence>
         {isWorkspaceOpen && (
           <>
             {/* Backdrop Overlay */}
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 0.5 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsWorkspaceOpen(false)}
               className="fixed inset-0 bg-black z-45"
             />
             {/* Main Slide-out Container */}
             <motion.div
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className={cn(
                 "fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 shadow-2xl flex flex-col border-l overflow-hidden backdrop-blur-xl",
                 theme === 'light'
                   ? "bg-slate-50 border-slate-200 text-slate-800"
                   : "bg-slate-950/95 border-purple-900/30 text-white"
               )}
             >
               {/* Header */}
               <div className={cn(
                 "p-6 border-b flex items-center justify-between",
                 theme === 'light' ? "border-slate-200 bg-white" : "border-white/5 bg-black/40"
               )}>
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                     <BookOpen className="w-6 h-6" />
                   </div>
                   <div>
                     <h2 className="text-lg font-display font-black tracking-wider uppercase text-purple-400">Lumen Workspace</h2>
                     <p className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Workspace Notebook & Draft Planner</p>
                   </div>
                 </div>
                 <button
                   onClick={() => setIsWorkspaceOpen(false)}
                   className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                   title="Close Workspace"
                 >
                   <X className="w-5 h-5" />
                 </button>
               </div>

               {/* Scrollable Content Body */}
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Visual Progress Status */}
                 <div className={cn(
                   "p-4 rounded-2xl border",
                   theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/5"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold">Research Checklist Goals</span>
                     <span className="text-xs font-mono font-bold text-purple-400">
                       {memoTasks.filter(t => t.done).length}/{memoTasks.length} Done
                     </span>
                   </div>
                   <div className="w-full bg-slate-700/30 h-1.5 rounded-full overflow-hidden">
                     <div 
                       className="bg-purple-500 h-full transition-all duration-500" 
                       style={{ width: `${memoTasks.length > 0 ? (memoTasks.filter(t => t.done).length / memoTasks.length) * 100 : 0}%` }}
                     />
                   </div>
                 </div>

                 {/* Checklist Section */}
                 <div className="space-y-3">
                   <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Current Task List</span>
                   {/* Task Input */}
                   <div className="flex gap-2">
                     <input
                       type="text"
                       placeholder="Add draft/verification task..."
                       className={cn(
                         "flex-1 text-xs px-3 py-2 rounded-xl focus:outline-none border transition-all",
                         theme === 'light'
                           ? "bg-white border-slate-200 text-slate-800 focus:border-purple-400"
                           : "bg-black/45 border-white/10 text-white focus:border-purple-500/50"
                       )}
                       value={newMemoTaskText}
                       onChange={(e) => setNewMemoTaskText(e.target.value)}
                       onKeyPress={(e) => e.key === 'Enter' && handleAddMemoTask()}
                     />
                     <button
                       onClick={handleAddMemoTask}
                       className="px-3.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                     >
                       Add
                     </button>
                   </div>

                   {/* Tasks list */}
                   <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                     {memoTasks.length === 0 ? (
                       <p className="text-xs text-slate-500 font-mono pl-1">No pending checklist items.</p>
                     ) : (
                       memoTasks.map((task) => (
                         <div
                           key={task.id}
                           className={cn(
                             "flex items-center justify-between p-2 rounded-xl border text-xs transition-all",
                             task.done 
                               ? (theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-400 line-through" : "bg-purple-950/20 border-purple-500/10 text-slate-500 line-through")
                               : (theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/15 hover:border-white/15")
                           )}
                         >
                           <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                             <input
                               type="checkbox"
                               checked={task.done}
                               onChange={() => handleToggleMemoTask(task.id)}
                               className="accent-purple-500 rounded cursor-pointer w-4 h-4"
                             />
                             <span className="font-sans font-medium">{task.text}</span>
                           </label>
                           <button
                             onClick={() => handleRemoveMemoTask(task.id)}
                             className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                             title="Delete goal"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

                 {/* Interactive Memo Note Editor */}
                 <div className="space-y-3 flex-1 flex flex-col min-h-[220px]">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Notebook Workspace (Markdown)</span>
                     <button
                       onClick={() => {
                         navigator.clipboard.writeText(workspaceMemo);
                         setIsWorkspaceCopied(true);
                         setTimeout(() => setIsWorkspaceCopied(false), 2000);
                       }}
                       className="text-[10px] uppercase font-mono font-bold tracking-wider text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-500/10 px-2.5 py-1.5 rounded-lg border border-purple-500/20 cursor-pointer"
                     >
                       {isWorkspaceCopied ? (
                         <><Check className="w-3 h-3 text-emerald-400" /> COPIED</>
                       ) : (
                         <><Copy className="w-3 h-3" /> COPY NOTE</>
                       )}
                     </button>
                   </div>
                   <textarea
                     className={cn(
                       "w-full flex-1 p-4 rounded-2xl border text-xs leading-relaxed font-mono resize-none focus:outline-none min-h-[200px]",
                       theme === 'light'
                         ? "bg-white border-slate-200 text-slate-700 focus:border-purple-400"
                         : "bg-black/50 border-white/10 text-purple-200 focus:border-purple-500/50"
                     )}
                     value={workspaceMemo}
                     onChange={(e) => setWorkspaceMemo(e.target.value)}
                     placeholder="Refined insights, concepts, ideas, quotes, diagrams references..."
                   />
                   <div className="flex gap-2">
                     <button
                       onClick={() => setWorkspaceMemo('## Lumen Workspace Memo\n\nUse this interactive notebook to synthesize notes, outline drafts, and reference key discoveries.\n\n### Core Extracts:\n- No extracts captured yet. Use the "Send Extracts to Memo" buttons under research sections.\n')}
                       className="flex-1 py-2 text-center border border-white/10 hover:bg-white/5 rounded-xl text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-white transition-all cursor-pointer"
                     >
                       Reset Workspace Note
                     </button>
                   </div>
                 </div>
               </div>

               {/* Static Footer */}
               <div className="p-4 bg-black/20 border-t border-white/5 text-center">
                 <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">Lumen Coordinated Scholar Workflow</span>
               </div>
             </motion.div>
           </>
         )}
       </AnimatePresence>
        </div>
      )}
    </>
  );
}
