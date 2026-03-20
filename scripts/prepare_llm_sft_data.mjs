import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] || path.resolve(process.cwd(), '..', 'traindataforllm.jsonl');
const outputDir = path.resolve(process.cwd(), 'artifacts', 'training');
const outputPath = path.join(outputDir, 'guident_sft_clean.jsonl');
const statsPath = path.join(outputDir, 'guident_sft_clean_stats.json');

const MAX_ASSISTANT_CHARS = 1400;
const MIN_ASSISTANT_CHARS = 40;

const bannedAssistantPatterns = [
  /you are suffering from/i,
  /sounds like .* disorder/i,
  /\bi diagnose\b/i,
  /\byou have ptsd\b/i,
  /\byou have depression\b/i,
  /\byou have anxiety\b/i,
  /kill yourself/i,
  /suicide method/i,
  /self-harm instructions?/i,
];

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
}

function lastByRole(messages, role) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === role) return messages[i];
  }
  return undefined;
}

function normalizeText(text) {
  return text
    .replace(/_comma_/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeSystemPrompt() {
  return 'You are Guident, a supportive reflection assistant for teenagers. Respond warmly and specifically. Validate feelings, avoid diagnosis, avoid pretending to be a therapist, and encourage trusted offline support when risk is elevated.';
}

function shouldKeep(row) {
  const source = row.metadata?.source;
  if (source === 'oasst1') return { keep: false, reason: 'exclude_general_oasst' };

  const messages = Array.isArray(row.messages) ? row.messages : [];
  const user = lastByRole(messages, 'user')?.content;
  const assistant = lastByRole(messages, 'assistant')?.content;
  if (!user || !assistant) return { keep: false, reason: 'missing_turn' };

  const normalizedAssistant = normalizeText(assistant);
  if (normalizedAssistant.length < MIN_ASSISTANT_CHARS) return { keep: false, reason: 'assistant_too_short' };
  if (normalizedAssistant.length > MAX_ASSISTANT_CHARS) return { keep: false, reason: 'assistant_too_long' };
  if (bannedAssistantPatterns.some((pattern) => pattern.test(normalizedAssistant))) {
    return { keep: false, reason: 'unsafe_or_clinical_assistant' };
  }
  if (/^\s*(do you like|how'?d it go|maybe\.?)\s*$/i.test(normalizedAssistant)) {
    return { keep: false, reason: 'low_value_reply' };
  }

  return { keep: true, reason: 'kept' };
}

function transformRow(row) {
  const user = normalizeText(lastByRole(row.messages, 'user').content);
  const assistant = normalizeText(lastByRole(row.messages, 'assistant').content);
  return {
    messages: [
      { role: 'system', content: safeSystemPrompt() },
      { role: 'user', content: user },
      { role: 'assistant', content: assistant },
    ],
    metadata: {
      source: row.metadata?.source || 'unknown',
      topic: row.metadata?.topic || null,
      original_mixture: row.metadata?.mixture || null,
    },
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const stats = {
  input_rows: 0,
  kept_rows: 0,
  dropped_rows: 0,
  by_reason: {},
  by_source_kept: {},
};

const out = fs.createWriteStream(outputPath, 'utf8');
for (const line of readLines(inputPath)) {
  stats.input_rows += 1;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    stats.dropped_rows += 1;
    stats.by_reason.invalid_json = (stats.by_reason.invalid_json || 0) + 1;
    continue;
  }

  const decision = shouldKeep(row);
  if (!decision.keep) {
    stats.dropped_rows += 1;
    stats.by_reason[decision.reason] = (stats.by_reason[decision.reason] || 0) + 1;
    continue;
  }

  const transformed = transformRow(row);
  out.write(`${JSON.stringify(transformed)}\n`);
  stats.kept_rows += 1;
  const source = transformed.metadata.source;
  stats.by_source_kept[source] = (stats.by_source_kept[source] || 0) + 1;
}

out.end();
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

console.log(JSON.stringify({ outputPath, statsPath, stats }, null, 2));
