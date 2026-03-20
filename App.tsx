import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LocalLLM } from './src/services/LocalLLM';
import { ModelLoader } from './src/services/ModelLoader';
import { DisclaimerScreen } from './src/screens/DisclaimerScreen';
import { GuidentScreen } from './src/screens/GuidentScreen';

export default function App() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    ModelLoader.init();
    LocalLLM.init();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      {accepted ? <GuidentScreen /> : <DisclaimerScreen onContinue={() => setAccepted(true)} />}
    </>
  );
}
