import { motion } from 'motion/react';
import { ArrowRight, Copy, Check, Cpu, ZapOff, Lock } from 'lucide-react';
import { useState } from 'react';

const INSTALL = 'npx qpcak build ./docs';

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard optional */
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#edebe9] flex flex-col items-center justify-between font-sans overflow-x-hidden relative selection:bg-[#edebe9] selection:text-[#111111]">

      <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full bg-[#181a1d] blur-[130px] pointer-events-none opacity-35"></div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center select-none z-10" id="landing-header">
        <h1 className="font-serif text-3xl font-normal tracking-[0.15em] text-[#edebe9] hover:opacity-90 transition-opacity">
          qpcak
        </h1>
        <a
          href="https://www.npmjs.com/package/qpcak"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#a89e90] hover:text-[#edebe9] transition-colors font-mono tracking-wide"
        >
          npm ↗
        </a>
      </header>

      {/* Main Hero Section */}
      <main className="w-full max-w-5xl px-6 flex flex-col items-center text-center py-4 z-10 select-none relative">
        <div className="w-full max-w-2xl relative z-10 flex flex-col items-center">

          {/* Postage-stamp artwork: the "browser layer" emblem */}
          <motion.div
            className="relative mb-10 group"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            id="postage-stamp-container"
          >
            <div className="absolute inset-2 bg-black/40 blur-md rounded-lg pointer-events-none transform translate-y-3 transition-transform group-hover:translate-y-4"></div>

            <div className="relative bg-[#faf9f6] p-4 flex items-center justify-center border-[2px] border-[#edebe9] shadow-sm transform rotate-[-1deg] hover:rotate-[1deg] transition-transform duration-500 ease-out">
              {/* Scalloped stamp edges */}
              <div className="absolute top-0 bottom-0 left-[-6px] flex flex-col justify-between py-1 pointer-events-none">
                {[...Array(9)].map((_, i) => (<div key={i} className="w-3 h-3 bg-[#111111] rounded-full border border-black/10"></div>))}
              </div>
              <div className="absolute top-0 bottom-0 right-[-6px] flex flex-col justify-between py-1 pointer-events-none">
                {[...Array(9)].map((_, i) => (<div key={i} className="w-3 h-3 bg-[#111111] rounded-full border border-black/10"></div>))}
              </div>
              <div className="absolute left-0 right-0 top-[-6px] flex justify-between px-1 pointer-events-none">
                {[...Array(7)].map((_, i) => (<div key={i} className="w-3 h-3 bg-[#111111] rounded-full border border-black/10"></div>))}
              </div>
              <div className="absolute left-0 right-0 bottom-[-6px] flex justify-between px-1 pointer-events-none">
                {[...Array(7)].map((_, i) => (<div key={i} className="w-3 h-3 bg-[#111111] rounded-full border border-black/10"></div>))}
              </div>

              {/* Inner illustration: a browser window holding a vector cluster */}
              <div className="w-[120px] h-[120px] md:w-[130px] md:h-[130px] bg-[#f4f2ee] border border-black/[0.06] flex items-center justify-center overflow-hidden relative">
                <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* browser frame */}
                  <rect x="18" y="22" width="64" height="56" rx="5" stroke="#1b1a18" strokeWidth="2.5" fill="#fbfaf7" />
                  <path d="M18 33 H82" stroke="#1b1a18" strokeWidth="2" />
                  <circle cx="25" cy="27.5" r="1.6" fill="#b5283f" />
                  <circle cx="31" cy="27.5" r="1.6" fill="#1b1a18" fillOpacity="0.35" />
                  <circle cx="37" cy="27.5" r="1.6" fill="#1b1a18" fillOpacity="0.35" />
                  {/* vector point cloud inside */}
                  {[
                    [34, 46], [44, 42], [40, 54], [52, 48], [60, 44],
                    [56, 58], [48, 62], [64, 56], [38, 62], [58, 68],
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="2.4" fill={i % 3 === 0 ? '#b5283f' : '#1b1a18'} fillOpacity={i % 3 === 0 ? 0.9 : 0.55} />
                  ))}
                  {/* connecting query lines */}
                  <path d="M52 48 L44 42 M52 48 L60 44 M52 48 L48 62" stroke="#b5283f" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
                  <text x="50" y="90" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="7" fill="#1b1a18" fillOpacity="0.6">WASM</text>
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
            id="landing-hero-titles"
          >
            <h2 className="font-serif text-[40px] md:text-[58px] font-normal leading-[1.08] tracking-tight text-[#edebe9]">
              Vector search,<br />
              in the browser<span className="text-[#a89e90]">.</span>
            </h2>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-base md:text-lg text-[#a89e90] max-w-lg mx-auto leading-relaxed font-light mb-9 tracking-wide"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            id="landing-hero-description"
          >
            The WebAssembly browser layer for Qdrant. Compress your content into a
            tiny TurboQuant pack and run semantic search locally — no backend, no
            per-query cost, fully offline.
          </motion.p>

          {/* Install command (replaces the email form) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
            id="install-container"
          >
            <button
              onClick={copy}
              className="group w-full relative flex items-center justify-between p-1.5 bg-[#1a1917] border border-[#2a2824] rounded-full overflow-hidden hover:border-[#403c36] transition-all duration-300 shadow-xl pl-5 pr-2 cursor-pointer"
            >
              <code className="text-sm font-mono text-[#edebe9] tracking-wide truncate">
                <span className="text-[#52504b]">$ </span>{INSTALL}
              </code>
              <span className="bg-[#ffffff] text-[#111111] group-hover:bg-[#eae4db] transition-colors rounded-full px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </span>
            </button>

            {/* feature row */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#8e857a] font-light tracking-wide">
              <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Private</span>
              <span className="flex items-center gap-1.5"><ZapOff className="w-3.5 h-3.5" /> Offline</span>
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> 28KB WASM</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom card: useful stats + how-it-works (replaces the Inbox teaser) */}
      <motion.div
        className="w-full max-w-4xl mx-auto px-6 overflow-hidden mt-6 translate-y-12 select-none pointer-events-auto"
        initial={{ opacity: 0, y: 150 }}
        animate={{ opacity: 1, y: 48 }}
        transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        id="landing-stats-card"
      >
        <div className="w-full text-left bg-[#fdfdfc] text-[#111111] rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.45)] border-t border-x border-[#eae9e6] p-7 md:p-9 block group">

          {/* Card header */}
          <div className="flex justify-between items-center border-b border-[#f4f3ef] pb-6 mb-6">
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-2xl tracking-tight text-[#1c1a17]">How it works</span>
              <span className="bg-[#f5e9ec] text-[#b5283f] text-xs font-bold font-mono px-2.5 py-0.5 rounded-full">TurboQuant</span>
            </div>
            <a
              href="https://www.npmjs.com/package/qpcak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#a09d94] font-light flex items-center gap-1.5 group-hover:text-[#635f54] transition-colors"
            >
              <span>Read the docs</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Pipeline */}
          <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#c0bcb2] font-mono mb-4">
            Pipeline
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-medium text-[#3a3732] mb-8">
            {['content', 'chunk', 'embed', 'TurboQuant', 'browser search'].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className={i === 3 ? 'text-[#b5283f]' : ''}>{step}</span>
                {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-[#cfcabf]" />}
              </span>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-[#faf9f6]">
            {[
              ['28 KB', 'WASM engine'],
              ['~2 MB', 'all Qdrant docs'],
              ['8×', 'smaller vectors'],
              ['97%', 'recall @10'],
            ].map(([num, label]) => (
              <div key={label}>
                <div className="font-serif text-3xl tracking-tight text-[#1c1a17]">{num}</div>
                <div className="text-xs text-[#8e857a] mt-1 tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
