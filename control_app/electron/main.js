import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { openTerminal } from './terminal.js';
import { loadDevice, saveDevice } from './storage.js';
import { validateRemotePath, validateSshAddress } from './validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 820,
    minWidth: 760,
    minHeight: 640,
    title: 'PLSK Remote SSH Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    window.loadURL(VITE_DEV_SERVER_URL);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: error.message,
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function checkCommand(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = await runCommand(lookup, [command]);

  return {
    installed: result.ok,
    path: result.stdout.split(/\r?\n/).find(Boolean) || '',
    error: result.ok ? '' : result.stderr,
  };
}

function failureMessageForSsh(stderr) {
  return [
    'Could not connect to the Jetson.',
    '',
    'Check:',
    '1. Is the Jetson powered on?',
    '2. Is Tailscale running on both devices?',
    '3. Can you see the Jetson with tailscale status?',
    '4. Is SSH enabled on the Jetson?',
    '5. Is the username correct?',
    '',
    stderr ? `Technical detail: ${stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

ipcMain.handle('plsk:check-dependencies', async () => {
  const [tailscale, ssh, code] = await Promise.all([
    checkCommand('tailscale'),
    checkCommand('ssh'),
    checkCommand('code'),
  ]);

  return { tailscale, ssh, code };
});

ipcMain.handle('plsk:tailscale-status', async () => {
  const result = await runCommand('tailscale', ['status']);

  if (!result.ok) {
    return {
      ok: false,
      message: 'Could not read Tailscale status. Make sure Tailscale is installed and running.',
      detail: result.stderr || result.stdout,
    };
  }

  return {
    ok: true,
    message: result.stdout || 'Tailscale is available, but no status output was returned.',
  };
});

ipcMain.handle('plsk:test-connection', async (_event, sshAddress) => {
  const validation = validateSshAddress(sshAddress);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const result = await runCommand('ssh', [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=5',
    validation.value,
    'echo connected',
  ]);

  if (result.ok && result.stdout.includes('connected')) {
    return { ok: true, message: 'Connected successfully.', detail: result.stdout };
  }

  return {
    ok: false,
    message: failureMessageForSsh(result.stderr || result.stdout),
    detail: result.stderr || result.stdout,
  };
});

ipcMain.handle('plsk:open-terminal', async (_event, sshAddress) => {
  try {
    return await openTerminal(sshAddress);
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('plsk:open-vscode', async (_event, sshAddress, remotePath) => {
  const sshValidation = validateSshAddress(sshAddress);
  if (!sshValidation.valid) {
    return { ok: false, message: sshValidation.message };
  }

  const pathValidation = validateRemotePath(remotePath);
  if (!pathValidation.valid) {
    return { ok: false, message: pathValidation.message };
  }

  const hasCode = await checkCommand('code');
  if (!hasCode.installed) {
    return {
      ok: false,
      message:
        "VS Code CLI is missing.\n\nOpen VS Code.\nPress Cmd/Ctrl + Shift + P.\nRun:\nShell Command: Install 'code' command in PATH",
    };
  }

  const child = spawn('code', ['--remote', `ssh-remote+${sshValidation.value}`, pathValidation.value], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();

  return { ok: true, message: 'Opening VS Code Remote SSH.' };
});

ipcMain.handle('plsk:save-device', async (_event, device) => {
  try {
    const saved = await saveDevice(device);
    return { ok: true, device: saved, message: 'Device saved.' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('plsk:load-device', async () => {
  try {
    const device = await loadDevice();
    return { ok: true, device };
  } catch (error) {
    return { ok: false, device: { sshAddress: '', remotePath: '/home/min' }, message: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
