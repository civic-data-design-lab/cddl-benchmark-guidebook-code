const DANGEROUS_PATTERN = /[;&|`$<>\n\r]/;
const SSH_ADDRESS_PATTERN =
  /^(?:(?:[a-zA-Z_][a-zA-Z0-9_.-]{0,63})@)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?|\d{1,3}(?:\.\d{1,3}){3})$/;

export function validateSshAddress(value) {
  const sshAddress = String(value || '').trim();

  if (!sshAddress || DANGEROUS_PATTERN.test(sshAddress) || /\s/.test(sshAddress)) {
    return {
      valid: false,
      message: 'Invalid SSH address. Use a format like min@plsk-jetson-001.',
    };
  }

  if (!SSH_ADDRESS_PATTERN.test(sshAddress)) {
    return {
      valid: false,
      message: 'Invalid SSH address. Use a format like min@plsk-jetson-001.',
    };
  }

  const host = sshAddress.includes('@') ? sshAddress.split('@').at(-1) : sshAddress;
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);

  if (isIpv4) {
    const validOctets = host.split('.').every((octet) => {
      const number = Number(octet);
      return Number.isInteger(number) && number >= 0 && number <= 255;
    });

    if (!validOctets) {
      return {
        valid: false,
        message: 'Invalid SSH address. Use a format like min@100.x.x.x.',
      };
    }
  }

  return { valid: true, value: sshAddress };
}

export function validateRemotePath(value) {
  const remotePath = String(value || '').trim();

  if (!remotePath || DANGEROUS_PATTERN.test(remotePath) || /\s/.test(remotePath)) {
    return {
      valid: false,
      message: 'Invalid remote folder. Use a path like /home/min.',
    };
  }

  if (!remotePath.startsWith('/')) {
    return {
      valid: false,
      message: 'Invalid remote folder. Use an absolute path like /home/min.',
    };
  }

  return { valid: true, value: remotePath };
}
