import { StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.userWrapper : styles.assistantWrapper,
        isSystem && styles.systemWrapper,
      ]}
    >
      <Text style={[styles.label, isUser && styles.userLabel]}>
        {isSystem ? 'Safety' : isUser ? 'You' : 'Guident'}
      </Text>
      <Text style={[styles.text, isUser && styles.userText, isSystem && styles.systemText]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: '92%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  userWrapper: {
    alignSelf: 'flex-end',
    backgroundColor: '#6d5efc',
  },
  assistantWrapper: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b2240',
  },
  systemWrapper: {
    alignSelf: 'center',
    backgroundColor: '#2d1733',
    maxWidth: '100%',
  },
  label: {
    color: '#b7c4ff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userLabel: {
    color: '#ece9ff',
  },
  text: {
    color: '#f5f7ff',
    lineHeight: 22,
    fontSize: 15,
  },
  userText: {
    color: '#ffffff',
  },
  systemText: {
    color: '#ffd8e8',
  },
});
