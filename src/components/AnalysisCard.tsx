import { StyleSheet, Text, View } from 'react-native';
import { AnalysisBundle } from '../types/index';
import { LocalLLM } from '../services/LocalLLM';
import { ModelLoader } from '../services/ModelLoader';
import { RemoteLLM } from '../services/RemoteLLM';

interface AnalysisCardProps {
  analysis?: AnalysisBundle;
}

function reliabilityBand(confidence: number, disagreement: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.72 && disagreement < 0.35) return 'high';
  if (confidence >= 0.46 && disagreement < 0.6) return 'medium';
  return 'low';
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  if (!analysis) {
    const modelStatus = ModelLoader.status;
    const remoteStatus = RemoteLLM.getStatus();
    const localStatus = LocalLLM.getStatus();
    const llmStatus = localStatus.status === 'ready' ? localStatus : remoteStatus.status === 'ready' ? remoteStatus : localStatus;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>How Guident reasons</Text>
        <Text style={styles.body}>
          Text cues drive the prototype. Camera input is optional and treated as a lighter hint than what the person actually typed.
        </Text>
        <Text style={styles.body}>
          Runtime: Text {modelStatus.distilbert === 'ready' ? 'ready' : 'fallback'} • Face {modelStatus.fer2013 === 'ready' ? 'ready' : 'fallback'} • Reply {llmStatus.status}
        </Text>
        <Text style={styles.body}>Reply path: {llmStatus.detail}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Latest reflection</Text>
      <Text style={styles.metric}>Dominant emotion: {analysis.fusion.dominant}</Text>
      <Text style={styles.metric}>Confidence: {Math.round(analysis.fusion.confidence * 100)}%</Text>
      <Text style={styles.metric}>
        Reliability band: {reliabilityBand(analysis.fusion.confidence, analysis.fusion.disagreementScore)}
      </Text>
      <Text style={styles.metric}>
        Weights: text {Math.round(analysis.fusion.textWeight * 100)}% / image {Math.round(analysis.fusion.imageWeight * 100)}%
      </Text>
      <Text style={styles.metric}>
        Disagreement: {Math.round(analysis.fusion.disagreementScore * 100)}% {analysis.fusion.disagreementHigh ? '(high)' : '(low)'}
      </Text>
      <Text style={styles.metric}>
        Strategy: {analysis.strategy.label} ({Math.round(analysis.strategy.confidence * 100)}%)
      </Text>
      <Text style={styles.metric}>
        Distress: {analysis.distress.level} ({Math.round(analysis.distress.score * 100)}%)
      </Text>
      <Text style={styles.metric}>
        Crisis score: {Math.round(analysis.crisis.score * 100)}% ({analysis.crisis.level})
      </Text>
      <Text style={styles.metric}>
        Safety mode: {analysis.safety.cautiousMode ? 'cautious' : 'normal'} / fallback {analysis.safety.fallbackTriggered ? 'on' : 'off'}
      </Text>
      <Text style={styles.metric}>Abstention reason: {analysis.safety.reason}</Text>
      <Text style={styles.metric}>Style: {analysis.preferredStyle}</Text>
      <Text style={styles.body}>Limbic: {analysis.text.rationale[0]}</Text>
      <Text style={styles.body}>Sensory: {analysis.face?.rationale[0] ?? 'No face input included.'}</Text>
      {analysis.face?.quality ? (
        <Text style={styles.body}>
          Face quality: {analysis.face.quality.usable ? 'usable' : 'suppressed'} • brightness {Math.round(analysis.face.quality.brightness * 100)}% • contrast {Math.round(analysis.face.quality.contrast * 100)}% • sharpness {Math.round(analysis.face.quality.sharpness * 100)}%
        </Text>
      ) : null}
      <Text style={styles.body}>Prefrontal: {analysis.fusion.rationale[0]}</Text>
      <Text style={styles.body}>Router: {analysis.strategy.rationale[0]}</Text>
      <Text style={styles.body}>Safety policy: {analysis.safety.rationale[0]}</Text>
      <Text style={styles.body}>Crisis logic: {analysis.crisis.rationale[0] ?? 'No elevated crisis cues matched.'}</Text>
      <Text style={styles.body}>Retrieval: {analysis.retrievalRationale[0] ?? 'No retrieval rationale logged.'}</Text>
      <Text style={styles.body}>
        Candidates: {analysis.candidateScores.map((item) => `${item.source}${item.style ? `:${item.style}` : ''} ${item.score.toFixed(1)}`).join(' • ')}
      </Text>
      <Text style={styles.body}>
        Fused distribution: {analysis.fusion.scores.slice(0, 3).map((item) => `${item.label} ${Math.round(item.score * 100)}%`).join(' • ')}
      </Text>
      <Text style={styles.body}>
        Runtime: {analysis.runtime.map((item) => `${item.label} ${item.status}`).join(' • ')}
      </Text>
      <Text style={[styles.body, analysis.crisis.level !== 'low' && styles.warning]}>
        Safety: {analysis.crisis.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10182f',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#293352',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  metric: {
    color: '#d8def8',
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    color: '#aeb9df',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  warning: {
    color: '#ffc4d1',
  },
});
