export function getJetsonHost(sshAddress) {
  const value = String(sshAddress || '').trim();
  if (!value) {
    return '';
  }
  return value.includes('@') ? value.split('@').slice(1).join('@') : value;
}

export function buildPreviewStreamUrl(sshAddress, port = 8089) {
  const host = getJetsonHost(sshAddress);
  if (!host) {
    return '';
  }
  const safePort = Number(port) || 8089;
  return `http://${host}:${safePort}/stream`;
}
