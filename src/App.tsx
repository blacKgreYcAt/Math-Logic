/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Hash, 
  Target, 
  BookOpen, 
  ChevronLeft, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Camera,
  Grid,
  Zap,
  Home,
  Delete,
  Smartphone
} from 'lucide-react';
import html2canvas from 'html2canvas';

// --- Types ---
type Mode = 'MENU' | 'GAME_24' | 'ARITHMETIC' | 'FACTORS' | 'DISTRIBUTIVE' | 'MULT_9X9' | 'MULT_19X19' | 'INSTRUCTIONS' | 'CHANGELOG';

interface GameState {
  numbers: number[];
  target: number;
  currentExpression: string;
  history: string[];
  message: string;
  isCorrect: boolean | null;
  solution: string | null;
  showHint: boolean;
  showSolution: boolean;
}

// --- Solver Logic ---
const solve24 = (numbers: number[], integerOnly: boolean = false): string | null => {
  const ops = ['+', '-', '*', '/'];
  const opSymbols = ['+', '-', '×', '÷'];

  interface Item {
    val: number;
    expr: string;
  }

  const solve = (items: Item[]): string | null => {
    if (items.length === 1) {
      if (Math.abs(items[0].val - 24) < 0.001) return items[0].expr;
      return null;
    }

    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;

        const nextItems = items.filter((_, idx) => idx !== i && idx !== j);
        const a = items[i];
        const b = items[j];

        for (let k = 0; k < ops.length; k++) {
          const op = ops[k];
          const symbol = opSymbols[k];
          let resVal = 0;
          
          if (op === '+') resVal = a.val + b.val;
          else if (op === '-') resVal = a.val - b.val;
          else if (op === '*') resVal = a.val * b.val;
          else if (op === '/') {
            if (Math.abs(b.val) < 0.001) continue;
            // For primary school level, we prefer divisions that result in integers
            if (integerOnly && a.val % b.val !== 0) continue;
            resVal = a.val / b.val;
          }

          const resExpr = `(${a.expr}${symbol}${b.expr})`;
          const result = solve([...nextItems, { val: resVal, expr: resExpr }]);
          if (result) return result;
        }
      }
    }
    return null;
  };

  return solve(numbers.map(n => ({ val: n, expr: n.toString() })));
};

// --- Components ---

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div 
    id="learning-screen"
    className="w-full flex-1 bg-black flex flex-col justify-center items-center p-4 font-sans text-white overflow-y-auto border-b border-white/5 min-h-0"
  >
    <div className="w-full flex flex-col justify-center items-center py-2">
      {children}
    </div>
  </div>
);

const DeviceButton = ({ 
  children, 
  onClick, 
  variant = 'num',
  className = '',
  isWide = false
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  variant?: 'num' | 'op' | 'func';
  className?: string;
  isWide?: boolean;
  key?: React.Key;
}) => {
  const baseStyles = "flex items-center justify-center rounded-2xl transition-all duration-500 active:scale-95 select-none w-full";
  const variants = {
    num: "bg-white/[0.03] text-white/80 text-2xl font-extralight hover:bg-white/[0.08] border border-white/5",
    op: "bg-white/[0.08] text-[#FF9F0A] text-3xl font-light hover:bg-white/[0.12] border border-white/10",
    func: "bg-white/10 text-white/60 text-xl font-light hover:bg-white/15 border border-white/10",
  };

  const heightClass = "h-12 sm:h-14";

  return (
    <button 
      onClick={onClick} 
      className={`${baseStyles} ${variants[variant]} ${heightClass} ${className}`}
    >
      {children}
    </button>
  );
};

const PortraitPrompt = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        <motion.div
          animate={{ 
            rotate: [90, 0],
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            repeatDelay: 0.5,
            ease: "easeInOut" 
          }}
          className="text-[#FF9F0A]"
        >
          <Smartphone size={80} strokeWidth={1} />
        </motion.div>
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 border-2 border-[#FF9F0A]/20 rounded-full scale-150"
        />
      </div>
      <motion.h2 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xl font-light tracking-[0.2em] mb-3 text-white"
      >
        請將手機直式擺放
      </motion.h2>
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-white/40 text-xs font-light tracking-[0.1em] uppercase"
      >
        以便顯示最佳效果
      </motion.p>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [showPrompt, setShowPrompt] = useState(true);
  const [mode, setMode] = useState<Mode>('MENU');
  const [gameState, setGameState] = useState<GameState>({
    numbers: [],
    target: 24,
    currentExpression: '',
    history: [],
    message: '',
    isCorrect: null,
    solution: null,
    showHint: false,
    showSolution: false,
  });

  // --- 24 Point Game Logic ---
  const start24Game = useCallback(() => {
    let newNumbers: number[] = [];
    let sol: string | null = null;
    
    // Ensure we generate a solvable puzzle suitable for primary school (integer steps)
    let attempts = 0;
    while (!sol && attempts < 500) {
      // Numbers 1-10 (standard primary school range)
      newNumbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10) + 1);
      // Try to find a solution that only uses integer intermediate steps
      sol = solve24(newNumbers, true);
      attempts++;
    }

    // If no integer-only solution found (unlikely), fallback to any solution
    if (!sol) {
      sol = solve24(newNumbers, false);
    }

    setGameState({
      numbers: newNumbers,
      target: 24,
      currentExpression: '',
      history: [],
      message: '',
      isCorrect: null,
      solution: sol,
      showHint: false,
      showSolution: false,
    });
  }, []);

  const handleInput = (val: string) => {
    setGameState(prev => ({
      ...prev,
      currentExpression: prev.currentExpression + val,
      message: ''
    }));
  };

  const handleBackspace = () => {
    setGameState(prev => ({
      ...prev,
      currentExpression: prev.currentExpression.slice(0, -1),
      message: ''
    }));
  };

  const clearInput = () => {
    setGameState(prev => ({ ...prev, currentExpression: '', isCorrect: null }));
  };

  const checkResult = () => {
    try {
      // Basic validation: must use all numbers exactly once
      const usedNumbers = gameState.currentExpression.match(/\d+/g)?.map(Number) || [];
      const sortedUsed = [...usedNumbers].sort();
      const sortedTarget = [...gameState.numbers].sort();

      if (JSON.stringify(sortedUsed) !== JSON.stringify(sortedTarget)) {
        setGameState(prev => ({ ...prev, message: '必須使用所有數字各一次！', isCorrect: false }));
        return;
      }

      // Evaluate expression safely
      // Note: In a real app, use a proper math parser. eval is used here for simplicity in this demo context.
      // We use Function instead of eval for slightly better practice, though still risky in general.
      const result = new Function(`return ${gameState.currentExpression.replace(/×/g, '*').replace(/÷/g, '/')}`)();
      if (Math.abs(result - 24) < 0.0001) {
        setGameState(prev => ({ ...prev, message: '太棒了！正確答案！', isCorrect: true }));
      } else {
        const formattedResult = Number.isInteger(result) ? result : Number(result.toFixed(2));
        setGameState(prev => ({ ...prev, message: `不對喔，結果是 ${formattedResult}`, isCorrect: false }));
      }
    } catch (e) {
      setGameState(prev => ({ ...prev, message: '算式格式錯誤！', isCorrect: false }));
    }
  };

  // --- Arithmetic Mode ---
  const [arithmeticProblem, setArithmeticProblem] = useState({ q: '', a: 0 });
  const [userAnswer, setUserAnswer] = useState('');

  const generateArithmetic = useCallback(() => {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    
    if (op === '-') {
      if (a < b) [a, b] = [b, a];
    }

    setArithmeticProblem({
      q: `${a} ${op} ${b}`,
      a: op === '+' ? a + b : op === '-' ? a - b : a * b
    });
    setUserAnswer('');
    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
  }, []);

  const checkArithmetic = () => {
    const val = parseInt(userAnswer);
    if (isNaN(val)) {
      setGameState(prev => ({ ...prev, isCorrect: false, message: '請先輸入答案喔！' }));
      return;
    }
    if (val === arithmeticProblem.a) {
      setGameState(prev => ({ ...prev, isCorrect: true, message: '答對了！' }));
    } else {
      setGameState(prev => ({ ...prev, isCorrect: false, message: `不對喔，正確答案是 ${arithmeticProblem.a}` }));
    }
  };

  // --- Factors Mode ---
  const [factorInput, setFactorInput] = useState('');
  const [factors, setFactors] = useState<number[]>([]);

  // --- Multiplication Mode ---
  const [multProblem, setMultProblem] = useState({ a: 1, b: 1, target: 1 });

  const generateMult = useCallback((max: number) => {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    setMultProblem({ a, b, target: a * b });
    setUserAnswer('');
    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
  }, []);

  const checkMult = () => {
    const val = parseInt(userAnswer);
    if (isNaN(val)) {
      setGameState(prev => ({ ...prev, isCorrect: false, message: '請先輸入答案喔！' }));
      return;
    }
    if (val === multProblem.target) {
      setGameState(prev => ({ ...prev, isCorrect: true, message: '答對了！太棒了！' }));
    } else {
      setGameState(prev => ({ ...prev, isCorrect: false, message: `不對喔，正確答案是 ${multProblem.target}` }));
    }
  };
  type DistributiveType = 'ADD_LEFT' | 'SUB_LEFT' | 'ADD_RIGHT' | 'SUB_RIGHT';
  const [distributiveProblem, setDistributiveProblem] = useState({ 
    a: 2, b: 3, c: 4, 
    type: 'ADD_LEFT' as DistributiveType 
  });

  const generateDistributive = useCallback(() => {
    const types: DistributiveType[] = ['ADD_LEFT', 'SUB_LEFT', 'ADD_RIGHT', 'SUB_RIGHT'];
    const type = types[Math.floor(Math.random() * types.length)];
    const a = Math.floor(Math.random() * 8) + 2;
    let b = Math.floor(Math.random() * 8) + 2;
    let c = Math.floor(Math.random() * 8) + 2;
    
    // For subtraction, ensure result is positive for primary school
    if (type.includes('SUB') && b < c) [b, c] = [c, b];
    if (type.includes('SUB') && b === c) b++;

    setDistributiveProblem({ a, b, c, type });
  }, []);

  const findFactors = () => {
    const num = parseInt(factorInput);
    if (isNaN(num) || num <= 0) {
      setGameState(prev => ({ ...prev, message: '請輸入正整數', isCorrect: false }));
      return;
    }
    setGameState(prev => ({ ...prev, message: '', isCorrect: null }));
    if (num > 1000000) {
      setGameState(prev => ({ ...prev, message: '數字太大囉！請輸入 1,000,000 以下的數字。', isCorrect: false }));
      return;
    }
    const f = [];
    for (let i = 1; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        f.push(i);
        if (i * i !== num) f.push(num / i);
      }
    }
    setFactors(f.sort((a, b) => a - b));
  };

  // --- Screenshot Logic ---
  const takeScreenshot = async () => {
    const element = document.getElementById('minimalist-device');
    if (!element) return;
    
    try {
      // Small delay to ensure any active animations are settled
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(element, {
        backgroundColor: '#000',
        scale: 2, // Balanced scale for quality and performance
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        removeContainer: true,
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `math-os-capture-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Screenshot failed:', err);
      alert('截圖失敗，請稍後再試。');
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (mode === 'GAME_24') start24Game();
    if (mode === 'ARITHMETIC') generateArithmetic();
    if (mode === 'DISTRIBUTIVE') generateDistributive();
    if (mode === 'MULT_9X9') generateMult(9);
    if (mode === 'MULT_19X19') generateMult(19);
  }, [mode, start24Game, generateArithmetic, generateDistributive, generateMult]);

  return (
    <div className="h-[100dvh] w-screen bg-black flex items-center justify-center overflow-hidden font-sans text-white selection:bg-[#FF9F0A]/30">
      <AnimatePresence>
        {showPrompt && <PortraitPrompt onComplete={() => setShowPrompt(false)} />}
      </AnimatePresence>

      <motion.div 
        id="minimalist-device"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] h-full max-h-[100dvh] bg-black flex flex-col p-4 sm:p-6 relative sm:rounded-[60px] border border-white/5 shadow-2xl overflow-hidden"
      >
        {/* Status Bar Area */}
        <div className="flex justify-between items-center mb-4 px-4 opacity-40 text-xs tracking-widest font-medium">
          <div className="flex items-center gap-2">
            <span>MATH.OS 2.4</span>
          </div>
          <div className="flex gap-4 items-center uppercase tracking-widest">
            <button 
              onClick={() => setMode('INSTRUCTIONS')}
              className="hover:text-white transition-colors"
            >
              使用說明
            </button>
            <span className="opacity-20">|</span>
            <button 
              onClick={() => setMode('CHANGELOG')}
              className="hover:text-white transition-colors"
            >
              更新日誌
            </button>
          </div>
        </div>

        {/* Screen Area */}
        <Screen>
          <AnimatePresence mode="wait">
            {mode === 'MENU' && (
              <motion.div 
                key="menu"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center"
              >
                <div className="text-[10px] text-[#FF9F0A] mb-2 font-medium tracking-[0.2em] uppercase">選擇模組</div>
                <div className="text-5xl font-extralight leading-tight tracking-tighter">數感邏輯</div>
              </motion.div>
            )}

            {mode === 'GAME_24' && (
              <motion.div 
                key="game24"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.1em] uppercase mb-1 opacity-70">24 點遊戲</div>
                <div className="flex justify-center gap-3 my-1 flex-wrap">
                  {gameState.numbers.map((n, i) => (
                    <motion.span 
                      key={i} 
                      initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                      className="text-3xl sm:text-4xl font-extralight text-white tabular-nums"
                    >
                      {n}
                    </motion.span>
                  ))}
                </div>
                <div className="text-3xl sm:text-4xl font-extralight tracking-tighter break-all mb-1 text-[#FF9F0A] min-h-[1.2em] flex items-center justify-center">
                  {gameState.currentExpression.replace(/\*/g, '×').replace(/\//g, '÷') || '0'}
                </div>
                
                <div className="min-h-[50px] flex flex-col items-center justify-center gap-1">
                  <motion.div 
                    key={gameState.message + (gameState.isCorrect ?? 'null')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`flex items-center justify-center gap-3 text-[14px] font-bold tracking-wide px-6 py-2 rounded-full shadow-md transition-colors duration-300 ${gameState.isCorrect === true ? 'text-green-400 bg-green-400/20 border border-green-400/30' : gameState.isCorrect === false ? 'text-red-400 bg-red-400/20 border border-red-400/30' : 'text-white/30 bg-white/5'}`}
                  >
                    {gameState.isCorrect === true && <CheckCircle2 size={14} />}
                    {gameState.isCorrect === false && <XCircle size={14} />}
                    <span>{gameState.message || '請輸入算式'}</span>
                  </motion.div>
                  
                  <AnimatePresence>
                    {(gameState.showHint || gameState.showSolution) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[10px] text-[#FF9F0A] font-mono tracking-wider bg-[#FF9F0A]/10 px-2.5 py-0.5 rounded-full border border-[#FF9F0A]/20"
                      >
                        {gameState.showSolution ? `解答: ${gameState.solution}` : `提示: ${gameState.solution?.substring(0, Math.floor((gameState.solution?.length || 0) / 2))}...`}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {mode === 'ARITHMETIC' && (
              <motion.div 
                key="arith"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.1em] uppercase mb-2 opacity-70">四則運算</div>
                <div className="text-3xl sm:text-4xl font-extralight mb-2 tracking-tighter text-white/90 break-words">
                  {arithmeticProblem.q} = ?
                </div>
                <div className="text-4xl sm:text-5xl font-extralight tracking-tighter break-all mb-2 text-[#FF9F0A] tabular-nums">
                  {userAnswer || '0'}
                </div>
                <motion.div 
                  key={gameState.message + (gameState.isCorrect ?? 'null')}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center justify-center gap-3 text-[14px] font-bold tracking-wide px-6 py-2 rounded-full shadow-md transition-colors duration-300 ${gameState.isCorrect === true ? 'text-green-400 bg-green-400/20 border border-green-400/30' : gameState.isCorrect === false ? 'text-red-400 bg-red-400/20 border border-red-400/30' : 'text-white/30 bg-white/5'}`}
                >
                  {gameState.isCorrect === true && <CheckCircle2 size={14} />}
                  {gameState.isCorrect === false && <XCircle size={14} />}
                  <span>{gameState.message || '請輸入答案'}</span>
                </motion.div>
              </motion.div>
            )}

            {(mode === 'MULT_9X9' || mode === 'MULT_19X19') && (
              <motion.div 
                key="mult"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="text-[12px] text-[#FF9F0A] font-bold tracking-[0.2em] uppercase opacity-90 mb-4">
                  {mode === 'MULT_9X9' ? '標準九九乘法' : '19x19 進階乘法'}
                </div>
                <div className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-2 leading-tight">
                  {multProblem.a} × {multProblem.b}
                </div>
                <div className="text-4xl font-light text-[#FF9F0A] min-h-[1.2em] mb-4 leading-tight">
                  {userAnswer || '?'}
                </div>
                <motion.div 
                  key={gameState.message + (gameState.isCorrect ?? 'null')}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center justify-center gap-3 text-[16px] font-bold tracking-wide px-8 py-3 rounded-full shadow-lg transition-colors duration-300 ${gameState.isCorrect === true ? 'text-green-400 bg-green-400/20 border border-green-400/30' : gameState.isCorrect === false ? 'text-red-400 bg-red-400/20 border border-red-400/30' : 'text-white/50 bg-white/10'}`}
                >
                  {gameState.isCorrect === true && <CheckCircle2 size={16} />}
                  {gameState.isCorrect === false && <XCircle size={16} />}
                  <span className="truncate">{gameState.message || '請輸入答案'}</span>
                </motion.div>
              </motion.div>
            )}
            {mode === 'FACTORS' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.1em] uppercase mb-2 opacity-70">因數尋找</div>
                <div className="text-4xl sm:text-5xl font-extralight tracking-tighter break-all mb-2 text-white">
                  {factorInput || '0'}
                </div>
                <div className="flex flex-wrap justify-center gap-3 max-h-32 overflow-y-auto px-4 mb-4">
                  {factors.map((f, i) => (
                    <span key={i} className="text-2xl font-light text-white/50">
                      {f}
                    </span>
                  ))}
                </div>
                <motion.div 
                  key={(gameState.message || factors.length) + (gameState.isCorrect ?? 'null')}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center justify-center gap-3 text-[14px] font-bold tracking-wide px-6 py-2 rounded-full shadow-md transition-colors duration-300 ${gameState.isCorrect === false ? 'text-red-400 bg-red-400/20 border border-red-400/30' : 'text-white/30 bg-white/5'}`}
                >
                  {gameState.isCorrect === false && <XCircle size={14} />}
                  <span>{gameState.message || (factors.length > 0 ? `找到 ${factors.length} 個因數` : '請輸入數字')}</span>
                </motion.div>
              </motion.div>
            )}

            {mode === 'DISTRIBUTIVE' && (
              <motion.div 
                key="dist"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-center flex flex-col items-center"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.1em] uppercase mb-2 opacity-70">
                  {distributiveProblem.type.includes('ADD') ? '加法分配律' : '減法分配律'}
                </div>
                
                <div className="text-2xl sm:text-3xl font-extralight tracking-tight mb-2 text-white break-words">
                  {distributiveProblem.type === 'ADD_LEFT' && `${distributiveProblem.a} × (${distributiveProblem.b} + ${distributiveProblem.c})`}
                  {distributiveProblem.type === 'SUB_LEFT' && `${distributiveProblem.a} × (${distributiveProblem.b} - ${distributiveProblem.c})`}
                  {distributiveProblem.type === 'ADD_RIGHT' && `(${distributiveProblem.b} + ${distributiveProblem.c}) × ${distributiveProblem.a}`}
                  {distributiveProblem.type === 'SUB_RIGHT' && `(${distributiveProblem.b} - ${distributiveProblem.c}) × ${distributiveProblem.a}`}
                </div>

                <div className="text-xl font-light text-white/40 mb-2">
                  = {distributiveProblem.type.includes('LEFT') ? 
                      `${distributiveProblem.a}×${distributiveProblem.b} ${distributiveProblem.type.includes('ADD') ? '+' : '-'} ${distributiveProblem.a}×${distributiveProblem.c}` :
                      `${distributiveProblem.b}×${distributiveProblem.a} ${distributiveProblem.type.includes('ADD') ? '+' : '-'} ${distributiveProblem.c}×${distributiveProblem.a}`
                    }
                </div>

                <div className="w-full border-t border-white/5 pt-2 mt-2">
                  <div className="text-2xl font-extralight text-[#FF9F0A]">
                    {distributiveProblem.type.includes('ADD') ? 
                      `${distributiveProblem.type.includes('LEFT') ? distributiveProblem.a : (distributiveProblem.b + distributiveProblem.c)} × ${distributiveProblem.type.includes('LEFT') ? (distributiveProblem.b + distributiveProblem.c) : distributiveProblem.a} = ${distributiveProblem.a * (distributiveProblem.b + distributiveProblem.c)}` :
                      `${distributiveProblem.type.includes('LEFT') ? distributiveProblem.a : (distributiveProblem.b - distributiveProblem.c)} × ${distributiveProblem.type.includes('LEFT') ? (distributiveProblem.b - distributiveProblem.c) : distributiveProblem.a} = ${distributiveProblem.a * (distributiveProblem.b - distributiveProblem.c)}`
                    }
                  </div>
                  <div className="text-lg font-light text-white/20 mt-1">
                    {distributiveProblem.type.includes('ADD') ?
                      `${distributiveProblem.a * distributiveProblem.b} + ${distributiveProblem.a * distributiveProblem.c} = ${distributiveProblem.a * distributiveProblem.b + distributiveProblem.a * distributiveProblem.c}` :
                      `${distributiveProblem.a * distributiveProblem.b} - ${distributiveProblem.a * distributiveProblem.c} = ${distributiveProblem.a * distributiveProblem.b - distributiveProblem.a * distributiveProblem.c}`
                    }
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'INSTRUCTIONS' && (
              <motion.div 
                key="instructions"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-left px-4"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.15em] uppercase mb-4 text-center">軟體使用說明 / INSTRUCTIONS</div>
                <div className="space-y-3 text-sm font-light leading-relaxed text-white/70">
                  <p><span className="text-[#FF9F0A] font-medium">● 24點遊戲：</span>運用加減乘除將四個數字湊成24。</p>
                  <p><span className="text-[#FF9F0A] font-medium">● 四則運算：</span>基礎數學心算練習，提升反應力。</p>
                  <p><span className="text-[#FF9F0A] font-medium">● 九九乘法：</span>熟練基礎 1x1 到 9x9 的乘法運算。</p>
                  <p><span className="text-[#FF9F0A] font-medium">● 19x19 乘法：</span>進階挑戰，延伸至 19x19 的乘法練習。</p>
                  <p><span className="text-[#FF9F0A] font-medium">● 因數尋找：</span>輸入數字，快速列出所有正因數。</p>
                  <p><span className="text-[#FF9F0A] font-medium">● 分配律演示：</span>視覺化呈現 a(b+c) = ab + ac。</p>
                </div>
              </motion.div>
            )}

            {mode === 'CHANGELOG' && (
              <motion.div 
                key="changelog"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="w-full text-left px-4"
              >
                <div className="text-[10px] text-[#FF9F0A] font-medium tracking-[0.15em] uppercase mb-4 text-center">更新日誌 / CHANGELOG</div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-[#FF9F0A] font-bold">v2.4 (Current)</p>
                    <p className="text-sm font-light text-white/70">優化 24 點遊戲的小數點顯示，修復細微錯誤並統一 UI 反饋。</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold">v2.3</p>
                    <p className="text-sm font-light text-white/50">新增「標準九九乘法」與「19x19 進階乘法」功能，優化選單配置。</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold">v2.2</p>
                    <p className="text-sm font-light text-white/50">優化截圖功能，加大紅色提示文字與說明文字，增加中英文名稱。</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 font-bold">v2.1</p>
                    <p className="text-sm font-light text-white/50">新增使用說明與更新日誌，優化紅色提示文字大小。</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 font-bold">v2.0</p>
                    <p className="text-sm font-light text-white/30">全新 Jony Ive 風格介面，中英雙語支援。</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Screen>

        {/* Controls Area */}
        <div className={`grid ${(mode === 'MENU' || mode === 'INSTRUCTIONS' || mode === 'CHANGELOG') ? 'grid-cols-1' : 'grid-cols-4'} gap-2 mt-auto mb-4 w-full px-2`}>
          {(mode === 'MENU' || mode === 'INSTRUCTIONS' || mode === 'CHANGELOG') ? (
            <div className="flex flex-col gap-6 w-full">
              {mode === 'MENU' ? (
                <div className="grid grid-cols-2 gap-3">
                  <DeviceButton variant="func" onClick={() => setMode('GAME_24')} className="text-lg tracking-tight h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">24 POINT</span>
                    <span>24點遊戲</span>
                  </DeviceButton>
                  <DeviceButton variant="op" onClick={() => setMode('ARITHMETIC')} className="text-lg h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">ARITHMETIC</span>
                    <span>四則運算</span>
                  </DeviceButton>
                  <DeviceButton variant="op" onClick={() => setMode('MULT_9X9')} className="text-lg h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">9x9 TABLE</span>
                    <span>九九乘法</span>
                  </DeviceButton>
                  <DeviceButton variant="func" onClick={() => setMode('MULT_19X19')} className="text-lg h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">19x19 EXT</span>
                    <span>19x19 乘法</span>
                  </DeviceButton>
                  <DeviceButton variant="op" onClick={() => setMode('FACTORS')} className="text-lg h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">FACTORS</span>
                    <span>因數尋找</span>
                  </DeviceButton>
                  <DeviceButton variant="func" onClick={() => setMode('DISTRIBUTIVE')} className="text-lg tracking-tight h-20 flex-col gap-1">
                    <span className="text-[10px] opacity-50 font-medium tracking-widest">DISTRIBUTIVE</span>
                    <span>分配律演示</span>
                  </DeviceButton>
                </div>
              ) : (
                <div className="flex justify-center">
                  <DeviceButton 
                    variant="func" 
                    onClick={() => setMode('MENU')} 
                    className="h-16 w-40 flex-col gap-1 border-[#FF9F0A]/30"
                  >
                    <ChevronLeft size={24} className="text-[#FF9F0A]" strokeWidth={2.5} />
                    <span className="text-[10px] text-[#FF9F0A] font-bold tracking-tighter">BACK TO MENU / 返回主選單</span>
                  </DeviceButton>
                </div>
              )}
              
              {mode === 'MENU' && (
                <div className="h-4" />
              )}
            </div>
          ) : (
            <>
              {/* Row 1 */}
              <DeviceButton 
                variant="func" 
                onClick={() => {
                  if (mode === 'GAME_24') handleBackspace();
                  else if (mode === 'ARITHMETIC' || mode === 'MULT_9X9' || mode === 'MULT_19X19') {
                    setUserAnswer(prev => prev.slice(0, -1));
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                  else if (mode === 'FACTORS') {
                    setFactorInput(prev => prev.slice(0, -1));
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                }} 
                className="flex-col gap-1 border-[#FF9F0A]/30"
              >
                <Delete size={24} className="text-[#FF9F0A]" strokeWidth={2.5} />
                <span className="text-[10px] text-[#FF9F0A] font-bold tracking-tighter uppercase">Undo / 回推</span>
              </DeviceButton>
              <DeviceButton variant="func" onClick={() => {
                if (mode === 'GAME_24' && gameState.currentExpression === '') {
                  start24Game();
                } else {
                  clearInput();
                  setGameState(prev => ({ ...prev, currentExpression: '', isCorrect: null, message: '' }));
                  setUserAnswer('');
                  setFactorInput('');
                  setFactors([]);
                }
              }}>
                {mode === 'GAME_24' && gameState.currentExpression === '' ? 'New' : 'AC'}
              </DeviceButton>
              <DeviceButton variant="func" onClick={() => {
                if (mode === 'GAME_24') start24Game();
                else if (mode === 'ARITHMETIC') generateArithmetic();
                else if (mode === 'DISTRIBUTIVE') generateDistributive();
                else if (mode === 'MULT_9X9') generateMult(9);
                else if (mode === 'MULT_19X19') generateMult(19);
                else if (mode === 'FACTORS') { setFactorInput(''); setFactors([]); }
              }}>
                Next
              </DeviceButton>
              <DeviceButton variant="func" onClick={() => {
                if (mode === 'GAME_24') setGameState(prev => ({ ...prev, showHint: !prev.showHint }));
              }}>
                {mode === 'GAME_24' ? (gameState.showHint ? 'Sol' : 'Hint') : '.'}
              </DeviceButton>

              {/* Row 2 */}
              {[7, 8, 9].map(n => (
                <DeviceButton key={n} onClick={() => {
                  if (mode === 'GAME_24') handleInput(n.toString());
                  if (mode === 'ARITHMETIC' || mode === 'MULT_9X9' || mode === 'MULT_19X19') {
                    setUserAnswer(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                  if (mode === 'FACTORS') {
                    setFactorInput(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                }}>{n}</DeviceButton>
              ))}
              <DeviceButton variant="op" onClick={() => {
                if (mode === 'GAME_24') handleInput('/');
              }}>÷</DeviceButton>

              {/* Row 3 */}
              {[4, 5, 6].map(n => (
                <DeviceButton key={n} onClick={() => {
                  if (mode === 'GAME_24') handleInput(n.toString());
                  if (mode === 'ARITHMETIC' || mode === 'MULT_9X9' || mode === 'MULT_19X19') {
                    setUserAnswer(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                  if (mode === 'FACTORS') {
                    setFactorInput(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                }}>{n}</DeviceButton>
              ))}
              <DeviceButton variant="op" onClick={() => {
                if (mode === 'GAME_24') handleInput('*');
              }}>×</DeviceButton>

              {/* Row 4 */}
              {[1, 2, 3].map(n => (
                <DeviceButton key={n} onClick={() => {
                  if (mode === 'GAME_24') handleInput(n.toString());
                  if (mode === 'ARITHMETIC' || mode === 'MULT_9X9' || mode === 'MULT_19X19') {
                    setUserAnswer(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                  if (mode === 'FACTORS') {
                    setFactorInput(prev => prev + n);
                    setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                  }
                }}>{n}</DeviceButton>
              ))}
              <DeviceButton variant="op" onClick={() => {
                if (mode === 'GAME_24') handleInput('-');
              }}>−</DeviceButton>

              {/* Row 5 */}
              <DeviceButton isWide onClick={() => {
                if (mode === 'GAME_24') handleInput('0');
                if (mode === 'ARITHMETIC' || mode === 'MULT_9X9' || mode === 'MULT_19X19') {
                  setUserAnswer(prev => prev + '0');
                  setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                }
                if (mode === 'FACTORS') {
                  setFactorInput(prev => prev + '0');
                  setGameState(prev => ({ ...prev, isCorrect: null, message: '' }));
                }
              }} className="col-span-2">0</DeviceButton>
              <DeviceButton variant="op" onClick={() => {
                if (mode === 'GAME_24') handleInput('+');
              }}>+</DeviceButton>
              <DeviceButton variant="func" onClick={() => {
                if (mode === 'GAME_24') handleInput('(');
              }}>
                {mode === 'GAME_24' ? '(' : 'New'}
              </DeviceButton>

              {/* Row 6 */}
              <DeviceButton variant="op" isWide onClick={() => {
                if (mode === 'GAME_24') checkResult();
                if (mode === 'ARITHMETIC') checkArithmetic();
                if (mode === 'MULT_9X9' || mode === 'MULT_19X19') checkMult();
                if (mode === 'FACTORS') findFactors();
              }} className="col-span-2 bg-[#FF9F0A] text-black hover:bg-[#FF9F0A]/90 border-none shadow-[0_0_20px_rgba(255,159,10,0.3)]">
                ENTER
              </DeviceButton>
              <DeviceButton variant="func" onClick={() => {
                if (mode === 'GAME_24') handleInput(')');
                else setMode('MENU');
              }}>
                {mode === 'GAME_24' ? ')' : 'Menu'}
              </DeviceButton>
              <DeviceButton variant="func" onClick={() => setMode('MENU')}>
                <Home size={18} />
              </DeviceButton>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto mb-2 text-center">
          <div className="text-[9px] text-white/20 font-light tracking-widest uppercase">
            © 2026 BERK STUDIO 數感邏輯 
            <a 
              href="mailto:glitch.remover_1i@icloud.com" 
              className="ml-2 hover:text-white transition-colors underline decoration-white/10 underline-offset-4"
            >
              聯繫我們
            </a>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1 bg-white/20 rounded-full mx-auto mb-2" />
      </motion.div>
    </div>
  );
}
