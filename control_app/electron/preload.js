import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('plsk', {
  checkDependencies: () => ipcRenderer.invoke('plsk:check-dependencies'),
  getTailscaleStatus: () => ipcRenderer.invoke('plsk:tailscale-status'),
  testConnection: (sshAddress) => ipcRenderer.invoke('plsk:test-connection', sshAddress),
  openTerminal: (sshAddress) => ipcRenderer.invoke('plsk:open-terminal', sshAddress),
  openVSCode: (sshAddress, remotePath) => ipcRenderer.invoke('plsk:open-vscode', sshAddress, remotePath),
  saveDevice: (device) => ipcRenderer.invoke('plsk:save-device', device),
  loadDevice: () => ipcRenderer.invoke('plsk:load-device'),
});
