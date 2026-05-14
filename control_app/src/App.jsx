import { useEffect, useState } from 'react';
import ActionButtons from './components/ActionButtons.jsx';
import DeviceForm from './components/DeviceForm.jsx';
import Header from './components/Header.jsx';
import HelpPanel from './components/HelpPanel.jsx';
import SetupChecklist from './components/SetupChecklist.jsx';
import StatusMessage from './components/StatusMessage.jsx';
import { plskApi } from './lib/api.js';

const DEFAULT_DEVICE = {
  sshAddress: '',
  remotePath: '/home/min',
};

export default function App() {
  const [device, setDevice] = useState(DEFAULT_DEVICE);
  const [dependencies, setDependencies] = useState(null);
  const [tailscaleStatus, setTailscaleStatus] = useState('');
  const [status, setStatus] = useState(null);
  const [connectionLabel, setConnectionLabel] = useState('Not tested');
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

  return (
    <main className="app-shell">
      <Header />

      <div className="content">
        <SetupChecklist
          dependencies={dependencies}
          tailscaleStatus={tailscaleStatus}
          checking={checking}
          checkingStatus={checkingStatus}
          onRunCheck={runSetupCheck}
          onTailscaleStatus={readTailscaleStatus}
        />

        <DeviceForm device={device} saving={saving} onChange={setDevice} onSave={saveDevice} />

        <ActionButtons
          connectionLabel={connectionLabel}
          busyAction={busyAction}
          onTestConnection={testConnection}
          onOpenTerminal={openTerminal}
          onOpenVSCode={openVSCode}
        />

        <StatusMessage status={status} />

        <HelpPanel />
      </div>
    </main>
  );
}
