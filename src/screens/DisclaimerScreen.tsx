import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CRISIS_COPY, PRIVACY_COPY, SAFETY_DISCLAIMER, TRUSTED_ADULT_COPY } from '../constants/copy';

interface DisclaimerScreenProps {
  onContinue: () => void;
}

export function DisclaimerScreen({ onContinue }: DisclaimerScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Guident MVP</Text>
      <Text style={styles.title}>Supportive, not clinical</Text>
      <Text style={styles.body}>{SAFETY_DISCLAIMER}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Important safety</Text>
        <Text style={styles.body}>{CRISIS_COPY}</Text>
        <Text style={styles.body}>{TRUSTED_ADULT_COPY}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy in this prototype</Text>
        <Text style={styles.body}>{PRIVACY_COPY}</Text>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>I understand — continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  content: {
    padding: 24,
    paddingTop: 72,
  },
  kicker: {
    color: '#9da9d6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 16,
  },
  body: {
    color: '#d5dcfb',
    lineHeight: 22,
    fontSize: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#131c36',
    padding: 18,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#273255',
  },
  cardTitle: {
    color: '#fff1f5',
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 17,
  },
  footer: {
    marginTop: 28,
    paddingBottom: 24,
  },
  button: {
    backgroundColor: '#6d5efc',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
