import { useEffect, useState } from 'react';
import ActionButtons from './components/ActionButtons.jsx';
import CameraManager from './components/CameraManager.jsx';
import DeviceForm from './components/DeviceForm.jsx';
import Header from './components/Header.jsx';
import JetsonControlPanel from './components/JetsonControlPanel.jsx';
import SetupChecklist from './components/SetupChecklist.jsx';
import StatusMessage from './components/StatusMessage.jsx';
import { plskApi } from './lib/api.js';

const DEFAULT_DEVICE = {
  sshAddress: '',
  remotePath: '/home/min',
};

const DEFAULT_MONITOR_CONFIG = {
  logPath: '/home/lcau/jetson_status_log.csv',
  intervalSeconds: 60,
  sessionName: 'plsk_monitor',
};

const DEFAULT_CAMERA_CONFIG = {
  basePath: '/home/lcau/benchmark-aus-2/code/gopro',
  streamScript: 'gopro_start_stream_lin_loop.py',
  stopScript: 'gopro_stop_stream.py',
  captureScript: 'gopro_capture_stream.py',
  collectorScript: 'gopro_download_stream_interval.py',
  streamSession: 'gopro_stream',
  collectorSession: 'gopro_collector',
  streamUrl: 'udp://@0.0.0.0:8554',
  durationSeconds: 60,
  samples: 24,
  pauseSeconds: 3540,
};

export default function App() {
  const [device, setDevice] = useState(DEFAULT_DEVICE);
  const [dependencies, setDependencies] = useState(null);
  const [tailscaleStatus, setTailscaleStatus] = useState('');
  const [status, setStatus] = useState(null);
  const [jetsonStatus, setJetsonStatus] = useState(null);
  const [telemetry, setTelemetry] = useState({ samples: [], latest: null, logPath: '' });
  const [monitorConfig, setMonitorConfig] = useState(DEFAULT_MONITOR_CONFIG);
  const [monitorRunning, setMonitorRunning] = useState(null);
  const [remoteBrowser, setRemoteBrowser] = useState({ path: '/home/lcau', entries: [] });
  const [cameraConfig, setCameraConfig] = useState(DEFAULT_CAMERA_CONFIG);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [cameraLog, setCameraLog] = useState('');
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const [connectionLabel, setConnectionLabel] = useState('Not tested');
  const [activePage, setActivePage] = useState('setup');
  const [checking, setChecking] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    let mounted = true;

    plskApi.loadDevice()
      .then((result) => {
        if (mounted && result?.device) {
          setDevice(result.device);
        }
      })
      .catch((error) => {
        if (mounted) {
          setStatus({ type: 'error', message: error.message });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function runSetupCheck() {
    setChecking(true);
    setStatus(null);

    try {
      const result = await plskApi.checkDependencies();
      setDependencies(result);
      setStatus({ type: 'success', message: 'Setup check complete.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setChecking(false);
    }
  }

  async function readTailscaleStatus() {
    setCheckingStatus(true);
    setStatus(null);

    try {
      const result = await plskApi.getTailscaleStatus();
      setTailscaleStatus(result.ok ? result.message : `${result.message}\n${result.detail || ''}`.trim());
      setStatus({ type: result.ok ? 'success' : 'error', message: result.ok ? 'Tailscale status loaded.' : result.message });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setCheckingStatus(false);
    }
  }

  async function saveDevice(event) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const result = await plskApi.saveDevice(device);
      if (!result.ok) {
        setStatus({ type: 'error', message: result.message });
        return;
      }

      setDevice(result.device);
      setStatus({ type: 'success', message: result.message });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setBusyAction('test');
    setStatus(null);
    setConnectionLabel('Testing');

    try {
      const result = await plskApi.testConnection(device.sshAddress);
      setConnectionLabel(result.ok ? 'Connected' : 'Failed');
      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setConnectionLabel('Failed');
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function openTerminal() {
    setBusyAction('terminal');
    setStatus(null);

    try {
      const result = await plskApi.openTerminal(device.sshAddress);
      setStatus({ type: result.ok ? 'success' : 'error', message: result.message });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function openVSCode() {
    setBusyAction('vscode');
    setStatus(null);

    try {
      const result = await plskApi.openVSCode(device.sshAddress, device.remotePath);
      setStatus({ type: result.ok ? 'success' : 'error', message: result.message });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function refreshJetsonStatus() {
    setBusyAction('jetson-status');
    setStatus(null);

    try {
      const result = await plskApi.getJetsonStatus(device.sshAddress);
      if (result.ok) {
        setJetsonStatus(result.status);
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function rebootJetson() {
    const confirmed = window.confirm(
      `Reboot ${device.sshAddress || 'the saved Jetson'} now? The connection will drop while it restarts.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction('reboot');
    setStatus(null);

    try {
      const result = await plskApi.rebootJetson(device.sshAddress);
      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function refreshTelemetry() {
    setBusyAction('telemetry');
    setStatus(null);

    try {
      const result = await plskApi.getTelemetryLog(device.sshAddress, monitorConfig);
      if (result.ok) {
        setTelemetry({
          samples: result.samples || [],
          latest: result.latest || null,
          logPath: result.logPath || '',
        });
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function checkMonitorStatus() {
    setBusyAction('monitor-status');
    setStatus(null);

    try {
      const result = await plskApi.getMonitorStatus(device.sshAddress, monitorConfig);
      if (result.ok) {
        setMonitorRunning(result.running);
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function startMonitor() {
    setBusyAction('monitor-start');
    setStatus(null);

    try {
      const result = await plskApi.startMonitor(device.sshAddress, monitorConfig);
      if (result.ok) {
        setMonitorRunning(true);
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function stopMonitor() {
    setBusyAction('monitor-stop');
    setStatus(null);

    try {
      const result = await plskApi.stopMonitor(device.sshAddress, monitorConfig);
      if (result.ok) {
        setMonitorRunning(false);
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function browseRemotePath(remotePath) {
    setBusyAction('browse-path');
    setStatus(null);

    try {
      const result = await plskApi.listRemotePath(device.sshAddress, remotePath);
      if (result.ok) {
        setRemoteBrowser({
          path: result.path || remotePath,
          entries: result.entries || [],
        });
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  function setActionStatus(result) {
    setStatus({
      type: result.ok ? 'success' : 'error',
      message: result.message,
      detail: result.detail,
    });
  }

  async function scanWifiNetworks() {
    setBusyAction('wifi-scan');
    setStatus(null);

    try {
      const result = await plskApi.scanWifiNetworks(device.sshAddress);
      if (result.ok) {
        setWifiNetworks(result.networks || []);
      }
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function connectWifi(credentials) {
    const confirmed = window.confirm(
      `Connect the Jetson to Wi-Fi network "${credentials.ssid}"? If SSH depends on the current network, the connection may drop.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction('wifi-connect');
    setStatus(null);

    try {
      const result = await plskApi.connectWifi(device.sshAddress, credentials);
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function disconnectWifi() {
    const confirmed = window.confirm('Disconnect the Jetson Wi-Fi connection? This may drop SSH access.');

    if (!confirmed) {
      return;
    }

    setBusyAction('wifi-disconnect');
    setStatus(null);

    try {
      const result = await plskApi.disconnectWifi(device.sshAddress);
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function setWifiPower(powerState) {
    const confirmed =
      powerState === 'off'
        ? window.confirm('Turn off Jetson Wi-Fi? This may drop SSH access.')
        : true;

    if (!confirmed) {
      return;
    }

    setBusyAction(`wifi-${powerState}`);
    setStatus(null);

    try {
      const result = await plskApi.setWifiPower(device.sshAddress, powerState);
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function scanBluetoothDevices() {
    setBusyAction('bluetooth-scan');
    setStatus(null);

    try {
      const result = await plskApi.scanBluetoothDevices(device.sshAddress);
      if (result.ok) {
        setBluetoothDevices(result.devices || []);
      }
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function setBluetoothPower(powerState) {
    setBusyAction(`bluetooth-${powerState}`);
    setStatus(null);

    try {
      const result = await plskApi.setBluetoothPower(device.sshAddress, powerState);
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function runBluetoothDeviceAction(action, deviceAddress) {
    setBusyAction(`bluetooth-${action}`);
    setStatus(null);

    try {
      const result = await plskApi.runBluetoothDeviceAction(device.sshAddress, action, deviceAddress);
      setActionStatus(result);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function checkCameraStatus() {
    setBusyAction('camera-status');
    setStatus(null);

    try {
      const result = await plskApi.getCameraStatus(device.sshAddress, cameraConfig);
      if (result.ok) {
        setCameraStatus(result.status);
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  async function runCameraAction(action) {
    setBusyAction(`camera-${action}`);
    setStatus(null);

    try {
      const result = await plskApi.runCameraAction(device.sshAddress, action, cameraConfig);
      if (action === 'read-logs' && result.ok) {
        setCameraLog(result.detail || '');
      }

      setStatus({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setBusyAction('');
    }
  }

  function renderActivePage() {
    if (activePage === 'access') {
      return (
        <ActionButtons
          connectionLabel={connectionLabel}
          busyAction={busyAction}
          onTestConnection={testConnection}
          onOpenTerminal={openTerminal}
          onOpenVSCode={openVSCode}
        />
      );
    }

    if (activePage === 'control') {
      return (
        <JetsonControlPanel
          sshAddress={device.sshAddress}
          jetsonStatus={jetsonStatus}
          telemetry={telemetry}
          monitorConfig={monitorConfig}
          monitorRunning={monitorRunning}
          remoteBrowser={remoteBrowser}
          wifiNetworks={wifiNetworks}
          bluetoothDevices={bluetoothDevices}
          busyAction={busyAction}
          onMonitorConfigChange={setMonitorConfig}
          onCheckMonitorStatus={checkMonitorStatus}
          onStartMonitor={startMonitor}
          onStopMonitor={stopMonitor}
          onBrowseRemotePath={browseRemotePath}
          onRefreshStatus={refreshJetsonStatus}
          onRefreshTelemetry={refreshTelemetry}
          onReboot={rebootJetson}
          onScanWifi={scanWifiNetworks}
          onConnectWifi={connectWifi}
          onDisconnectWifi={disconnectWifi}
          onSetWifiPower={setWifiPower}
          onScanBluetooth={scanBluetoothDevices}
          onSetBluetoothPower={setBluetoothPower}
          onBluetoothDeviceAction={runBluetoothDeviceAction}
        />
      );
    }

    if (activePage === 'camera') {
      return (
        <CameraManager
          cameraConfig={cameraConfig}
          cameraStatus={cameraStatus}
          cameraLog={cameraLog}
          busyAction={busyAction}
          onCameraConfigChange={setCameraConfig}
          onCheckCamera={checkCameraStatus}
          onCameraAction={runCameraAction}
        />
      );
    }

    return (
      <>
        <SetupChecklist
          dependencies={dependencies}
          tailscaleStatus={tailscaleStatus}
          checking={checking}
          checkingStatus={checkingStatus}
          onRunCheck={runSetupCheck}
          onTailscaleStatus={readTailscaleStatus}
        />

        <DeviceForm device={device} saving={saving} onChange={setDevice} onSave={saveDevice} />
      </>
    );
  }

  return (
    <main className="app-shell">
      <Header activePage={activePage} onPageChange={setActivePage} />

      <div className="content">
        {renderActivePage()}

        <StatusMessage status={status} />
      </div>
    </main>
  );
}
