import { spawn } from 'node:child_process';
import process from 'node:process';
import { validateSshAddress } from './validators.js';

function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  child.unref();
}

function commandExists(command) {
  return new Promise((resolve) => {
    const lookup = process.platform === 'win32' ? 'where' : 'which';
    const child = spawn(lookup, [command], { stdio: 'ignore', windowsHide: true });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

export async function openTerminal(sshAddress) {
  const validation = validateSshAddress(sshAddress);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const safeAddress = validation.value;

  if (process.platform === 'darwin') {
    spawnDetached('osascript', [
      '-e',
      `tell application "Terminal" to do script "ssh ${safeAddress}"`,
    ]);
    return { ok: true, message: 'Opening SSH in Terminal.' };
  }

  if (process.platform === 'win32') {
    if (await commandExists('wt')) {
      spawnDetached('wt', ['ssh', safeAddress]);
      return { ok: true, message: 'Opening SSH in Windows Terminal.' };
    }

    spawnDetached('powershell.exe', ['-NoExit', '-Command', `ssh ${safeAddress}`]);
    return { ok: true, message: 'Opening SSH in PowerShell.' };
  }

  if (await commandExists('gnome-terminal')) {
    spawnDetached('gnome-terminal', ['--', 'ssh', safeAddress]);
    return { ok: true, message: 'Opening SSH in GNOME Terminal.' };
  }

  if (await commandExists('x-terminal-emulator')) {
    spawnDetached('x-terminal-emulator', ['-e', 'ssh', safeAddress]);
    return { ok: true, message: 'Opening SSH in the default terminal.' };
  }

  throw new Error('Could not find a supported terminal application.');
}
