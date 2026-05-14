import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateRemotePath, validateSshAddress } from './validators.js';

const CONFIG_DIR = path.join(os.homedir(), '.plsk-remote-ssh');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_DEVICE = {
  sshAddress: '',
  remotePath: '/home/min',
};

export async function loadDevice() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_DEVICE,
      sshAddress: typeof parsed.sshAddress === 'string' ? parsed.sshAddress : '',
      remotePath: typeof parsed.remotePath === 'string' ? parsed.remotePath : DEFAULT_DEVICE.remotePath,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_DEVICE;
    }

    throw new Error(`Could not load saved device config: ${error.message}`);
  }
}

export async function saveDevice(device) {
  const sshValidation = validateSshAddress(device?.sshAddress);
  if (!sshValidation.valid) {
    throw new Error(sshValidation.message);
  }

  const pathValidation = validateRemotePath(device?.remotePath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.message);
  }

  const config = {
    sshAddress: sshValidation.value,
    remotePath: pathValidation.value,
  };

  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return config;
}
