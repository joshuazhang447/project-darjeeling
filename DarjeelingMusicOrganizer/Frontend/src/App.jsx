import { useState, useEffect } from 'react';
import Setup from './components/Setup';
import Display from './components/Display';
import Loading from './components/Loading';
import TopBar from './components/TopBar';

function App() {
  const [configured, setConfigured] = useState(null); // null = loading

  useEffect(() => {
    const checkSettings = async () => {
      const startTime = Date.now();
      let isConfigured = false;

      //Check the bridge presence
      if (window.chrome?.webview?.hostObjects?.appBridge) {
        try {
          const settings = await window.chrome.webview.hostObjects.appBridge.GetSettings();
          if (settings) {
            isConfigured = true;
          }
        } catch (e) {
          console.error("Failed to get settings", e);
        }
      } else {
        //Mock mode fall back
        console.warn("Bridge not found, defaulting to Setup flow check (mock)");
      }

      //Ensure a minimum loading time of 1000ms to allow animation to actually play smoothly
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1000 - elapsed);

      setTimeout(() => {
        setConfigured(isConfigured);
      }, remaining);
    };

    checkSettings();
  }, []);

  if (configured === null) {
    return (
      <>
        <TopBar />
        <Loading message="Initializing..." />
      </>
    );
  }

  return (
    <>
      <TopBar />
      {configured ? <Display /> : <Setup onComplete={() => setConfigured(true)} />}
    </>
  );
}

export default App;
