import { StrategyType, SweatRateType, FuelEvent, SplitCheckpoint } from './types';

/**
 * Converts total seconds into HH:MM:SS format
 */
export function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds)) return '00:00:00';
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const hrs = Math.floor(absSeconds / 3600);
  const mins = Math.floor((absSeconds % 3600) / 60);
  const secs = Math.floor(absSeconds % 60);
  const formatted = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Converts pace in seconds/km to MM:SS format
 */
export function formatPace(paceSeconds: number): string {
  if (isNaN(paceSeconds) || paceSeconds <= 0) return '0:00';
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculadora de ritmo para un segmento particular según la estrategia elegida
 * dStart: inicio de segmento en km
 * dEnd: fin de segmento en km
 * totalDistance: distancia total de la carrera en km
 * basePaceSeconds: ritmo promedio objetivo en segundos por km
 */
export function getSegmentPace(
  dStart: number,
  dEnd: number,
  totalDistance: number,
  basePaceSeconds: number,
  strategy: StrategyType
): number {
  if (totalDistance <= 0.1) return basePaceSeconds;
  
  const midPoint = (dStart + dEnd) / 2;
  const progressFraction = Math.min(1, Math.max(0, midPoint / totalDistance));

  if (strategy === 'even') {
    return basePaceSeconds;
  } else if (strategy === 'negative') {
    // Comienza un 5% más lento y termina un 5% más rápido (split negativo)
    const startMultiplier = 1.05;
    const endMultiplier = 0.95;
    return basePaceSeconds * (startMultiplier - (startMultiplier - endMultiplier) * progressFraction);
  } else if (strategy === 'positive') {
    // Comienza un 5% más rápido y decae un 5% más lento por fatiga (split positivo)
    const startMultiplier = 0.95;
    const endMultiplier = 1.05;
    return basePaceSeconds * (startMultiplier + (endMultiplier - startMultiplier) * progressFraction);
  }
  return basePaceSeconds;
}

/**
 * Genera la lista de checkpoints fraccionados para la tabla de splits
 */
export function calculateSplits(
  totalDistance: number,
  basePaceSeconds: number,
  interval: number,
  strategy: StrategyType
): SplitCheckpoint[] {
  if (totalDistance <= 0 || basePaceSeconds <= 0 || interval <= 0) {
    return [];
  }

  const checkpoints: number[] = [];
  let currentMark = interval;
  
  while (currentMark < totalDistance) {
    checkpoints.push(currentMark);
    currentMark += interval;
  }
  // Añadir la marca final si no coincide exactamente
  if (totalDistance - (currentMark - interval) > 0.001) {
    checkpoints.push(totalDistance);
  }

  const splits: SplitCheckpoint[] = [];
  let cumulativeSec = 0;
  let lastMark = 0;

  checkpoints.forEach((mark) => {
    const segmentDistance = mark - lastMark;
    const segmentPace = getSegmentPace(lastMark, mark, totalDistance, basePaceSeconds, strategy);
    const segmentDuration = segmentDistance * segmentPace;
    
    cumulativeSec += segmentDuration;
    splits.push({
      mark,
      segmentPace,
      cumulativeSec
    });

    lastMark = mark;
  });

  return splits;
}

/**
 * Calcula la nutrición e hidratación deportiva y arma la agenda cronológica táctica
 */
export interface NutritionCalculation {
  totalDurationHours: number;
  demandTitle: string;
  demandDesc: string;
  totalCarbsGrams: number;
  totalGelsNeeded: number;
  waterPerHourMl: number;
  totalSodiumMg: number;
  timeline: FuelEvent[];
  preRaceGelsCount: number;
  duringRaceGelsCount: number;
}

export function calculateNutrition(
  totalDistance: number,
  paceSeconds: number,
  sweatRate: SweatRateType,
  gelGrams: number
): NutritionCalculation {
  const totalSeconds = totalDistance * paceSeconds;
  const hours = totalSeconds / 3600;

  // Sports Science Consensus regarding Carbohydrates Intake (ACSM & ISSN guidelines)
  let carbsPerHour = 0;
  let demandTitle = 'EXIGENCIA AERÓBICA BAJA';
  let demandDesc = 'Esfuerzo breve o de baja intensidad (< 1 hora). El glucógeno muscular e intramuscular inicial es suficiente para cubrir la demanda energética. Priorizar hidratación pura.';

  if (hours >= 1.0 && hours < 2.5) {
    carbsPerHour = 45; // Consenso: 30-60g de CHO por hora
    demandTitle = 'EXIGENCIA MODERADA-ALTA';
    demandDesc = 'Esfuerzo medio (1h - 2.5h). Ingesta recomendada de 30-60g CHO/hora para atenuar la degradación de glucógeno hepaticomuscular y posponer la fatiga del sistema nervioso central.';
  } else if (hours >= 2.5) {
    carbsPerHour = 75; // Consenso: 60-90g de CHO por hora (alto rendimiento y fondo largo)
    demandTitle = 'EXIGENCIA EXTREMA (FONDISTAS)';
    demandDesc = 'Competición prolongada (> 2.5h, ej. Maratón). Consumos elevados de 60-90g CHO/hora requieren combinación ideal de carbohidratos multimodales (ej. relación 1:0.8 de glucosa:fructosa) para evitar saturar transportadores intestinales SGLT1 y GLUT5 y prevenir colitis o malestar.';
  }

  // Pre-race gel analysis: Standard sports science recommendation for races from 15km onwards 
  // (such as 15K, Half Marathon, Marathon, etc.), taking 1 gel ~15 minutes before is crucial.
  const preRaceGelsCount = (totalDistance >= 15 || hours >= 1.25) ? 1 : 0;
  
  const duringRaceCarbs = hours >= 1.0 ? Math.round(hours * carbsPerHour) : 0;
  const duringRaceGelsCount = duringRaceCarbs > 0 ? Math.ceil(duringRaceCarbs / gelGrams) : 0;

  // Total gels and carbs combining pre-race and during-race
  const totalGelsNeeded = duringRaceGelsCount + preRaceGelsCount;
  const totalCarbsGrams = (duringRaceGelsCount * gelGrams) + (preRaceGelsCount * gelGrams);

  // Sweat rates consensus:
  // Low (cold conditions / low rate): 400-500 ml/hr
  // Standard (moderate climates 12-18°C): 600-700 ml/hr
  // High (hot/humid or heavy sweaters): 800-1000 ml/hr
  let waterPerHourMl = 450;
  if (sweatRate === 'normal') waterPerHourMl = 650;
  if (sweatRate === 'high') waterPerHourMl = 850;

  // Sodium consensus:
  // Highly trained athletes and standard coaches agree that sodium replacement should follow 
  // sweat sodium concentrations (averaging 500-800 mg per liter of sweat, roughly 300-600 mg per hour).
  // Formula: waterPerHourMl * (650mg Na / 1000ml) * hours
  const totalSodiumMg = Math.round((waterPerHourMl / 1000) * 650 * hours);

  const timeline: FuelEvent[] = [];

  // 1. Pre-race event: Golden standard sports science for Half-Marathon to Marathon
  if (preRaceGelsCount > 0) {
    timeline.push({
      sec: -900, // 15 mins antes
      km: 0,
      type: 'gel',
      title: 'GEL PRE-CARRERA (PRIMING)',
      desc: `Consumir 1 unidad pre-largada (${gelGrams}g CHO) con 150-250ml de agua pura. Maximiza y sella los depósitos de glucógeno en el hígado tras el ayuno nocturno, de modo que no se agoten tan rápido en la primera mitad.`
    });
  }

  // 2. Start line
  timeline.push({
    sec: 0,
    km: 0,
    type: 'start',
    title: 'PUNTO DE LARGADA',
    desc: 'Bocina de partida. Cruce de arco. Activar ritmo planificado de carrera. Iniciar con tranquilidad mental.'
  });

  // 3. Hydration events: Every 20 minutes (20, 40, 60, ... mins)
  // Consensus: Hydrate early, every 15-20 mins before thirst sets in.
  const intervalMinutes = 20;
  const totalIntervals = Math.floor((totalSeconds / 60) / intervalMinutes);

  for (let w = 1; w <= totalIntervals; w++) {
    const sec = w * intervalMinutes * 60;
    const km = (sec / totalSeconds) * totalDistance;
    // Don't add if too close to the end of the race
    if (totalSeconds - sec > 120) {
      timeline.push({
        sec,
        km,
        type: 'water',
        title: `HIDRATACIÓN Y ELECTRÓLITOS`,
        desc: `Tomar entre 150ml y 200ml de bebida isotónica o líquido con sales de sodio. Previene la fatiga térmica, deshidratación plasmática y los calambres musculares.`
      });
    }
  }

  // 4. During-race gel events: Equally distributed across the time segments
  if (duringRaceGelsCount > 0) {
    const segmentDurationSec = totalSeconds / (duringRaceGelsCount + 1);
    for (let g = 1; g <= duringRaceGelsCount; g++) {
      const sec = Math.round(segmentDurationSec * g);
      const km = (sec / totalSeconds) * totalDistance;
      const isLast = g === duringRaceGelsCount;
      timeline.push({
        sec,
        km,
        type: 'gel',
        title: `GEL DURANTE CARRERA [${g.toString().padStart(2, '0')}]`,
        desc: `Consumir 1 unidad (${gelGrams}g CHO). Acompañar siempre con unos sorbos de agua templada para reducir osmolaridad estomacal y acelerar el vaciado gástrico hacia el torrente sanguíneo. ${
          isLast ? 'Último empujón energético para evitar la temida pared y sostener el pace.' : 'Aporte de carbohidratos de asimilación rápida.'
        }`
      });
    }
  }

  // 5. Finish line event
  timeline.push({
    sec: totalSeconds,
    km: totalDistance,
    type: 'finish',
    title: 'ARCO DE LLEGADA // FIN DE LA CARRERA',
    desc: '¡Meta cruzada! Ventana de recuperación: Consumir inmediatamente 250ml de recuperador (ratio 3:1 de carbohidratos rápidos a proteínas) para acelerar la resíntesis de glucógeno.'
  });

  // Sort timeline chronologically (since pre-race gel sits at -900, it naturally goes first!)
  timeline.sort((a, b) => a.sec - b.sec);

  return {
    totalDurationHours: hours,
    demandTitle,
    demandDesc,
    totalCarbsGrams,
    totalGelsNeeded,
    waterPerHourMl,
    totalSodiumMg,
    timeline,
    preRaceGelsCount,
    duringRaceGelsCount
  };
}
