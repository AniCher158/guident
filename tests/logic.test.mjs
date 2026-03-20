import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectCrisis } = require('../dist-node/src/safety/crisis_detector.js');
const { assessDistressIntensity } = require('../dist-node/src/emotion/distress_intensity.js');
const { analyzeTextKeywords } = require('../dist-node/src/emotion/keyword_text_analysis.js');
const { confidenceWeightedFusion } = require('../dist-node/src/fusion/confidence_weighted_fusion.js');
const { routeSupportStrategy } = require('../dist-node/src/routing/strategy_router.js');
const { evaluateFallbackPolicy } = require('../dist-node/src/safety/fallback_policy.js');

test('high-risk crisis language escalates strongly', () => {
  const crisis = detectCrisis('I want to die and I have been thinking about how to end it tonight.');
  assert.equal(crisis.level, 'high');
  assert.ok(crisis.score >= 0.72);
});

test('protective language lowers crisis level for non-explicit cases', () => {
  const crisis = detectCrisis('I am safe, but I feel hopeless and weird after everything.');
  assert.notEqual(crisis.level, 'high');
  assert.ok(crisis.score < 0.72);
});

test('quality-gated disagreement should trigger reflective listening fallback', () => {
  const text = analyzeTextKeywords('My face looked upset earlier, but honestly I am calmer now and safer now.');
  const face = {
    dominant: 'sad',
    confidence: 0.82,
    source: 'benchmark-face',
    rationale: ['synthetic test signal'],
  };
  const fusion = confidenceWeightedFusion(text, face);
  const crisis = detectCrisis('My face looked upset earlier, but honestly I am calmer now and safer now.');
  const distress = assessDistressIntensity('My face looked upset earlier, but honestly I am calmer now and safer now.', text, fusion, crisis);
  const strategy = routeSupportStrategy(text, face, fusion, crisis, distress);
  const safety = evaluateFallbackPolicy(fusion, strategy, distress);

  assert.equal(strategy.label, 'reflective_listening');
  assert.equal(safety.fallbackTriggered, true);
});

test('quality-gated face is ignored by fusion and disagreement', () => {
  const text = analyzeTextKeywords('I feel calmer now and better after talking to my coach.');
  const gatedFace = {
    dominant: 'sad',
    confidence: 0.01,
    source: 'quality-gated',
    rationale: ['suppressed'],
    quality: { usable: false, brightness: 0.8, contrast: 0.03, sharpness: 0.02, reasons: ['very low contrast'] },
  };

  const gatedFusion = confidenceWeightedFusion(text, gatedFace);
  const textOnlyFusion = confidenceWeightedFusion(text);

  assert.equal(gatedFusion.dominant, textOnlyFusion.dominant);
  assert.equal(gatedFusion.imageWeight, 0);
  assert.equal(gatedFusion.disagreementScore, 0);
});

test('contrastive recovery language favors current calmer state', () => {
  const text = analyzeTextKeywords('I was crying earlier, but after talking to my coach I feel calm, okay, and a lot better now.');

  assert.equal(text.dominant, 'calm');
  assert.ok(text.scores.find((item) => item.label === 'hopeful')?.score > 0.1);
});

test('anxious text routes to grounding', () => {
  const text = analyzeTextKeywords('School is too much and I feel nervous and overwhelmed.');
  const fusion = confidenceWeightedFusion(text);
  const crisis = detectCrisis('School is too much and I feel nervous and overwhelmed.');
  const distress = assessDistressIntensity('School is too much and I feel nervous and overwhelmed.', text, fusion, crisis);
  const strategy = routeSupportStrategy(text, undefined, fusion, crisis, distress);

  assert.equal(strategy.label, 'grounding');
});
