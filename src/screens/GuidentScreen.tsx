import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AnalysisCard } from '../components/AnalysisCard';
import { MessageBubble } from '../components/MessageBubble';
import { SAFETY_DISCLAIMER } from '../constants/copy';
import { analyzeCheckIn } from '../services/guidentEngine';
import { AnalysisBundle, CapturedFrame, ChatMessage } from '../types';

const starterMessages: ChatMessage[] = [
  {
    id: 'system-1',
    role: 'system',
    text: SAFETY_DISCLAIMER,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    text: 'Tell me what is going on today. I will reflect what I hear, suggest small coping steps, and encourage offline support when needed.',
    createdAt: new Date().toISOString(),
  },
];

export function GuidentScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState('School and friend drama have me feeling pretty overwhelmed.');
  const [analysis, setAnalysis] = useState<AnalysisBundle>();
  const [loading, setLoading] = useState(false);
  const analyzingRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const [frame, setFrame] = useState<CapturedFrame>();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const canUseCamera = useMemo(() => permission?.granted ?? false, [permission]);

  async function handleTakePhoto() {
    if (!cameraRef.current || !cameraReady || cameraBusy) {
      setCameraError('Camera is still warming up. Wait a moment, then try again.');
      return;
    }

    try {
      setCameraBusy(true);
      setCameraError(undefined);
      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({ quality: 0.4 });
      setFrame({ uri: photo.uri, capturedAt: new Date().toISOString() });
      setCameraOpen(false);
      setCameraReady(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera capture failed.';
      setCameraError(message);
    } finally {
      setCameraBusy(false);
    }
  }

  async function handleAnalyze() {
    if (!input.trim() || analyzingRef.current) return;
    analyzingRef.current = true;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    const nextAnalysis = await analyzeCheckIn(input.trim(), frame);
    setAnalysis(nextAnalysis);

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      emotion: nextAnalysis.fusion.dominant,
      text: [
        nextAnalysis.reply.recognition,
        nextAnalysis.reply.validation,
        `Try this next: ${nextAnalysis.reply.guidance.join(' ')}`,
        nextAnalysis.reply.safetyNote,
      ]
        .filter(Boolean)
        .join('\n\n'),
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, assistantMessage]);
    setLoading(false);
    setInput('');
    analyzingRef.current = false;
  }

  // Fallback: if onCameraReady never fires within 4s, unlock the button anyway
  useEffect(() => {
    if (!cameraOpen || cameraReady) return;
    const t = setTimeout(() => setCameraReady(true), 4000);
    return () => clearTimeout(t);
  }, [cameraOpen, cameraReady]);

  async function openCamera() {
    if (!permission) return;
    if (!permission.granted) {
      const response = await requestPermission();
      if (!response.granted) return;
    }
    setCameraError(undefined);
    setCameraReady(false);
    setCameraOpen(true);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Guident</Text>
        <Text style={styles.subtitle}>Teen support prototype: reflective, safety-forward, and clear about limits.</Text>

        <AnalysisCard analysis={analysis} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Optional camera snapshot</Text>
          <Pressable style={styles.secondaryButton} onPress={openCamera}>
            <Text style={styles.secondaryButtonText}>{canUseCamera ? 'Open camera' : 'Enable camera'}</Text>
          </Pressable>
        </View>

        <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <View style={styles.cameraModal}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="front"
              onCameraReady={() => {
                setCameraReady(true);
                setCameraError(undefined);
              }}
              onMountError={(e) => setCameraError(`Mount error: ${e.message}`)}
            />
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraHint}>
                {cameraReady ? 'Camera ready.' : 'Starting camera… wait for ready before capturing.'}
              </Text>
              {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
              <View style={styles.cameraActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setCameraOpen(false);
                    setCameraReady(false);
                    setCameraError(undefined);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, (!cameraReady || cameraBusy) && styles.buttonDisabled]}
                  onPress={handleTakePhoto}
                  disabled={!cameraReady || cameraBusy}
                >
                  <Text style={styles.primaryButtonText}>{cameraBusy ? 'Capturing…' : 'Capture frame'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {frame ? <Image source={{ uri: frame.uri }} style={styles.preview} /> : null}

        <View style={styles.chatShell}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {loading ? <ActivityIndicator color="#c5cbff" style={styles.loader} /> : null}
        </View>
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="What happened today?"
          placeholderTextColor="#8d97bd"
          multiline
          value={input}
          onChangeText={setInput}
        />
        <Pressable style={styles.primaryButton} onPress={handleAnalyze} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Thinking…' : 'Reflect'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  content: {
    padding: 18,
    paddingTop: 64,
    paddingBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: '#b3bde4',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121b33',
    padding: 20,
    paddingBottom: 40,
  },
  cameraActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cameraHint: {
    color: '#b3bde4',
    marginTop: 10,
    fontSize: 13,
  },
  cameraError: {
    color: '#ffb4b4',
    marginTop: 8,
    fontSize: 13,
  },
  preview: {
    height: 180,
    borderRadius: 18,
    marginBottom: 18,
  },
  chatShell: {
    marginBottom: 120,
  },
  composer: {
    borderTopWidth: 1,
    borderColor: '#273255',
    padding: 16,
    backgroundColor: '#0f162d',
    gap: 12,
  },
  input: {
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: '#161f3b',
    color: '#ffffff',
    padding: 16,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: '#6d5efc',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  secondaryButton: {
    backgroundColor: '#1a2443',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: '#d9e0ff',
    fontWeight: '700',
  },
  loader: {
    marginTop: 12,
  },
});
