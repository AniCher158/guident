import { StyleSheet, Text, View } from 'react-native';
import { AnalysisBundle } from '../types';

interface AnalysisCardProps {
  analysis?: AnalysisBundle;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  if (!analysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>How Guident reasons</Text>
        <Text style={styles.body}>
          Text cues drive the prototype. Camera input is optional and treated as a lighter hint than what the person actually typed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Latest reflection</Text>
      <Text style={styles.metric}>Dominant emotion: {analysis.fusion.dominant}</Text>
      <Text style={styles.metric}>Confidence: {Math.round(analysis.fusion.confidence * 100)}%</Text>
      <Text style={styles.metric}>
        Weights: text {Math.round(analysis.fusion.textWeight * 100)}% / image {Math.round(analysis.fusion.imageWeight * 100)}%
      </Text>
      <Text style={styles.body}>Limbic: {analysis.text.rationale[0]}</Text>
      <Text style={styles.body}>Sensory: {analysis.face?.rationale[0] ?? 'No face input included.'}</Text>
      <Text style={styles.body}>Prefrontal: {analysis.fusion.rationale[0]}</Text>
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
