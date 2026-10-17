import React, { useState, useEffect } from 'react';
import { 
  Bot, CheckCircle2, Circle, AlertCircle, Sparkles, 
  Search, ShieldCheck, Database, Layers, ArrowRight,
  TrendingUp, BookOpen, Clock, Activity, Cpu, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentProgressUpdate, AgentStatus, ResearchTask, ClarificationOption } from '../../types';
import { cn } from '../../lib/utils';

interface AgentExecutionPanelProps {
  progress: AgentProgressUpdate | null;
  theme?: 'dark' | 'light';
  onCancel?: () => void;
  onResolveClarification?: (resolvedQuery: string) => void;
}

const LIFECYCLE_STEPS = [
  { id: 'intent', label: 'Intent & Ambiguity', statusMatch: ['analyzing_intent', 'clarification_needed', 'planning', 'executing_task', 'evaluating_evidence', 'replanning', 'writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'plan', label: 'Dynamic Plan', statusMatch: ['planning', 'executing_task', 'evaluating_evidence', 'replanning', 'writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'search', label: 'Authoritative Tools', statusMatch: ['executing_task', 'evaluating_evidence', 'replanning', 'writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'evidence', label: 'Evidence Extraction', statusMatch: ['evaluating_evidence', 'replanning', 'writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'conflicts', label: 'Conflict Audit', statusMatch: ['evaluating_evidence', 'replanning', 'writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'synthesis', label: 'Grounded Synthesis', statusMatch: ['writing_report', 'reviewing_report', 'quality_gate', 'finalizing', 'completed'] },
  { id: 'quality', label: 'Quality Gate', statusMatch: ['quality_gate', 'finalizing', 'completed'] },
  { id: 'finalize', label: 'Finalize Paper', statusMatch: ['finalizing', 'completed'] },
];

export const AgentExecutionPanel: React.FC<AgentExecutionPanelProps> = ({
  progress,
  theme = 'dark',
  onResolveClarification,
}) => {
  if (!progress) return null;

  const currentStatus = progress.status;
  const isComplete = currentStatus === 'completed';
  const isError = currentStatus === 'error';
  const isClarificationNeeded = currentStatus === 'clarification_needed';

  const [customClarification, setCustomClarification] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);

  const optionsRef = React.useRef(progress.clarificationOptions);
  optionsRef.current = progress.clarificationOptions;
  const intentRef = React.useRef(progress.intent);
  intentRef.current = progress.intent;
  const callbackRef = React.useRef(onResolveClarification);
  callbackRef.current = onResolveClarification;

  // Auto-resolve timer if user doesn't interact, preventing perpetual 10% pause
  useEffect(() => {
    if (!isClarificationNeeded) {
      setCountdown(null);
      return;
    }

    setCountdown(12);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Default to option A or subject
          const fallbackChoice = optionsRef.current?.[0]?.resolvedQuery || intentRef.current?.interpretedSubject;
          if (fallbackChoice && callbackRef.current) {
            callbackRef.current(fallbackChoice);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isClarificationNeeded]);

  const effectiveOptions: ClarificationOption[] = (progress.clarificationOptions && progress.clarificationOptions.length > 0)
    ? progress.clarificationOptions
    : [
        {
          key: 'A',
          label: `Primary Subject: ${progress.intent?.interpretedSubject || 'Direct Topic'}`,
          description: 'Proceed with the core primary interpretation of this query',
          resolvedQuery: progress.intent?.interpretedSubject || progress.message || '',
        },
        {
          key: 'B',
          label: 'Comprehensive Cross-Domain Overview',
          description: 'Examine all related meanings and applications together in an integrated synthesis',
          resolvedQuery: `${progress.intent?.interpretedSubject || ''} comprehensive overview and applications`,
        }
      ];

  const getStepState = (stepIndex: number) => {
    const step = LIFECYCLE_STEPS[stepIndex];
    if (isComplete) return 'completed';
    if (isError) return 'failed';

    const currentStepIndex = (() => {
      switch (currentStatus) {
        case 'analyzing_intent':
        case 'clarification_needed': return 0;
        case 'planning': return 1;
        case 'executing_task': return 2;
        case 'evaluating_evidence':
        case 'replanning': return 3;
        case 'writing_report': return 5;
        case 'reviewing_report': return 5;
        case 'quality_gate': return 6;
        case 'finalizing': return 7;
        default: return 0;
      }
    })();

    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={cn(
        "w-full rounded-2xl border backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-500 my-6 relative",
        theme === 'light'
          ? "bg-white/95 border-cyan-500/20 shadow-[0_20px_50px_rgba(6,182,212,0.12)] text-slate-800"
          : "bg-black/85 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white"
      )}
    >
      {/* Top Ambient Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400">
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
          className="w-1/3 h-full bg-white blur-[2px] opacity-80"
        />
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-white/10 dark:border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Bot className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-lg md:text-xl uppercase tracking-wider">
                  Autonomous Research Agent
                </h3>
                {isClarificationNeeded ? (
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 uppercase font-black animate-pulse flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    Clarification Required
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-bold">
                    Active Loop
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-cyan-400/90 tracking-wide mt-0.5 flex items-center gap-1.5">
                {isClarificationNeeded ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 inline animate-bounce" />
                    Paused: Select your intended research subject below
                  </span>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 inline animate-pulse" />
                    {progress.stageTitle}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className={cn(
              "px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2",
              theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-white/80"
            )}>
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{progress.sourcesCount} Sources</span>
            </div>

            <div className={cn(
              "px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2",
              theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-white/80"
            )}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{progress.evidenceCount} Facts Verified</span>
            </div>

            <div className={cn(
              "px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2",
              theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-white/80"
            )}>
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Iter {progress.iteration}/{progress.maxIterations}</span>
            </div>
          </div>
        </div>

        {/* High-Level Lifecycle Pipeline */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono text-white/50 dark:text-white/50">
            <span className="uppercase tracking-widest font-bold">Agentic Lifecycle Pipeline</span>
            <span className="font-bold text-cyan-400">{progress.progressPercentage}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 p-0.5">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress.progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>

          {/* Step Pill Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const state = getStepState(idx);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "px-2.5 py-2 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 transition-all duration-300",
                    state === 'completed'
                      ? (theme === 'light' ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30")
                      : state === 'active'
                        ? (theme === 'light' ? "bg-cyan-50 text-cyan-800 border-cyan-400 font-bold shadow-sm" : "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]")
                        : (theme === 'light' ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white/5 text-white/30 border-white/5")
                  )}
                >
                  {state === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : state === 'active' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  )}
                  <span className="truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Active Status Message Card */}
        <div className={cn(
          "p-4 rounded-xl border flex items-center justify-between gap-4 shadow-inner",
          isClarificationNeeded 
            ? (theme === 'light' ? "bg-amber-50 border-amber-300" : "bg-amber-950/30 border-amber-500/40 text-amber-200")
            : (theme === 'light' ? "bg-cyan-50/60 border-cyan-200/80" : "bg-cyan-950/20 border-cyan-500/20")
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              isClarificationNeeded ? "bg-amber-400 animate-ping" : "bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"
            )} />
            <div className={cn(
              "truncate font-mono text-xs md:text-sm",
              isClarificationNeeded ? "text-amber-300 font-bold" : "text-cyan-300 dark:text-cyan-300"
            )}>
              <span className="text-white/40 dark:text-white/40 mr-2 font-bold">{">"}</span>
              {progress.message}
            </div>
          </div>
          {progress.currentTask?.toolUsed && (
            <span className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-bold">
              Tool: {progress.currentTask.toolUsed}
            </span>
          )}
        </div>

        {/* Interactive Query Ambiguity Clarification Panel */}
        {isClarificationNeeded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "p-6 md:p-7 rounded-2xl border-2 space-y-5 shadow-2xl relative overflow-hidden",
              theme === 'light' 
                ? "bg-amber-50/95 border-amber-400 text-slate-800 shadow-[0_10px_35px_rgba(245,158,11,0.15)]" 
                : "bg-gradient-to-b from-amber-950/40 to-black/90 border-amber-500/50 text-white shadow-[0_0_50px_rgba(245,158,11,0.2)]"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                  <AlertCircle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display font-black text-base md:text-lg uppercase tracking-wider text-amber-400">
                    Domain Ambiguity Detected — Selection Required
                  </h4>
                  <p className="text-xs font-mono text-white/80 dark:text-white/80 leading-relaxed max-w-2xl">
                    {progress.clarificationQuestion || "Multiple distinct meanings exist for this query. Select your intended research subject to start execution immediately:"}
                  </p>
                </div>
              </div>

              {countdown !== null && (
                <div className="flex items-center gap-2 shrink-0 bg-amber-500/15 border border-amber-500/30 px-3.5 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-[11px] font-mono text-amber-300">
                    Auto-start: <strong className="text-white font-bold">{countdown}s</strong>
                  </span>
                  <button
                    onClick={() => onResolveClarification?.(effectiveOptions[0].resolvedQuery)}
                    className="ml-1 text-[10px] uppercase font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded cursor-pointer transition-all"
                  >
                    Proceed
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {effectiveOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onResolveClarification?.(opt.resolvedQuery)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer group space-y-2 hover:scale-[1.01] active:scale-[0.99]",
                    theme === 'light'
                      ? "bg-white border-amber-300 hover:border-amber-500 hover:bg-amber-50 shadow-sm"
                      : "bg-white/5 border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/15 hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 group-hover:text-amber-300 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-black">
                        {opt.key}
                      </span>
                      {opt.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-[11px] text-white/70 dark:text-white/70 font-sans leading-relaxed pl-8">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Custom specification input */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 border-t border-amber-500/20">
              <span className="text-[11px] font-mono text-white/50 shrink-0">Custom context:</span>
              <input 
                type="text"
                placeholder="Or specify exact topic (e.g. DDR5 RAM desktop retail pricing)..."
                value={customClarification}
                onChange={(e) => setCustomClarification(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customClarification.trim()) {
                    onResolveClarification?.(customClarification.trim());
                  }
                }}
                className="w-full bg-black/50 border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs font-sans text-white focus:outline-none focus:border-amber-400 placeholder:text-white/30"
              />
              <button
                type="button"
                disabled={!customClarification.trim()}
                onClick={() => {
                  if (customClarification.trim()) {
                    onResolveClarification?.(customClarification.trim());
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono text-xs uppercase font-bold rounded-xl shrink-0 cursor-pointer transition-all"
              >
                Research
              </button>
            </div>
          </motion.div>
        )}

        {/* Bottom Section: 2 Columns (Dynamic Research Tasks + Live Action Stream) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left: Dynamic Research Plan Checklist (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-white/50 dark:text-white/50 font-bold flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Dynamic Research Plan
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                {progress.plan?.filter(t => t.status === 'completed').length || 0} / {progress.plan?.length || 0} Completed
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 select-none">
              {progress.plan && progress.plan.length > 0 ? (
                progress.plan.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 text-xs font-mono",
                      task.status === 'completed'
                        ? (theme === 'light' ? "bg-slate-50 border-emerald-500/30 text-slate-700" : "bg-white/5 border-emerald-500/30 text-white/90")
                        : task.status === 'in_progress'
                          ? (theme === 'light' ? "bg-cyan-50/80 border-cyan-400 text-cyan-900 font-semibold" : "bg-cyan-500/10 border-cyan-400 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]")
                          : (theme === 'light' ? "bg-slate-50/60 border-slate-200 text-slate-400" : "bg-white/5 border-white/5 text-white/40")
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : task.status === 'in_progress' ? (
                        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      ) : (
                        <Circle className="w-4 h-4 opacity-30" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{task.description}</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0",
                          task.type === 'quantitative'
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : task.type === 'evidence'
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        )}>
                          {task.type}
                        </span>
                      </div>

                      {task.status === 'completed' && task.resultSummary && (
                        <p className="text-[10px] text-white/50 dark:text-white/50 font-sans line-clamp-1">
                          {task.resultSummary}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs font-mono text-white/40">
                  Formulating tasks...
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Action Log Stream (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-white/50 dark:text-white/50 font-bold flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                Action Stream
              </span>
              <span className="text-[10px] font-mono text-white/40">Real-Time</span>
            </div>

            <div className={cn(
              "p-3 rounded-xl border h-64 overflow-y-auto space-y-2 font-mono text-[11px] leading-relaxed shadow-inner",
              theme === 'light' ? "bg-slate-100/80 border-slate-200" : "bg-black/60 border-white/10"
            )}>
              {progress.log && progress.log.length > 0 ? (
                progress.log.slice(-12).map((item) => (
                  <div key={item.id} className="flex items-start gap-2 border-b border-white/5 pb-1.5">
                    <span className="text-[9px] text-white/30 shrink-0">{item.timestamp}</span>
                    <span className={cn(
                      "shrink-0 font-bold text-[9px] px-1 rounded uppercase",
                      item.type === 'action' ? "bg-cyan-500/20 text-cyan-300" :
                      item.type === 'success' ? "bg-emerald-500/20 text-emerald-300" :
                      item.type === 'evaluation' ? "bg-purple-500/20 text-purple-300" :
                      item.type === 'warn' ? "bg-amber-500/20 text-amber-300" :
                      "bg-white/10 text-white/70"
                    )}>
                      {item.type}
                    </span>
                    <span className={cn(
                      "break-words flex-1",
                      theme === 'light' ? "text-slate-700" : "text-white/80"
                    )}>
                      {item.message}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-white/40 text-center py-8">
                  Stream initialized...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
