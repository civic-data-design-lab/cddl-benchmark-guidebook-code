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
  basePath: '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro',
  captureOutputPath: '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check',
  streamScript: 'gopro_start_stream_lin_loop.py',
  stopScript: 'gopro_stop_stream.py',
  captureScript: 'gopro_capture_stream.py',
  tapScript: 'gopro_stream_tap.py',
  collectorScript: 'gopro_download_stream_interval.py',
  streamSession: 'gopro_stream',
  tapSession: 'gopro_tap',
  collectorSession: 'gopro_collector',
  streamUrl: 'udp://@0.0.0.0:8554',
  durationSeconds: 60,
  samples: 24,
  pauseSeconds: 3540,
  useSudo: true,
};

function getCaptureOutputDir(cameraConfig) {
  const configured = String(cameraConfig?.captureOutputPath || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const base = String(cameraConfig?.basePath || '').trim().replace(/\/$/, '');
  return base ? `${base}/view_check` : '';
}

function resolveCapturePath(parsed, captureOutputDir) {
  const value = (parsed || '').trim();
  if (!value) {
    return null;
  }

  const basename = value.split('/').filter(Boolean).pop() || value;
  const segmentCount = value.split('/').filter(Boolean).length;
  const isRootLevelCapture = /^\/img_[^/]+\.(?:jpe?g|png)$/i.test(value);
  const isFilenameOnly = !value.startsWith('/') || segmentCount <= 1;

  if (captureOutputDir && (isFilenameOnly || isRootLevelCapture)) {
    return `${captureOutputDir.replace(/\/$/, '')}/${basename}`;
  }

  return value;
}

function parseCaptureError(detail) {
  const cleanDetail = (detail || '').replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
  const errorMatch = cleanDetail.match(/CAPTURE_ERROR:([^\n\r]+)/);
  if (errorMatch) {
    return errorMatch[1].trim();
  }
  if (/bind failed: Address already in use/i.test(cleanDetail)) {
    return 'UDP port 8554 is already in use. Stop Stream, then Start Stream again (starts the stream tap).';
  }
  if (/Failed to open the video stream/i.test(cleanDetail)) {
    return 'Could not open the video stream. Start the GoPro stream first, then capture again.';
  }
  return null;
}

function parseCapturePath(detail, captureOutputDir) {
  const cleanDetail = (detail || '').replace(/\x1b\[[0-9;]*[mGKHF]/g, '');

  const capPathMatch = cleanDetail.match(/CAPTURE_PATH:\s*([^\n\r]+)/);
  if (capPathMatch) {
    return resolveCapturePath(capPathMatch[1].trim(), captureOutputDir);
  }

  const legacyMatch = cleanDetail.match(/Frame captured and saved as ([^\n\r]+)/);
  if (legacyMatch) {
    return resolveCapturePath(legacyMatch[1].trim(), captureOutputDir);
  }

  const imagePaths = [...cleanDetail.matchAll(/(\/[^\s\n\r'"]+\.(?:jpe?g|png))/gi)].map((match) => match[1].trim());
  if (imagePaths.length > 0) {
    const longest = imagePaths.sort((a, b) => b.length - a.length)[0];
    return resolveCapturePath(longest, captureOutputDir);
  }

  const filenameMatch = cleanDetail.match(/\b(img_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(?:jpe?g|png))\b/i);
  if (filenameMatch && captureOutputDir) {
    return `${captureOutputDir.replace(/\/$/, '')}/${filenameMatch[1]}`;
  }

  return null;
}

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
  const [captureImage, setCaptureImage] = useState(null); // { dataUrl, path }
  const [capturePreviewError, setCapturePreviewError] = useState('');
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

  async function grantPasswordlessSudo() {
    const confirmed = window.confirm(
      'This will grant passwordless sudo to the Jetson user via /etc/sudoers.d/.\n\nContinue?',
    );
    if (!confirmed) return;

    setBusyAction('grant-sudo');
    setStatus(null);

    // Extract username from sshAddress (e.g. "lcau@100.x.x.x" → "lcau")
    const username = device.sshAddress.includes('@')
      ? device.sshAddress.split('@')[0]
      : 'lcau';

    try {
      const result = await plskApi.grantPasswordlessSudo(device.sshAddress, username);
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

  async function patchGoproToJetson() {
    if (!device.sshAddress) {
      setStatus({ type: 'error', message: 'Set the Jetson SSH address on the Setup page first.' });
      return;
    }

    setBusyAction('patch-gopro-jetson');
    setStatus(null);

    try {
      const result = await plskApi.patchGoproToJetson(device.sshAddress, cameraConfig);
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

    if (action === 'capture-frame') {
      setCaptureImage(null);
      setCapturePreviewError('');
    }

    if (action === 'read-logs') {
      setCameraLog('[Stream]\nAttempting to connect via Bluetooth...\nNeed to run as sudo. Enter password:\n');
    }

    try {
      const result = await plskApi.runCameraAction(device.sshAddress, action, cameraConfig);
      if (action === 'read-logs' && result.ok) {
        setCameraLog(result.detail || '');
      }

      let previewFailed = false;

      if (action === 'capture-frame') {
        const detail = result.detail || '';
        const captureError = parseCaptureError(detail);

        if (!result.ok || captureError) {
          previewFailed = true;
          const previewMessage = captureError || result.message || 'Capture failed on the Jetson.';
          setCapturePreviewError(detail ? `${previewMessage}\n\nRaw output:\n${detail}` : previewMessage);
          setStatus({
            type: 'error',
            message: previewMessage,
            detail,
          });
        } else {
        const remotePath = parseCapturePath(detail, getCaptureOutputDir(cameraConfig));
        if (remotePath) {
          try {
            const imgResult = await plskApi.fetchCapture(
              device.sshAddress,
              remotePath,
              cameraConfig.useSudo !== false,
            );
            if (imgResult.ok) {
              setCaptureImage({ dataUrl: imgResult.dataUrl, path: imgResult.path });
            } else {
              previewFailed = true;
              const previewMessage = `Preview failed: ${imgResult.message}`;
              setCapturePreviewError(
                imgResult.detail ? `${previewMessage}\n${imgResult.detail}` : previewMessage,
              );
              setStatus({ type: 'error', message: previewMessage, detail: imgResult.detail });
            }
          } catch (fetchError) {
            previewFailed = true;
            setCapturePreviewError(`Preview fetch error: ${fetchError.message}`);
            setStatus({ type: 'error', message: `Preview fetch error: ${fetchError.message}` });
          }
        } else {
          previewFailed = true;
          const previewMessage =
            'Capture succeeded but could not find the saved file path in script output.';
          setCapturePreviewError(`${previewMessage}\nRaw output: ${detail}`);
          setStatus({
            type: 'error',
            message: previewMessage,
            detail: `Raw output: ${detail}`,
          });
        }
        }
      }

      if (!(action === 'capture-frame' && previewFailed)) {
        setStatus({
          type: result.ok ? 'success' : 'error',
          message: result.message,
          detail: result.detail,
        });
      }
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
          captureImage={captureImage}
          capturePreviewError={capturePreviewError}
          busyAction={busyAction}
          onCameraConfigChange={setCameraConfig}
          onCheckCamera={checkCameraStatus}
          onCameraAction={runCameraAction}
          onGrantPasswordlessSudo={grantPasswordlessSudo}
          onClearCapture={() => {
            setCaptureImage(null);
            setCapturePreviewError('');
          }}
          onPatchGoproToJetson={patchGoproToJetson}
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
