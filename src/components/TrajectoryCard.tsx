import { StyleSheet, Text, View } from 'react-native';
import { SessionTrendSummary } from '../services/SessionMemory';

interface TrajectoryCardProps {
  summary?: SessionTrendSummary;
}

export function TrajectoryCard({ summary }: TrajectoryCardProps) {
  if (!summary || summary.count === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Local trajectory memory</Text>
        <Text style={styles.body}>Guident can now keep a private on-device summary of recent check-ins to show patterns over time.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Local trajectory memory</Text>
      <Text style={styles.metric}>Recent check-ins: {summary.count}</Text>
      <Text style={styles.metric}>Most recent emotion: {summary.recentEmotion}</Text>
      <Text style={styles.metric}>Dominant recent pattern: {summary.dominantTrend}</Text>
      <Text style={styles.metric}>Average confidence: {Math.round(summary.averageConfidence * 100)}%</Text>
      <Text style={styles.metric}>High-distress rate: {Math.round(summary.highDistressRate * 100)}%</Text>
      <Text style={styles.body}>Latest support strategy: {summary.latestStrategy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f1730',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#2d3960',
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
});
