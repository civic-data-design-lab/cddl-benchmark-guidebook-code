const unavailable = () => Promise.reject(new Error('PLSK desktop API is unavailable. Run this app inside Electron.'));

export const plskApi = window.plsk || {
  checkDependencies: unavailable,
  getTailscaleStatus: unavailable,
  testConnection: unavailable,
  openTerminal: unavailable,
  openVSCode: unavailable,
  saveDevice: unavailable,
  loadDevice: unavailable,
};
