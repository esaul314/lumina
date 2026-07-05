import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import RemoteControl from './components/RemoteControl';
import { normalizeSnapshot } from './state/frameSelectors';

// Create a single socket connection to the server
const socketUrl = window.location.port === '5173'
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : window.location.origin;

const socket = io(socketUrl, { autoConnect: false });
window.__socket = socket;

function App() {
  const [deviceMode, setDeviceMode] = useState(null); // 'tv' or 'remote'
  const [state, setState] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState({ localIps: [], port: 5000 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 1. Determine Device Mode
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    
    if (modeParam === 'remote' || modeParam === 'tv') {
      setDeviceMode(modeParam);
    } else {
      // Auto-detect based on screen width & User Agent
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 768;
      
      if (isMobile || isSmallScreen) {
        setDeviceMode('remote');
      } else {
        setDeviceMode('tv');
      }
    }

    // 2. Setup Socket Connection Listeners
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to Lumina Sync Server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from Lumina Sync Server');
    });

    socket.on('state-sync', (syncedState) => {
      setState(normalizeSnapshot(syncedState));
    });

    socket.on('photo-update', (photo) => {
      setState(prev => prev ? normalizeSnapshot({
        ...prev,
        activePhoto: photo,
        currentFrame: prev.currentFrame ? { ...prev.currentFrame, primary: photo } : prev.currentFrame
      }) : prev);
    });

    socket.on('second-photo-update', (photo) => {
      setState(prev => prev ? normalizeSnapshot({
        ...prev,
        activeSecondPhoto: photo,
        currentFrame: prev.currentFrame ? { ...prev.currentFrame, secondary: photo } : prev.currentFrame
      }) : prev);
    });

    socket.on('ip-info', (info) => {
      setConnectionInfo(info);
    });

    // Safe manual connection trigger after all event listeners are registered
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state-sync');
      socket.off('photo-update');
      socket.off('second-photo-update');
      socket.off('ip-info');
    };
  }, []);

  // Expose state for testing
  useEffect(() => {
    window.__state = state;
  }, [state]);

  // Sync body class dynamically for CSS scroll rules
  useEffect(() => {
    if (deviceMode) {
      document.body.classList.remove('mode-tv', 'mode-remote');
      document.body.classList.add(`mode-${deviceMode}`);
    }
  }, [deviceMode]);

  const toggleDeviceMode = () => {
    setDeviceMode(prev => prev === 'tv' ? 'remote' : 'tv');
  };

  // Show a premium glassmorphic loader while initial state syncing happens
  if (!state) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        background: '#06050b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        color: '#fff'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.05)',
          borderTopColor: '#8b5cf6',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontFamily: 'Outfit', fontWeight: 300, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.6)' }}>
          Connecting to Lumina Ambient Network...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100vw', 
      height: deviceMode === 'tv' ? '100vh' : 'auto', 
      minHeight: '100vh',
      overflow: deviceMode === 'tv' ? 'hidden' : 'visible'
    }}>
      {deviceMode === 'remote' ? (
        <RemoteControl 
          state={state} 
          socket={socket} 
          setClientState={setState}
          connected={connected} 
          connectionInfo={connectionInfo}
        />
      ) : (
        <Dashboard 
          state={state} 
          socket={socket} 
          connectionInfo={connectionInfo}
        />
      )}
      
      {/* Smart Mode Switcher floating button */}
      <button 
        onClick={toggleDeviceMode}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '8px 14px',
          color: 'rgba(255, 255, 255, 0.7)',
          fontFamily: 'Outfit',
          fontSize: '0.85rem',
          fontWeight: 400,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s',
          pointerEvents: 'auto'
        }}
        onMouseEnter={(e) => {
          e.target.style.color = '#fff';
          e.target.style.background = 'rgba(255, 255, 255, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.7)';
          e.target.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        🖥️ Switch to {deviceMode === 'tv' ? 'Remote' : 'TV View'}
      </button>
    </div>
  );
}


export default App;
