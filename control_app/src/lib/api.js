const unavailable = () =>
  Promise.reject(new Error('PLSK desktop API is unavailable. Run this app inside Electron (npm start).'));

const fallbackApi = {
  checkDependencies: unavailable,
  getTailscaleStatus: unavailable,
  testConnection: unavailable,
  getJetsonStatus: unavailable,
  rebootJetson: unavailable,
  getTelemetryLog: unavailable,
  getMonitorStatus: unavailable,
  startMonitor: unavailable,
  stopMonitor: unavailable,
  listRemotePath: unavailable,
  scanWifiNetworks: unavailable,
  connectWifi: unavailable,
  disconnectWifi: unavailable,
  setWifiPower: unavailable,
  scanBluetoothDevices: unavailable,
  setBluetoothPower: unavailable,
  runBluetoothDeviceAction: unavailable,
  getCameraStatus: unavailable,
  runCameraAction: unavailable,
  fetchCapture: unavailable,
  patchGoproToJetson: unavailable,
  grantPasswordlessSudo: unavailable,
  openTerminal: unavailable,
  openVSCode: unavailable,
  saveDevice: unavailable,
  loadDevice: unavailable,
};

function resolvePlskApi() {
  if (typeof window !== 'undefined' && window.plsk) {
    return window.plsk;
  }
  return fallbackApi;
}

export const plskApi = new Proxy(fallbackApi, {
  get(_target, prop) {
    const api = resolvePlskApi();
    const value = api[prop];
    if (typeof value === 'function') {
      return (...args) => value.apply(api, args);
    }
    return value;
  },
});
