import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('plsk', {
  checkDependencies: () => ipcRenderer.invoke('plsk:check-dependencies'),
  getTailscaleStatus: () => ipcRenderer.invoke('plsk:tailscale-status'),
  testConnection: (sshAddress) => ipcRenderer.invoke('plsk:test-connection', sshAddress),
  getJetsonStatus: (sshAddress) => ipcRenderer.invoke('plsk:jetson-status', sshAddress),
  rebootJetson: (sshAddress) => ipcRenderer.invoke('plsk:reboot-jetson', sshAddress),
  getTelemetryLog: (sshAddress, config) => ipcRenderer.invoke('plsk:telemetry-log', sshAddress, config),
  getMonitorStatus: (sshAddress, config) => ipcRenderer.invoke('plsk:monitor-status', sshAddress, config),
  startMonitor: (sshAddress, config) => ipcRenderer.invoke('plsk:start-monitor', sshAddress, config),
  stopMonitor: (sshAddress, config) => ipcRenderer.invoke('plsk:stop-monitor', sshAddress, config),
  listRemotePath: (sshAddress, remotePath) => ipcRenderer.invoke('plsk:list-remote-path', sshAddress, remotePath),
  scanWifiNetworks: (sshAddress) => ipcRenderer.invoke('plsk:wifi-scan', sshAddress),
  connectWifi: (sshAddress, credentials) => ipcRenderer.invoke('plsk:wifi-connect', sshAddress, credentials),
  disconnectWifi: (sshAddress) => ipcRenderer.invoke('plsk:wifi-disconnect', sshAddress),
  setWifiPower: (sshAddress, powerState) => ipcRenderer.invoke('plsk:wifi-power', sshAddress, powerState),
  scanBluetoothDevices: (sshAddress) => ipcRenderer.invoke('plsk:bluetooth-scan', sshAddress),
  setBluetoothPower: (sshAddress, powerState) => ipcRenderer.invoke('plsk:bluetooth-power', sshAddress, powerState),
  runBluetoothDeviceAction: (sshAddress, action, deviceAddress) =>
    ipcRenderer.invoke('plsk:bluetooth-device-action', sshAddress, action, deviceAddress),
  getCameraStatus: (sshAddress, config) => ipcRenderer.invoke('plsk:camera-status', sshAddress, config),
  runCameraAction: (sshAddress, action, config) => ipcRenderer.invoke('plsk:camera-action', sshAddress, action, config),
  grantPasswordlessSudo: (sshAddress, username) => ipcRenderer.invoke('plsk:grant-passwordless-sudo', sshAddress, username),
  openTerminal: (sshAddress) => ipcRenderer.invoke('plsk:open-terminal', sshAddress),
  openVSCode: (sshAddress, remotePath) => ipcRenderer.invoke('plsk:open-vscode', sshAddress, remotePath),
  saveDevice: (device) => ipcRenderer.invoke('plsk:save-device', device),
  loadDevice: () => ipcRenderer.invoke('plsk:load-device'),
});
