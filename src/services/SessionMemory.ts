import * as FileSystem from 'expo-file-system/legacy';
import { AnalysisBundle } from '../types/index';

export interface SessionMemoryEntry {
  createdAt: string;
  emotion: AnalysisBundle['fusion']['dominant'];
  confidence: number;
  distress: AnalysisBundle['distress']['level'];
  distressScore: number;
  strategy: AnalysisBundle['strategy']['label'];
}

export interface SessionTrendSummary {
  count: number;
  recentEmotion?: SessionMemoryEntry['emotion'];
  dominantTrend?: SessionMemoryEntry['emotion'];
  averageConfidence: number;
  highDistressRate: number;
  latestStrategy?: SessionMemoryEntry['strategy'];
}

const HISTORY_URI = `${FileSystem.documentDirectory}guident-session-history.json`;
const MAX_ENTRIES = 12;

async function readEntries(): Promise<SessionMemoryEntry[]> {
  if (!FileSystem.documentDirectory) return [];
  const info = await FileSystem.getInfoAsync(HISTORY_URI);
  if (!info.exists) return [];

  try {
    const raw = await FileSystem.readAsStringAsync(HISTORY_URI);
    const parsed = JSON.parse(raw) as SessionMemoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: SessionMemoryEntry[]): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(HISTORY_URI, JSON.stringify(entries.slice(-MAX_ENTRIES), null, 2));
}

function summarize(entries: SessionMemoryEntry[]): SessionTrendSummary {
  if (entries.length === 0) {
    return { count: 0, averageConfidence: 0, highDistressRate: 0 };
  }

  const emotionCounts = new Map<SessionMemoryEntry['emotion'], number>();
  for (const entry of entries) {
    emotionCounts.set(entry.emotion, (emotionCounts.get(entry.emotion) ?? 0) + 1);
  }
  const dominantTrend = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const averageConfidence = entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length;
  const highDistressRate = entries.filter((entry) => entry.distress === 'high').length / entries.length;
  const recent = entries[entries.length - 1];

  return {
    count: entries.length,
    recentEmotion: recent?.emotion,
    dominantTrend,
    averageConfidence: Number(averageConfidence.toFixed(3)),
    highDistressRate: Number(highDistressRate.toFixed(3)),
    latestStrategy: recent?.strategy,
  };
}

export const SessionMemory = {
  async loadSummary(): Promise<SessionTrendSummary> {
    return summarize(await readEntries());
  },

  async appendAnalysis(analysis: AnalysisBundle): Promise<SessionTrendSummary> {
    const entries = await readEntries();
    entries.push({
      createdAt: new Date().toISOString(),
      emotion: analysis.fusion.dominant,
      confidence: analysis.fusion.confidence,
      distress: analysis.distress.level,
      distressScore: analysis.distress.score,
      strategy: analysis.strategy.label,
    });
    await writeEntries(entries);
    return summarize(entries);
  },
};
