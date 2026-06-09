import { useState, useEffect, useRef } from 'react';
import { StrategyType, SweatRateType, InputKey, GelPreset, SplitCheckpoint, FuelEvent } from './types';
import { formatTime, formatPace, calculateSplits, calculateNutrition, getSegmentPace } from './utils';
import PaceChartCanvas from './components/PaceChartCanvas';
import {
  Zap,
  Droplet,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Flame,
  ChevronRight,
  Activity,
  Award,
  CircleAlert,
  Compass,
  Sparkles,
  Milestone,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

const GEL_PRESETS: GelPreset[] = [
  { id: 'standard', name: 'GEL ESTÁNDAR COMPACT', carbs: 25, description: 'Fórmula básica (maltodextrina). Absorción moderada.' },
  { id: 'hi-carb', name: 'GEL DE ALTA CONCENTRACIÓN', carbs: 40, description: 'Relación 1:0.8 glucosa-fructosa (Maurten style).' },
  { id: 'liquid', name: 'LIQUID CARBS DRINK MIX', carbs: 60, description: 'Sobres de mezcla líquida concentrada para bidón.' }
];

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'calculator' | 'nutrition'>('calculator');

  // Input states (stored as strings to allow natural typing/erasing)
  const [distVal, setDistVal] = useState<string>('');
  const [paceMin, setPaceMin] = useState<string>('');
  const [paceSeg, setPaceSeg] = useState<string>('');
  const [timeHr, setTimeHr] = useState<string>('');
  const [timeMin, setTimeMin] = useState<string>('');
  const [timeSeg, setTimeSeg] = useState<string>('');

  // Track user input history sequence for 3-Way calculation
  const [inputHistory, setInputHistory] = useState<InputKey[]>([]);

  // Tactical strategy variables
  const [strategy, setStrategy] = useState<StrategyType>('even');
  const [interval, setIntervalVal] = useState<number>(1.0);
  const [isCustomIntervalActive, setIsCustomIntervalActive] = useState<boolean>(false);
  const [customIntervalValue, setCustomIntervalValue] = useState<string>('0.4');

  // Nutrition sub-states
  const [selectedGelId, setSelectedGelId] = useState<string>('hi-carb');
  const [sweatRate, setSweatRate] = useState<SweatRateType>('normal');

  // Numeric parsers helper
  const getParsedDistance = () => parseFloat(distVal) || 0;
  const getParsedPaceSeconds = () => {
    const mins = parseInt(paceMin, 10) || 0;
    const secs = parseInt(paceSeg, 10) || 0;
    return mins * 60 + secs;
  };
  const getParsedTimeSeconds = () => {
    const hrs = parseInt(timeHr, 10) || 0;
    const mins = parseInt(timeMin, 10) || 0;
    const secs = parseInt(timeSeg, 10) || 0;
    return hrs * 3600 + mins * 60 + secs;
  };

  // Dynamically update calculations based on edited inputs and history logic
  const handleInputChange = (key: InputKey, name: string, val: string) => {
    // Sanitize values
    let cleanVal = val.replace(/[^0-9.]/g, '');

    // Set target state
    if (key === 'distancia') {
      setDistVal(cleanVal);
    } else if (key === 'ritmo') {
      if (name === 'min') setPaceMin(cleanVal);
      if (name === 'seg') setPaceSeg(cleanVal);
    } else if (key === 'tiempo') {
      if (name === 'hr') setTimeHr(cleanVal);
      if (name === 'min') setTimeMin(cleanVal);
      if (name === 'seg') setTimeSeg(cleanVal);
    }

    // Update historical sequence of inputs to decide which one to recalculate
    setInputHistory((prev) => {
      const filtered = prev.filter((item) => item !== key);
      const updated = [...filtered, key];
      if (updated.length > 2) {
        updated.shift(); // keep last 2 edited variables
      }
      return updated;
    });
  };

  // Compute calculated values reactively when inputs or input history changes
  useEffect(() => {
    if (inputHistory.length < 2) return;

    // The calculated target is the variable NOT in the last 2 edited variables
    const allVars: InputKey[] = ['ritmo', 'distancia', 'tiempo'];
    const targetCalculate = allVars.find((v) => !inputHistory.includes(v)) || 'tiempo';

    const d = parseFloat(distVal) || 0;
    const pMin = parseInt(paceMin, 10) || 0;
    const pSeg = parseInt(paceSeg, 10) || 0;
    const pSec = pMin * 60 + pSeg;

    const tHr = parseInt(timeHr, 10) || 0;
    const tMin = parseInt(timeMin, 10) || 0;
    const tSeg = parseInt(timeSeg, 10) || 0;
    const tSec = tHr * 3600 + tMin * 60 + tSeg;

    if (targetCalculate === 'tiempo') {
      if (d > 0 && pSec > 0) {
        const calculatedTimeSec = d * pSec;
        const h = Math.floor(calculatedTimeSec / 3600);
        const m = Math.floor((calculatedTimeSec % 3600) / 60);
        const s = Math.round(calculatedTimeSec % 60);

        setTimeHr(h > 0 ? h.toString() : '0');
        setTimeMin(m.toString().padStart(2, '0'));
        setTimeSeg(s.toString().padStart(2, '0'));
      }
    } else if (targetCalculate === 'ritmo') {
      if (d > 0 && tSec > 0) {
        const calculatedPaceSec = Math.round(tSec / d);
        const m = Math.floor(calculatedPaceSec / 60);
        const s = calculatedPaceSec % 60;

        setPaceMin(m.toString());
        setPaceSeg(s.toString().padStart(2, '0'));
      }
    } else if (targetCalculate === 'distancia') {
      if (pSec > 0 && tSec > 0) {
        const calculatedDistance = tSec / pSec;
        setDistVal(calculatedDistance.toFixed(2));
      }
    }
  }, [inputHistory, distVal, paceMin, paceSeg, timeHr, timeMin, timeSeg]);

  // Handle Preset Fast Buttons
  const handlePresetDistance = (km: number) => {
    setDistVal(km.toFixed(2));
    setInputHistory((prev) => {
      const filtered = prev.filter((item) => item !== 'distancia');
      const updated = [...filtered, 'distancia'];
      if (updated.length > 2) updated.shift();
      return updated;
    });
  };

  // Reset calculator to clean defaults
  const resetCalculator = () => {
    setDistVal('');
    setPaceMin('');
    setPaceSeg('');
    setTimeHr('');
    setTimeMin('');
    setTimeSeg('');
    setInputHistory([]);
    setStrategy('even');
    setIntervalVal(1.0);
    setIsCustomIntervalActive(false);
  };

  // Calculate high-fidelity metrics
  const activeDistance = getParsedDistance();
  const activePaceSec = getParsedPaceSeconds();
  const activeTimeSec = getParsedTimeSeconds();

  const currentSplits: SplitCheckpoint[] = calculateSplits(
    activeDistance,
    activePaceSec,
    interval,
    strategy
  );

  const selectedGel = GEL_PRESETS.find((g) => g.id === selectedGelId) || GEL_PRESETS[1];
  const nutritionPlan = calculateNutrition(
    activeDistance,
    activePaceSec,
    sweatRate,
    selectedGel.carbs
  );

  // Sweat rate configuration buttons helper
  const sweatRateOptions: { id: SweatRateType; label: string }[] = [
    { id: 'low', label: 'METABOLISMO SECO (BAJO)' },
    { id: 'normal', label: 'SUDORACIÓN ESTÁNDAR' },
    { id: 'high', label: 'TASA CRÍTICA DE SUDOR' },
  ];

  const isDistCalculated = inputHistory.length === 2 && !inputHistory.includes('distancia');
  const isDistEntered = inputHistory.includes('distancia');

  const isPaceCalculated = inputHistory.length === 2 && !inputHistory.includes('ritmo');
  const isPaceEntered = inputHistory.includes('ritmo');

  const isTimeCalculated = inputHistory.length === 2 && !inputHistory.includes('tiempo');
  const isTimeEntered = inputHistory.includes('tiempo');

  return (
    <div className="relative text-foam-cream font-sans min-h-screen flex flex-col justify-between selection:bg-neon-lime selection:text-carbon bg-[#08090a]">

      {/* HEADER FIJO */}
      <header className="border-b border-white/10 bg-black/90 backdrop-blur-md sticky top-0 z-50 py-4">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-neon-lime text-carbon font-extrabold px-3 py-0.5 text-[9px] tracking-wider uppercase">
              Planificación Inteligente para Corredores
            </span>
            <span className="font-extrabold tracking-tight text-white text-md">
              RUNNING<span className="text-neon-lime">.LAB</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Tab switch controller */}
            <nav className="flex bg-zinc-900/60 p-1 border border-white/5 font-mono text-[10px] font-bold">
              <button
                onClick={() => setActiveTab('calculator')}
                className={`px-3 py-1.5 transition-all ${
                  activeTab === 'calculator'
                    ? 'bg-neon-lime text-black font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CÁLCULO DE PASOS Y TIEMPO
              </button>
              <button
                onClick={() => setActiveTab('nutrition')}
                className={`px-3 py-1.5 transition-all ${
                  activeTab === 'nutrition'
                    ? 'bg-crimson-x text-white font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                PLAN DE HIDRATACIÓN Y GEL
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* RENDER VIEW: CALCULATOR */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 w-full py-8 md:py-12 flex-1">
        
        {activeTab === 'calculator' ? (
          <div className="space-y-8 animate-fade-in">
            {/* ENCABEZADO DE TRABAJO GENERAL */}
            <div className="border-4 border-white bg-black text-foam-cream p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              <div className="relative z-10 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-zinc-800 text-zinc-300 font-mono font-bold px-2 py-0.5 text-[9px] uppercase tracking-wider">
                    Herramienta de Análisis
                  </span>
                  <span className="text-[10px] font-mono tracking-widest text-zinc-500">// CALCULADORA TRIPLE REACTIVA</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase">
                  CALCULADORA DE RITMOS Y <span className="text-neon-lime">TIEMPOS</span>
                </h1>
                <p className="text-xs text-zinc-400 font-mono">
                  Ingrese dos variables cualesquiera para determinar automáticamente la tercera en tiempo real.
                </p>
              </div>

              <div className="font-mono text-[10px] text-zinc-400 border-t md:border-t-0 md:border-l border-neutral-800 pt-4 md:pt-0 md:pl-6 space-y-1 relative z-10">
                <div className="flex gap-2">
                  <span className="text-zinc-500">MÉTRICA ACTIVA:</span>
                  <span className="text-white font-bold uppercase">{strategy === 'even' ? 'Ritmo Constante' : 'Estrategia Progresiva'}</span>
                </div>
              </div>
            </div>

            {/* GRILLA PRINCIPAL DE LA CALCULADORA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* COLUMNA IZQUIERDA: INPUTS MONOLÍTICOS */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* PILA DE INPUTS DE TRES VÍAS */}
                <div className="border-4 border-white bg-black divide-y-2 divide-white shadow-2xl">
                  
                  {/* FILA 1: DISTANCIA */}
                  <div className={`p-6 space-y-3 relative transition-all duration-200 ${
                    isDistCalculated 
                      ? 'bg-neon-lime/[0.03] border-l-4 border-l-neon-lime'
                      : isDistEntered
                        ? 'hover:bg-neutral-950/45 border-l-4 border-l-neutral-400'
                        : 'hover:bg-neutral-950/20 border-l-4 border-l-transparent'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-[#7E8694]">DISTANCIA DEL RECORRIDO</span>
                      <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded transition-all duration-150 relative z-10 ${
                        isDistCalculated 
                          ? 'border border-neon-lime text-neon-lime bg-neon-lime/15 font-bold shadow-[0_0_10px_rgba(152,255,0,0.15)] animate-pulse'
                          : isDistEntered
                            ? 'border border-zinc-500 text-neutral-100 bg-zinc-800/80 font-semibold'
                            : 'border border-zinc-800 text-zinc-500 bg-zinc-950/30'
                      }`}>
                        {isDistCalculated ? 'CÁLCULO AUTOMÁTICO' : isDistEntered ? 'DATO DE ENTRADA' : 'EN ESPERA'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-4">
                      <div className="flex items-baseline">
                        <input
                          type="text"
                          value={distVal}
                          onChange={(e) => handleInputChange('distancia', 'val', e.target.value)}
                          placeholder="0.00"
                          className={`massive-input text-5xl md:text-6xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-44 transition-colors ${
                            isDistCalculated 
                              ? 'text-neon-lime' 
                              : isDistEntered 
                                ? 'text-white' 
                                : 'text-zinc-500 placeholder-zinc-700'
                          }`}
                        />
                        <span className={`font-extrabold italic text-2xl ml-2 transition-colors duration-150 ${
                          isDistCalculated ? 'text-neon-lime' : isDistEntered ? 'text-[#7E8694]' : 'text-zinc-650'
                        }`}>KM</span>
                      </div>

                      {/* Presets rítmicos rápidos */}
                      <div className="grid grid-cols-2 gap-1 font-mono text-[8.5px] font-black">
                        <button
                          onClick={() => handlePresetDistance(5)}
                          className="bg-zinc-900 text-white hover:bg-neon-lime hover:text-black border border-white/10 px-2 py-0.5 rounded-sm transition-all"
                        >
                          5K
                        </button>
                        <button
                          onClick={() => handlePresetDistance(10)}
                          className="bg-zinc-900 text-white hover:bg-neon-lime hover:text-black border border-white/10 px-2 py-0.5 rounded-sm transition-all"
                        >
                          10K
                        </button>
                        <button
                          onClick={() => handlePresetDistance(21.0975)}
                          className="bg-zinc-900 text-white hover:bg-neon-lime hover:text-black border border-white/10 px-2 py-0.5 rounded-sm transition-all text-center"
                        >
                          21K
                        </button>
                        <button
                          onClick={() => handlePresetDistance(42.195)}
                          className="bg-zinc-900 text-white hover:bg-neon-lime hover:text-black border border-white/10 px-2 py-0.5 rounded-sm transition-all text-center"
                        >
                          42K
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FILA 2: RITMO */}
                  <div className={`p-6 space-y-3 relative transition-all duration-200 ${
                    isPaceCalculated 
                      ? 'bg-neon-lime/[0.03] border-l-4 border-l-neon-lime'
                      : isPaceEntered
                        ? 'hover:bg-neutral-950/45 border-l-4 border-l-neutral-400'
                        : 'hover:bg-neutral-950/20 border-l-4 border-l-transparent'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-[#7E8694]">RITMO DE CARRERA DE OBJETIVO (PACE)</span>
                      <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded transition-all duration-150 relative z-10 ${
                        isPaceCalculated 
                          ? 'border border-neon-lime text-neon-lime bg-neon-lime/15 font-bold shadow-[0_0_10px_rgba(152,255,0,0.15)] animate-pulse'
                          : isPaceEntered
                            ? 'border border-zinc-500 text-neutral-100 bg-zinc-800/80 font-semibold'
                            : 'border border-zinc-800 text-zinc-500 bg-zinc-950/30'
                      }`}>
                        {isPaceCalculated ? 'CÁLCULO AUTOMÁTICO' : isPaceEntered ? 'DATO DE ENTRADA' : 'EN ESPERA'}
                      </span>
                    </div>

                    <div className="flex items-baseline">
                      <input
                        type="text"
                        maxLength={2}
                        value={paceMin}
                        onChange={(e) => handleInputChange('ritmo', 'min', e.target.value)}
                        placeholder="0"
                        className={`massive-input text-5xl md:text-6xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-16 text-right transition-colors ${
                          isPaceCalculated 
                            ? 'text-neon-lime font-black' 
                            : isPaceEntered 
                              ? 'text-white' 
                              : 'text-zinc-500 placeholder-zinc-700'
                        }`}
                      />
                      <span className="font-bold italic text-lg text-zinc-500 mx-1">m</span>
                      <span className={`font-extrabold text-2xl mx-1 transition-colors duration-200 ${isPaceCalculated ? 'text-neon-lime/60' : 'text-zinc-650'}`}>:</span>
                      <input
                        type="text"
                        maxLength={2}
                        value={paceSeg}
                        onChange={(e) => handleInputChange('ritmo', 'seg', e.target.value)}
                        placeholder="00"
                        className={`massive-input text-5xl md:text-6xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-20 text-left transition-colors ${
                          isPaceCalculated 
                            ? 'text-neon-lime font-black' 
                            : isPaceEntered 
                              ? 'text-white' 
                              : 'text-zinc-500 placeholder-zinc-700'
                        }`}
                      />
                      <span className={`font-extrabold italic text-2xl ml-2 transition-colors duration-150 ${
                        isPaceCalculated ? 'text-neon-lime' : isPaceEntered ? 'text-[#7E8694]' : 'text-zinc-650'
                      }`}>/KM</span>
                    </div>
                  </div>

                  {/* FILA 3: TIEMPO */}
                  <div className={`p-6 space-y-3 relative transition-all duration-200 ${
                    isTimeCalculated 
                      ? 'bg-neon-lime/[0.03] border-l-4 border-l-neon-lime'
                      : isTimeEntered
                        ? 'hover:bg-neutral-950/45 border-l-4 border-l-neutral-400'
                        : 'hover:bg-neutral-950/20 border-l-4 border-l-transparent'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-[#7E8694]">TIEMPO PREVISTO TOTAL</span>
                      <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded transition-all duration-150 relative z-10 ${
                        isTimeCalculated 
                          ? 'border border-neon-lime text-neon-lime bg-neon-lime/15 font-bold shadow-[0_0_10px_rgba(152,255,0,0.15)] animate-pulse'
                          : isTimeEntered
                            ? 'border border-zinc-500 text-neutral-100 bg-zinc-800/80 font-semibold'
                            : 'border border-zinc-800 text-zinc-500 bg-zinc-950/30'
                      }`}>
                        {isTimeCalculated ? 'CÁLCULO AUTOMÁTICO' : isTimeEntered ? 'DATO DE ENTRADA' : 'EN ESPERA'}
                      </span>
                    </div>

                    <div className="flex items-baseline">
                      <input
                        type="text"
                        maxLength={2}
                        value={timeHr}
                        onChange={(e) => handleInputChange('tiempo', 'hr', e.target.value)}
                        placeholder="00"
                        className={`massive-input text-4xl md:text-5xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-14 text-right transition-colors ${
                          isTimeCalculated 
                            ? 'text-neon-lime font-black' 
                            : isTimeEntered 
                              ? 'text-white' 
                              : 'text-zinc-500 placeholder-zinc-700'
                        }`}
                      />
                      <span className="font-bold italic text-xs text-zinc-500 mx-1">h</span>
                      <span className={`font-extrabold text-2xl mx-1 transition-colors duration-200 ${isTimeCalculated ? 'text-neon-lime/60' : 'text-zinc-650'}`}>:</span>
                      
                      <input
                        type="text"
                        maxLength={2}
                        value={timeMin}
                        onChange={(e) => handleInputChange('tiempo', 'min', e.target.value)}
                        placeholder="00"
                        className={`massive-input text-4xl md:text-5xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-16 text-center transition-colors ${
                          isTimeCalculated 
                            ? 'text-neon-lime font-black' 
                            : isTimeEntered 
                              ? 'text-white' 
                              : 'text-zinc-500 placeholder-zinc-700'
                        }`}
                      />
                      <span className="font-bold italic text-xs text-zinc-500 mx-1">m</span>
                      <span className={`font-extrabold text-2xl mx-1 transition-colors duration-200 ${isTimeCalculated ? 'text-neon-lime/60' : 'text-zinc-650'}`}>:</span>
                      
                      <input
                        type="text"
                        maxLength={2}
                        value={timeSeg}
                        onChange={(e) => handleInputChange('tiempo', 'seg', e.target.value)}
                        placeholder="00"
                        className={`massive-input text-4xl md:text-5xl font-black italic tracking-tighter bg-transparent border-none outline-none focus:text-neon-lime w-16 text-left transition-colors ${
                          isTimeCalculated 
                            ? 'text-neon-lime font-black' 
                            : isTimeEntered 
                              ? 'text-white' 
                              : 'text-zinc-500 placeholder-zinc-700'
                        }`}
                      />
                      <span className="font-bold italic text-xs text-zinc-500 ml-1">s</span>
                    </div>
                  </div>

                </div>

                {/* BOTÓN GENERAL DE REINICIO DE CAMPOS */}
                <button
                  onClick={resetCalculator}
                  className="border-2 border-white/20 bg-transparent hover:bg-white hover:text-black hover:border-white py-3.5 font-mono font-bold uppercase tracking-widest text-[9px] transition-all duration-150 flex items-center justify-center gap-2"
                >
                  LIMPIAR VARIABLES DE TRABAJO
                </button>

                {/* TEASER NUTRICIONAL INFORMATIVO */}
                <div className="border-4 border-white bg-black p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-[9px] font-mono font-bold text-zinc-500">RESUMEN NUTRICIONAL ESTIMADO</span>
                    <span className="flex items-center gap-1 font-mono text-[8.5px] text-zinc-400">
                      Geles: {nutritionPlan.totalGelsNeeded} u.
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-mono text-zinc-500 uppercase">Esfuerzo Estimado</div>
                      <div className="text-md font-black italic text-white flex items-center gap-2 mt-0.5">
                        <Flame className={`w-3.5 h-3.5 shrink-0 ${
                          nutritionPlan.demandTitle.includes('CRÍTICO') ? 'text-crimson-x' : 'text-neon-lime'
                        }`} />
                        {nutritionPlan.demandTitle}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono text-zinc-500 uppercase">Carbohidratos totales</div>
                      <div className="text-md font-black italic text-neon-lime mt-0.5">
                        {nutritionPlan.totalCarbsGrams} g CHO
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('nutrition')}
                    className="w-full bg-zinc-950 hover:bg-neon-lime hover:text-black border border-white/10 py-3 font-mono text-[9px] font-bold tracking-wider text-center transition-all uppercase flex items-center justify-center gap-2"
                  >
                    Ver plan de hidratación y geles <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

              </div>

              {/* COLUMNA DERECHA: EXPLICACIÓN DE ESTRATEGIA, GRÁFICO TÁCTICO & TABLA DE SPLITS */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* SEGMENTED CHECKPOINT OUTSOLE SPLITS */}
                <div className="border-4 border-white bg-black p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-black block text-[#7E8694]">
                        2. TABLA DE PASOS POR INTERVALOS
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase font-mono mt-0.5">
                        Definir distancia de cada intervalo de análisis
                      </span>
                    </div>

                    {/* Frecuencia de los checkpoints */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex border-2 border-white bg-black p-0.5 font-mono text-[9.5px] font-black">
                        {[0.5, 1.0, 2.0, 5.0].map((val) => (
                          <button
                            key={val}
                            onClick={() => {
                              setIntervalVal(val);
                              setIsCustomIntervalActive(false);
                            }}
                            className={`px-2 py-0.5 transition-all ${
                              interval === val && !isCustomIntervalActive
                                ? 'bg-white text-black'
                                : 'text-white hover:bg-neutral-800'
                            }`}
                          >
                            {val.toFixed(1)}K
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setIsCustomIntervalActive(true);
                            setIntervalVal(parseFloat(customIntervalValue) || 0.4);
                          }}
                          className={`px-2 py-0.5 transition-all ${
                            isCustomIntervalActive ? 'bg-white text-black font-extrabold' : 'text-white hover:bg-neutral-800'
                          }`}
                        >
                          OTRO
                        </button>
                      </div>

                      {isCustomIntervalActive && (
                        <div className="flex items-center gap-1 border border-white/35 bg-black px-2 py-0.5 font-mono text-zinc-300">
                          <input
                            type="text"
                             value={customIntervalValue}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9.]/g, '');
                              setCustomIntervalValue(v);
                              const parsed = parseFloat(v);
                              if (parsed > 0) setIntervalVal(parsed);
                            }}
                            className="w-8 bg-transparent text-xs font-black focus:outline-none text-neon-lime text-center"
                          />
                          <span className="text-[8px] font-bold">KM</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Splits dynamic output table */}
                  <div className="max-h-64 overflow-y-auto border border-white/10 rounded-sm">
                    <table className="w-full text-left font-mono text-xs text-white divide-y divide-white/10">
                      <thead className="bg-[#111215] sticky top-0 z-10">
                        <tr className="text-zinc-400 uppercase italic text-[9px]">
                          <th className="py-3 px-4">KILÓMETRO</th>
                          <th className="py-3 px-4">RITMO SECTOR</th>
                          <th className="py-3 px-4 text-right">TIEMPO ACUMULADO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-black/40">
                        {currentSplits.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-zinc-500 font-mono text-[11px]">
                              [ INGRESE DISTANCIA Y TIEMPO/RITMO PARA VER TABLA DE PASOS ]
                            </td>
                          </tr>
                        ) : (
                          currentSplits.map((split, i) => {
                             return (
                              <tr
                                key={i}
                                className="transition-colors duration-150 hover:bg-white/5"
                              >
                                <td className="py-2.5 px-4 font-black text-white">
                                  {split.mark.toFixed(2)} K
                                </td>
                                <td className="py-2.5 px-4 text-zinc-300">
                                  {formatPace(split.segmentPace)} <span className="text-[10px] text-zinc-500">/KM</span>
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-neon-lime">
                                  {formatTime(split.cumulativeSec)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Splits Summary statistics badge footer */}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-[#7E8694]">
                    <div>
                      DISTANCIA TOTAL: <span className="text-white font-bold block text-sm">{activeDistance.toFixed(2)} KM</span>
                    </div>
                    <div>
                      RITMO PROMEDIO: <span className="text-white font-bold block text-sm">{formatPace(activePaceSec)} /KM</span>
                    </div>
                    <div>
                      TIEMPO TOTAL: <span className="text-neon-lime font-black block text-sm">{formatTime(activeTimeSec)}</span>
                    </div>
                  </div>

                </div>

                {/* INTERACTIVE CARBON PACING PLATE PLOTTER */}
                <div className="border-4 border-white bg-black p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-black block text-[#7E8694]">
                        3. DISTRIBUCIÓN Y PLANIFICACIÓN DE RITMO
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase font-mono mt-0.5">
                        Estrategia seleccionada y ritmo relativo a lo largo de la carrera
                      </span>
                    </div>

                    {/* Selector de estrategia */}
                    <div className="flex border-2 border-white bg-black p-0.5 font-mono text-[9px] font-black shrink-0">
                      <button
                        onClick={() => { setStrategy('even'); }}
                        className={`px-2 py-1 transition-all ${
                          strategy === 'even' ? 'bg-white text-black' : 'text-white hover:bg-zinc-800'
                        }`}
                      >
                        RITMO CONSTANTE
                      </button>
                      <button
                        onClick={() => { setStrategy('negative'); }}
                        className={`px-2 py-1 transition-all ${
                          strategy === 'negative' ? 'bg-white text-black' : 'text-white hover:bg-zinc-800'
                        }`}
                      >
                        SPLIT NEGATIVO
                      </button>
                      <button
                        onClick={() => { setStrategy('positive'); }}
                        className={`px-2 py-1 transition-all ${
                          strategy === 'positive' ? 'bg-white text-black' : 'text-white hover:bg-zinc-800'
                        }`}
                      >
                        SPLIT POSITIVO
                      </button>
                    </div>
                  </div>

                  {/* Informational Callout */}
                  <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-sm">
                    {strategy === 'even' && (
                      <p className="text-[10.5px] font-mono text-zinc-400">
                        <span className="text-white font-bold">RITMO CONSTANTE (EVEN PACE):</span> Distribución idéntica del esfuerzo de principio a fin. Conserva la elasticidad muscular y reduce la fatiga temprana. Ideal para circuitos planos y condiciones estables.
                      </p>
                    )}
                    {strategy === 'negative' && (
                      <p className="text-[10.5px] font-mono text-zinc-400">
                        <span className="text-neon-lime font-bold">SPLIT NEGATIVO:</span> Comienzas un 5% más lento del promedio objetivo para calentar y entras en cadencia, acelerando progresivamente hasta terminar un 5% más rápido en la segunda mitad. Optimiza el consumo de glucógeno.
                      </p>
                    )}
                    {strategy === 'positive' && (
                      <p className="text-[10.5px] font-mono text-zinc-400">
                        <span className="text-[#FF2A54] font-bold">SPLIT POSITIVO:</span> Salida agresiva un 5% más rápida que el promedio general, asumiendo un declive gradual de hasta un 5% más lento debido al desgaste energético acumulado y la fatiga muscular en el tramo final.
                      </p>
                    )}
                  </div>

                  {/* Canvas container graph component */}
                  <div className="border border-white/10 bg-zinc-950 p-2 relative">
                    <PaceChartCanvas
                       totalDistance={activeDistance}
                       basePaceSeconds={activePaceSec}
                       strategy={strategy}
                       interval={interval}
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          /* ACTION VIEW: BIO-METABOLIC PLANNER */
          <div className="space-y-8 animate-fade-in">
            {/* VOLVER HEADER TRIGGER BUTTON */}
            <button
              onClick={() => setActiveTab('calculator')}
              className="border border-white/20 hover:border-white bg-black hover:bg-neutral-900 py-2.5 px-5 font-mono font-bold uppercase tracking-wider text-[10px] transition-all flex items-center gap-2 cursor-pointer z-10"
            >
              &larr; Volver a la Calculadora
            </button>

            {/* HEADER DE BIOMETABOLISMO */}
            <div className="border-4 border-white bg-black text-foam-cream p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              <div className="relative z-10 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="bg-crimson-x text-white font-sans font-black px-2 py-0.5 text-[10px] uppercase">
                    Estrategia Nutricional
                  </span>
                  <span className="text-xs font-mono tracking-widest text-[#7E8694]">ANÁLISIS CO-EXÓGENO</span>
                </div>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">
                  PLANIFICACIÓN DE <span className="text-crimson-x">HIDRATACIÓN Y GEL</span>
                </h1>
                <p className="text-xs text-zinc-400 font-mono">
                  Optimice la reposición de glucógeno, sales de sodio y líquidos según su duración de carrera prevista.
                </p>
              </div>

              <div className="font-mono text-xs text-neutral-400 border-t md:border-t-0 md:border-l border-neutral-700 pt-4 md:pt-0 md:pl-6 space-y-1 relative z-10">
                <div className="flex justify-between md:justify-start gap-4">
                  <span className="text-zinc-500">BASE CALCULADA:</span>
                  <span className="text-white font-semibold">TASA DE ASIMILACIÓN / HORA</span>
                </div>
              </div>
            </div>

            {/* CUADROS DE DIAGNÓSTICO METABÓLICO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* COLUMNA IZQUIERDA: INPUTS DE NUTRICIÓN */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* CALIFICACIÓN DE EXIGENCIA REGULADA */}
                <div className="border-4 border-white bg-black p-6 space-y-6">
                  <div className="space-y-3">
                    <span className="text-xs font-mono font-black text-zinc-500 block">// EVALUACIÓN DE EXIGENCIA ENERGÉTICA</span>
                    <div className="bg-[#0f1012] border border-white/5 p-4 rounded-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-sans font-black text-lg text-white italic">
                          {nutritionPlan.demandTitle}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-white/10 px-2 py-0.5 rounded-sm">
                          TIEMPO ESTIMADO: {formatTime(activeTimeSec)}
                        </span>
                      </div>

                      {/* Visual segment glow progress */}
                      <div className="grid grid-cols-3 gap-1 h-3.5">
                        <div className={`transition-colors duration-300 ${
                          activeTimeSec > 0 ? 'bg-neon-lime' : 'bg-neutral-800'
                        }`} />
                        <div className={`transition-colors duration-300 ${
                          activeTimeSec >= 3600 ? 'bg-orange-500' : 'bg-neutral-800'
                        }`} />
                        <div className={`transition-colors duration-300 ${
                          activeTimeSec >= 7200 ? 'bg-crimson-x' : 'bg-neutral-800'
                        }`} />
                      </div>

                      <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
                        {nutritionPlan.demandDesc}
                      </p>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN DEL PRESET DE GEL */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10.5px] font-mono text-zinc-500 uppercase block">
                        // 1. CARACTERÍSTICAS DEL GEL DEPORTIVO:
                      </label>
                      <div className="space-y-2">
                        {GEL_PRESETS.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedGelId(p.id)}
                            className={`border p-3 flex justify-between items-center cursor-pointer transition-all ${
                              selectedGelId === p.id
                                ? 'border-crimson-x bg-crimson-x/5'
                                : 'border-white/10 bg-zinc-950/40 hover:border-white/25'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <span className="text-xs font-black block tracking-tight">{p.name}</span>
                              <span className="text-[9.5px] text-zinc-500 font-mono block">{p.description}</span>
                            </div>
                            <span className="font-black font-sans italic text-base text-neon-lime shrink-0 pl-2">
                              {p.carbs}g <span className="text-[9px] text-zinc-500">CHO</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CONFIGURACIÓN DEL SWEAT RATE / TASA DE SUDORACIÓN */}
                    <div className="space-y-2">
                      <label className="text-[10.5px] font-mono text-zinc-500 uppercase block">
                        // 2. TASA DE SUDORACIÓN ESTIMADA:
                      </label>
                      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-bold">
                        {sweatRateOptions.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setSweatRate(opt.id)}
                            className={`border py-2 transition-all ${
                              sweatRate === opt.id
                                ? 'border-white bg-white text-black font-black'
                                : 'border-white/10 bg-[#0f1012] text-zinc-400 hover:text-white'
                            }`}
                          >
                            {opt.id === 'low' && 'BAJO'}
                            {opt.id === 'normal' && 'ESTÁNDAR'}
                            {opt.id === 'high' && 'MÁXIMO'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9.5px] font-mono text-zinc-500">
                        {sweatRate === 'low' && 'Atmósferas frías o atleta con baja tasa de evaporación.'}
                        {sweatRate === 'normal' && 'Condiciones templadas estándar (entre 12°C y 18°C).'}
                        {sweatRate === 'high' && 'Humedad elevada o alta sudoración. Demanda extrema de agua y sodio.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* NOTA DE RESPONSABILIDAD MÉDICA / PROFESIONAL */}
                <div className="border-4 border-[#FF2A54] bg-[#020202] p-6 space-y-3">
                  <div className="flex items-center gap-2 text-[#FF2A54]">
                    <CircleAlert className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-mono font-black uppercase tracking-wide">
                      RECOMENDACIÓN Y LIMITE DE ASIMILACIÓN
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                    Las estimaciones y recomendaciones proporcionadas en este módulo se basan en consensos generales de nutrición y del <span className="text-white font-semibold block sm:inline">American College of Sports Medicine (ACSM)</span>. No obstante, <span className="text-white font-bold">cada organismo asimila y metaboliza nutrientes de forma diferente</span>. Antes de entrenar o competir bajo un plan de alimentación exógeno, es indispensable consultar a un <span className="text-[#FF2A54] font-bold">nutricionista deportivo o profesional médico matriculado</span> para personalizar las ingestas y evitar riesgos de salud gastrointestinal.
                  </p>
                </div>

              </div>

              {/* COLUMNA DERECHA: CRONOGRAMA DE ALIMENTACIÓN */}
              <div className="lg:col-span-7 flex flex-col gap-6">

                {/* COMPOSICION DEL PLAN */}
                <div className="border-4 border-white bg-black p-6 space-y-4">
                  <span className="text-xs font-mono font-black text-zinc-400 block uppercase">
                    MÉTRICAS TOTALES DE RESTRUCTURACIÓN
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                    <div className="p-4 bg-[#111215] border border-white/5 rounded-sm">
                      <span className="text-zinc-500 text-[8.5px] uppercase block">CARBOHIDRATOS TOTALES</span>
                      <div className="text-2xl font-black italic mt-1 text-neon-lime">
                        {nutritionPlan.totalCarbsGrams} g <span className="text-xs text-[#7E8694]">CHO</span>
                      </div>
                    </div>

                    <div className="p-4 bg-[#111215] border border-white/5 rounded-sm">
                      <span className="text-zinc-500 text-[8.5px] uppercase block">
                        GEL DE CONTROL ({selectedGel.carbs}g)
                      </span>
                      <div className="text-2xl font-black italic mt-1 text-white">
                        {nutritionPlan.totalGelsNeeded} <span className="text-xs text-[#7E8694]">{selectedGelId === 'liquid' ? 'SOPORTES' : 'GELES'}</span>
                      </div>
                      {nutritionPlan.preRaceGelsCount > 0 && (
                        <span className="text-[8.5px] text-[#7E8694] font-mono block mt-1 uppercase text-left">
                          (1 Pre-carrera + {nutritionPlan.duringRaceGelsCount} en carrera)
                        </span>
                      )}
                    </div>

                    <div className="p-4 bg-[#111215] border border-white/5 rounded-sm">
                      <span className="text-zinc-500 text-[8.5px] uppercase block">SODIO RECOMENDADO</span>
                      <div className="text-2xl font-black italic mt-1 text-white">
                        {nutritionPlan.totalSodiumMg} <span className="text-xs text-[#7E8694]">mg</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#111215] border border-white/5 rounded-sm flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-zinc-500 text-[8.5px] uppercase block">TASA DE ASIMILACIÓN LÍQUIDA</span>
                      <div className="text-lg font-black italic mt-0.5 text-white">
                        {nutritionPlan.waterPerHourMl} <span className="text-xs text-neutral-400">ml / HORA</span>
                      </div>
                    </div>
                    <span className="text-zinc-600 font-sans italic font-black text-2xl tracking-tighter">
                      H2O
                    </span>
                  </div>
                </div>

                {/* CRONOGRAMA TÁCTICO */}
                <div className="border-4 border-white bg-black p-6 space-y-4">
                  <div>
                    <span className="text-xs font-mono font-black text-zinc-400 block uppercase">
                      CRONOGRAMA DE ALIMENTACIÓN POR TRAMO
                    </span>
                    <span className="text-[9px] text-[#7E8694] font-mono block mt-0.5">
                      Sugerencias de toma distribuidas por kilometraje y ritmo de carrera
                    </span>
                  </div>

                  {/* Timeline list */}
                  <div className="max-h-72 overflow-y-auto border border-white/10 rounded-sm p-1 divide-y divide-white/5 bg-black/40">
                    {nutritionPlan.timeline.map((evt, i) => {
                      const isGel = evt.type === 'gel';
                      const isStartOrFinish = evt.type === 'start' || evt.type === 'finish';
                      
                      return (
                        <div key={i} className="flex items-start gap-4 py-3 hover:bg-white/5 transition-all text-xs font-mono">
                          <div className="flex flex-col items-center min-w-[65px] border-r border-white/10 pr-2 pt-0.5">
                            <span className="text-white font-black text-sm">
                              {evt.sec < 0 ? 'PRE' : `${evt.km.toFixed(1)}K`}
                            </span>
                            <span className="text-[9.5px] text-zinc-500 mt-0.5">{formatTime(evt.sec)}</span>
                          </div>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {isGel ? (
                                <span className="text-[8.5px] font-black px-2 py-0.5 border border-crimson-x text-crimson-x bg-crimson-x/10 rounded-full flex items-center gap-1 uppercase">
                                  <Zap className="w-2.5 h-2.5 fill-crimson-x shrink-0" /> {evt.title}
                                </span>
                              ) : isStartOrFinish ? (
                                <span className="text-[8.5px] font-black px-2 py-0.5 border border-white text-white bg-white/10 rounded-full flex items-center gap-1 uppercase">
                                  <CheckCircle className="w-2.5 h-2.5 shrink-0" /> {evt.title}
                                </span>
                              ) : (
                                <span className="text-[8.5px] font-black px-2 py-0.5 border border-neon-lime text-neon-lime bg-neon-lime/10 rounded-full flex items-center gap-1 uppercase">
                                  <Droplet className="w-2.5 h-2.5 shrink-0 animate-pulse" /> {evt.title}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-relaxed pr-2">
                              {evt.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* PIE DE PÁGINA */}
      <footer className="bg-black py-8 text-center font-mono text-[9px] text-[#7E8694] tracking-wider relative z-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <div className="font-extrabold tracking-widest text-[#7E8694] uppercase">// RUNNING LAB //</div>
          <div className="text-zinc-650 text-[8px] uppercase leading-relaxed max-w-md mx-auto">
            Cálculos estimados con fines educativos y de planificación deportiva general de carrera.
          </div>
        </div>
      </footer>

    </div>
  );
}
