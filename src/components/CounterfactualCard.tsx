import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CounterfactualAnalysis } from '../types/index';

interface CounterfactualCardProps {
  counterfactuals: CounterfactualAnalysis[];
  activeIndex: number;
  onStep: (nextIndex: number) => void;
}

function reliabilityLabel(item: CounterfactualAnalysis): string {
  if (item.analysis.face?.source === 'quality-gated') return 'face suppressed';
  if (item.analysis.face) return 'face used';
  return 'text only';
}

export function CounterfactualCard({ counterfactuals, activeIndex, onStep }: CounterfactualCardProps) {
  if (counterfactuals.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Judge counterfactuals</Text>
        <Text style={styles.body}>Run a reflection to step through the same check-in with text-only, ungated, and quality-gated reasoning.</Text>
      </View>
    );
  }

  const active = counterfactuals[Math.max(0, Math.min(activeIndex, counterfactuals.length - 1))];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Judge counterfactuals</Text>
          <Text style={styles.caption}>
            Step {activeIndex + 1} of {counterfactuals.length} • {reliabilityLabel(active)}
          </Text>
        </View>
        <View style={styles.stepButtons}>
          <Pressable style={styles.stepButton} onPress={() => onStep((activeIndex - 1 + counterfactuals.length) % counterfactuals.length)}>
            <Text style={styles.stepButtonText}>Prev</Text>
          </Pressable>
          <Pressable style={styles.stepButton} onPress={() => onStep((activeIndex + 1) % counterfactuals.length)}>
            <Text style={styles.stepButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        {counterfactuals.map((item, index) => (
          <Pressable
            key={item.variant}
            style={[styles.tab, index === activeIndex && styles.activeTab]}
            onPress={() => onStep(index)}
          >
            <Text style={[styles.tabText, index === activeIndex && styles.activeTabText]}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.variantTitle}>{active.title}</Text>
      <Text style={styles.body}>{active.summary}</Text>
      <Text style={styles.metric}>
        Emotion {active.analysis.fusion.dominant} • Strategy {active.analysis.strategy.label} • Distress {active.analysis.distress.level}
      </Text>
      <Text style={styles.metric}>
        Confidence {Math.round(active.analysis.fusion.confidence * 100)}% • Disagreement {Math.round(active.analysis.fusion.disagreementScore * 100)}%
      </Text>
      <Text style={styles.metric}>
        Weights text {Math.round(active.analysis.fusion.textWeight * 100)}% / image {Math.round(active.analysis.fusion.imageWeight * 100)}%
      </Text>
      <Text style={styles.body}>Fusion rationale: {active.analysis.fusion.rationale[0]}</Text>
      <Text style={styles.body}>Routing rationale: {active.analysis.strategy.rationale[0]}</Text>
      <Text style={styles.body}>
        Face path: {active.analysis.face?.rationale[0] ?? 'No face signal was used in this counterfactual.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141d36',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#304067',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: '#90a0d1',
    marginTop: 4,
    fontSize: 12,
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stepButton: {
    backgroundColor: '#233055',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stepButtonText: {
    color: '#eef2ff',
    fontWeight: '700',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  tab: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a2443',
  },
  activeTab: {
    backgroundColor: '#d6e4ff',
  },
  tabText: {
    color: '#d9e0ff',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#10203f',
  },
  variantTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  metric: {
    color: '#d8def8',
    fontSize: 14,
    marginTop: 6,
  },
  body: {
    color: '#aeb9df',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
});
