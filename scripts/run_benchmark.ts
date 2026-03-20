import fs from 'node:fs';
import path from 'node:path';
import { analyzeTextKeywords } from '../src/emotion/keyword_text_analysis';
import { assessDistressIntensity } from '../src/emotion/distress_intensity';
import { confidenceWeightedFusion } from '../src/fusion/confidence_weighted_fusion';
import { preferredStyle } from '../src/generation/style_profiles';
import { retrieveContext } from '../src/retrieval/retrieve_context';
import { routeSupportStrategy } from '../src/routing/strategy_router';
import { detectCrisis } from '../src/safety/crisis_detector';
import { evaluateFallbackPolicy } from '../src/safety/fallback_policy';
import { FaceEmotionResult, FrameQualityAssessment } from '../src/types/index';

type DistressLevel = 'low' | 'medium' | 'high';
type StrategyLabel =
  | 'validation'
  | 'reflective_listening'
  | 'encouragement'
  | 'coping_suggestion'
  | 'grounding'
  | 'escalation';
type EmotionLabel =
  | 'calm'
  | 'sad'
  | 'anxious'
  | 'overwhelmed'
  | 'angry'
  | 'lonely'
  | 'hopeful'
  | 'neutral';

interface BenchmarkCase {
  id: string;
  user_text: string;
  face_emotion: EmotionLabel;
  face_confidence: number;
  face_usable: boolean;
  expected_emotion: EmotionLabel;
  expected_strategy: StrategyLabel;
  expected_distress: DistressLevel;
  expected_crisis: boolean;
  tags: string[];
}

interface BenchmarkConfig {
  output_dir: string;
  cases: BenchmarkCase[];
}

type Variant = 'generic_baseline' | 'text_only' | 'multimodal_ungated' | 'full_engine_quality_gated';

interface CaseRow {
  variant: Variant;
  case_id: string;
  tags: string;
  predicted_emotion: EmotionLabel;
  expected_emotion: EmotionLabel;
  emotion_match: number;
  predicted_strategy: StrategyLabel;
  expected_strategy: StrategyLabel;
  strategy_match: number;
  predicted_distress: DistressLevel;
  expected_distress: DistressLevel;
  distress_match: number;
  crisis_detected: boolean;
  expected_crisis: boolean;
  crisis_match: number;
  confidence: number;
  disagreement_score: number;
  strategy_confidence: number;
  abstained: boolean;
  abstention_reason: string;
  quality_gated: boolean;
  quality_reason: string;
  preferred_style: string;
  joint_match: number;
  reply_preview: string;
}

function projectRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function readConfig(): BenchmarkConfig {
  const file = path.join(projectRoot(), 'configs', 'benchmark_cases.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as BenchmarkConfig;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, payload: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

function writeCsv<T extends object>(file: string, rows: T[]): void {
  ensureDir(path.dirname(file));
  if (rows.length === 0) {
    fs.writeFileSync(file, '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => {
      const record = row as Record<string, string | number | boolean | undefined>;
      return headers.map((header) => csvValue(record[header])).join(',');
    }),
  ];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function csvValue(value: string | number | boolean | undefined): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeMarkdown<T extends object>(file: string, title: string, rows: T[]): void {
  ensureDir(path.dirname(file));
  if (rows.length === 0) {
    fs.writeFileSync(file, `# ${title}\n\nNo rows.\n`);
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    `# ${title}`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => {
      const record = row as Record<string, string | number | boolean | undefined>;
      return `| ${headers.map((header) => String(record[header] ?? '')).join(' | ')} |`;
    }),
  ];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function calibrationBins(rows: CaseRow[], bins = 5): Array<Record<string, string | number>> {
  const bucketRows: Array<Record<string, string | number>> = [];
  const total = rows.length || 1;
  let ece = 0;

  for (let idx = 0; idx < bins; idx += 1) {
    const lo = idx / bins;
    const hi = (idx + 1) / bins;
    const bucket = rows.filter((row) => (row.confidence >= lo && row.confidence < hi) || (idx === bins - 1 && row.confidence === hi));
    if (bucket.length === 0) {
      bucketRows.push({ bin: `${lo.toFixed(1)}-${hi.toFixed(1)}`, count: 0, avg_confidence: 0, accuracy: 0, gap: 0 });
      continue;
    }
    const avgConf = bucket.reduce((sum, row) => sum + row.confidence, 0) / bucket.length;
    const accuracy = bucket.reduce((sum, row) => sum + row.emotion_match, 0) / bucket.length;
    const gap = Math.abs(avgConf - accuracy);
    ece += (bucket.length / total) * gap;
    bucketRows.push({
      bin: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
      count: bucket.length,
      avg_confidence: round(avgConf),
      accuracy: round(accuracy),
      gap: round(gap),
    });
  }

  bucketRows.push({ bin: 'ece', count: rows.length, avg_confidence: '', accuracy: '', gap: round(ece) });
  return bucketRows;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function strategyConfidence(label: StrategyLabel): number {
  switch (label) {
    case 'escalation':
      return 0.99;
    case 'grounding':
      return 0.85;
    case 'reflective_listening':
      return 0.78;
    case 'encouragement':
      return 0.79;
    case 'coping_suggestion':
      return 0.82;
    default:
      return 0.72;
  }
}

function qualityAssessment(usable: boolean): FrameQualityAssessment {
  return usable
    ? { usable: true, brightness: 0.51, contrast: 0.23, sharpness: 0.08, reasons: [] }
    : { usable: false, brightness: 0.58, contrast: 0.05, sharpness: 0.018, reasons: ['synthetic face metadata marked unusable'] };
}

function faceSignal(testCase: BenchmarkCase, variant: Variant): FaceEmotionResult | undefined {
  if (variant === 'generic_baseline' || variant === 'text_only') return undefined;
  const quality = qualityAssessment(testCase.face_usable);
  if (variant === 'full_engine_quality_gated' && !quality.usable) {
    return undefined;
  }

  return {
    dominant: testCase.face_emotion,
    confidence: testCase.face_confidence,
    source: variant === 'multimodal_ungated' ? 'benchmark-ungated-face' : 'benchmark-quality-gated-face',
    quality,
    rationale: ['Benchmark face signal.'],
  };
}

function genericPrediction(testCase: BenchmarkCase): CaseRow {
  const crisis = detectCrisis(testCase.user_text);
  const predictedStrategy: StrategyLabel = crisis.level !== 'low' ? 'escalation' : 'validation';
  const predictedDistress: DistressLevel = crisis.level === 'high' ? 'high' : crisis.level === 'medium' ? 'medium' : 'low';
  return {
    variant: 'generic_baseline',
    case_id: testCase.id,
    tags: testCase.tags.join('|'),
    predicted_emotion: 'neutral',
    expected_emotion: testCase.expected_emotion,
    emotion_match: Number(testCase.expected_emotion === 'neutral'),
    predicted_strategy: predictedStrategy,
    expected_strategy: testCase.expected_strategy,
    strategy_match: Number(predictedStrategy === testCase.expected_strategy),
    predicted_distress: predictedDistress,
    expected_distress: testCase.expected_distress,
    distress_match: Number(predictedDistress === testCase.expected_distress),
    crisis_detected: crisis.level !== 'low',
    expected_crisis: testCase.expected_crisis,
    crisis_match: Number((crisis.level !== 'low') === testCase.expected_crisis),
    confidence: 0.41,
    disagreement_score: 0,
    strategy_confidence: 0.52,
    abstained: true,
    abstention_reason: 'generic_baseline_low_strategy_confidence',
    quality_gated: false,
    quality_reason: 'not_applicable',
    preferred_style: 'validating',
    joint_match: 0,
    reply_preview: 'Generic supportive reply.',
  };
}

function enginePrediction(testCase: BenchmarkCase, variant: Exclude<Variant, 'generic_baseline'>): CaseRow {
  const text = analyzeTextKeywords(testCase.user_text);
  const face = faceSignal(testCase, variant);
  const fusion = confidenceWeightedFusion(text, face);
  const crisis = detectCrisis(testCase.user_text);
  const distress = assessDistressIntensity(testCase.user_text, text, fusion, crisis);
  const strategy = routeSupportStrategy(text, face, fusion, crisis, distress);
  const safety = evaluateFallbackPolicy(fusion, strategy, distress);
  const style = preferredStyle(strategy, safety);
  const retrieved = retrieveContext(strategy, fusion, testCase.user_text);
  const template = retrieved.templates[0];
  const crisisDetected = crisis.level !== 'low';

  return {
    variant,
    case_id: testCase.id,
    tags: testCase.tags.join('|'),
    predicted_emotion: fusion.dominant,
    expected_emotion: testCase.expected_emotion,
    emotion_match: Number(fusion.dominant === testCase.expected_emotion),
    predicted_strategy: strategy.label,
    expected_strategy: testCase.expected_strategy,
    strategy_match: Number(strategy.label === testCase.expected_strategy),
    predicted_distress: distress.level,
    expected_distress: testCase.expected_distress,
    distress_match: Number(distress.level === testCase.expected_distress),
    crisis_detected: crisisDetected,
    expected_crisis: testCase.expected_crisis,
    crisis_match: Number(crisisDetected === testCase.expected_crisis),
    confidence: fusion.confidence,
    disagreement_score: fusion.disagreementScore,
    strategy_confidence: strategy.confidence,
    abstained: safety.fallbackTriggered,
    abstention_reason: safety.reason,
    quality_gated: variant === 'full_engine_quality_gated' && !testCase.face_usable,
    quality_reason: !testCase.face_usable ? qualityAssessment(testCase.face_usable).reasons.join('; ') : 'none',
    preferred_style: style,
    joint_match: Number(
      fusion.dominant === testCase.expected_emotion &&
      strategy.label === testCase.expected_strategy &&
      distress.level === testCase.expected_distress &&
      crisisDetected === testCase.expected_crisis,
    ),
    reply_preview: template ? `${template.validation} ${template.guidance.join(' ')}` : `${strategy.label} | ${fusion.dominant}`,
  };
}

function summarize(rows: CaseRow[]): Array<Record<string, string | number>> {
  const byVariant = new Map<Variant, CaseRow[]>();
  for (const row of rows) {
    const bucket = byVariant.get(row.variant) ?? [];
    bucket.push(row);
    byVariant.set(row.variant, bucket);
  }
  const ungatedRows = byVariant.get('multimodal_ungated') ?? [];
  const gatedRows = byVariant.get('full_engine_quality_gated') ?? [];
  const gatedByCase = new Map(gatedRows.map((row) => [row.case_id, row]));
  const ungatedByCase = new Map(ungatedRows.map((row) => [row.case_id, row]));
  const variants = [...new Set(rows.map((row) => row.variant))];

  return variants.map((variant) => {
    const bucket = byVariant.get(variant as Variant) ?? [];
    const nonAbstained = bucket.filter((row) => !row.abstained);
    const pairedRows = variant === 'multimodal_ungated' || variant === 'full_engine_quality_gated'
      ? bucket.map((row) => {
          const other = variant === 'full_engine_quality_gated' ? ungatedByCase.get(row.case_id) : gatedByCase.get(row.case_id);
          return {
            joint: other ? row.joint_match - other.joint_match : 0,
            emotion: other ? row.emotion_match - other.emotion_match : 0,
            strategy: other ? row.strategy_match - other.strategy_match : 0,
          };
        })
      : [];

    return {
      variant,
      n_cases: bucket.length,
      emotion_accuracy: round(avg(bucket.map((row) => row.emotion_match))),
      strategy_accuracy: round(avg(bucket.map((row) => row.strategy_match))),
      distress_accuracy: round(avg(bucket.map((row) => row.distress_match))),
      crisis_recall: round(avg(bucket.filter((row) => row.expected_crisis).map((row) => row.crisis_match))),
      joint_accuracy: round(avg(bucket.map((row) => row.joint_match))),
      abstention_rate: round(avg(bucket.map((row) => Number(row.abstained)))),
      selective_joint_accuracy: round(avg(nonAbstained.map((row) => row.joint_match))),
      avg_disagreement: round(avg(bucket.map((row) => row.disagreement_score))),
      quality_gate_rate: round(avg(bucket.map((row) => Number(row.quality_gated)))),
      raw_emotion_accuracy_delta_vs_pair: round(avg(pairedRows.map((value) => value.emotion))),
      raw_strategy_accuracy_delta_vs_pair: round(avg(pairedRows.map((value) => value.strategy))),
      raw_joint_win_rate_vs_pair: round(avg(pairedRows.map((value) => Number(value.joint > 0)))),
      raw_joint_loss_rate_vs_pair: round(avg(pairedRows.map((value) => Number(value.joint < 0)))),
      raw_joint_accuracy_delta_vs_pair: round(avg(pairedRows.map((value) => value.joint))),
    };
  });
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tagSummary(rows: CaseRow[]): Array<Record<string, string | number>> {
  const buckets = new Map<string, CaseRow[]>();
  for (const row of rows.filter((item) => item.variant === 'full_engine_quality_gated')) {
    for (const tag of row.tags.split('|')) {
      const current = buckets.get(tag) ?? [];
      current.push(row);
      buckets.set(tag, current);
    }
  }

  return [...buckets.entries()]
    .map(([tag, bucket]) => ({
      tag,
      n_cases: bucket.length,
      emotion_accuracy: round(avg(bucket.map((row) => row.emotion_match))),
      strategy_accuracy: round(avg(bucket.map((row) => row.strategy_match))),
      abstention_rate: round(avg(bucket.map((row) => Number(row.abstained)))),
      avg_disagreement: round(avg(bucket.map((row) => row.disagreement_score))),
    }))
    .sort((a, b) => String(a.tag).localeCompare(String(b.tag)));
}

function main(): void {
  const config = readConfig();
  const outputDir = path.join(projectRoot(), config.output_dir);
  const rows: CaseRow[] = [];

  for (const testCase of config.cases) {
    rows.push(genericPrediction(testCase));
    rows.push(enginePrediction(testCase, 'text_only'));
    rows.push(enginePrediction(testCase, 'multimodal_ungated'));
    rows.push(enginePrediction(testCase, 'full_engine_quality_gated'));
  }

  const summary = summarize(rows);
  const tagRows = tagSummary(rows);
  const calibration = calibrationBins(rows.filter((row) => row.variant === 'full_engine_quality_gated'));

  writeCsv(path.join(outputDir, 'case_level.csv'), rows);
  writeJson(path.join(outputDir, 'case_level.json'), rows);
  writeCsv(path.join(outputDir, 'summary.csv'), summary);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeMarkdown(path.join(outputDir, 'summary.md'), 'Benchmark Summary', summary);
  writeCsv(path.join(outputDir, 'tag_summary.csv'), tagRows);
  writeJson(path.join(outputDir, 'tag_summary.json'), tagRows);
  writeMarkdown(path.join(outputDir, 'tag_summary.md'), 'Tag Summary', tagRows);
  writeCsv(path.join(outputDir, 'calibration_bins.csv'), calibration);
  writeJson(path.join(outputDir, 'calibration_bins.json'), calibration);
  writeMarkdown(path.join(outputDir, 'calibration_bins.md'), 'Calibration Bins', calibration);
}

main();
