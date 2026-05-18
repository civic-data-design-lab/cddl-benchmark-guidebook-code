import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { openTerminal } from './terminal.js';
import { loadDevice, saveDevice } from './storage.js';
import { validateRemotePath, validateSshAddress } from './validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const JETSON_TELEMETRY_LOG_PATH = '/home/lcau/jetson_status_log.csv';
const DEFAULT_MONITOR_SESSION = 'plsk_monitor';
const DEFAULT_CAMERA_CONFIG = {
  basePath: '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro',
  captureOutputPath: '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check',
  collectorOutputPath: '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/model/sample_video',
  streamScript: 'gopro_start_stream_lin_loop.py',
  stopScript: 'gopro_stop_stream.py',
  captureScript: 'gopro_capture_stream.py',
  tapScript: 'gopro_stream_tap.py',
  collectorScript: 'gopro_download_stream_interval.py',
  streamSession: 'gopro_stream',
  tapSession: 'gopro_tap',
  collectorSession: 'gopro_collector',
  streamUrl: 'udp://@0.0.0.0:8554',
  durationSeconds: 60,
  samples: 24,
  pauseSeconds: 3540,
  useSudo: true,
};

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 820,
    minWidth: 760,
    minHeight: 640,
    title: 'Public Life Sensor Kit Manager',
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
  const resolved = await resolveCommand(command);

  return {
    installed: resolved.installed,
    path: resolved.path,
    error: resolved.error,
  };
}

function getWindowsCommandCandidates(command) {
  if (command !== 'tailscale') {
    return [];
  }

  return [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'),
    process.env['ProgramFiles(x86)']
      ? path.join(process.env['ProgramFiles(x86)'], 'Tailscale', 'tailscale.exe')
      : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Tailscale', 'tailscale.exe') : '',
  ].filter(Boolean);
}

async function resolveCommand(command) {
  const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = await runCommand(lookup, [command]);

  if (result.ok) {
    return {
      installed: true,
      path: result.stdout.split(/\r?\n/).find(Boolean) || command,
      error: '',
    };
  }

  if (process.platform === 'win32') {
    const candidate = getWindowsCommandCandidates(command).find((candidatePath) => existsSync(candidatePath));

    if (candidate) {
      return {
        installed: true,
        path: candidate,
        error: '',
      };
    }
  }

  return {
    installed: false,
    path: '',
    error: result.stderr,
  };
}

function failureMessageForSsh(stderr) {
  const detail = String(stderr || '').trim();

  if (/capture script not found/i.test(detail)) {
    return `Capture script not found on the Jetson.\n\nTechnical detail: ${detail}`;
  }

  if (/capture_error:|bind failed: address already in use/i.test(detail)) {
    return [
      'Could not capture while the UDP stream is in use.',
      '',
      'Use Start Stream (starts the stream tap), then capture again.',
      '',
      detail ? `Technical detail: ${detail}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    /connection timed out|connection refused|permission denied|host key verification failed|no route to host|could not resolve hostname|network is unreachable/i.test(
      detail,
    )
  ) {
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
      detail ? `Technical detail: ${detail}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (detail) {
    return `Remote command failed.\n\nTechnical detail: ${detail}`;
  }

  return [
    'Could not connect to the Jetson.',
    '',
    'Check:',
    '1. Is the Jetson powered on?',
    '2. Is Tailscale running on both devices?',
    '3. Can you see the Jetson with tailscale status?',
    '4. Is SSH enabled on the Jetson?',
    '5. Is the username correct?',
  ].join('\n');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function parseKeyValueOutput(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator === -1) {
          return [line, ''];
        }

        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function splitEscapedColon(line) {
  const parts = [];
  let current = '';
  let escaped = false;

  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === ':') {
      parts.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

function parseWifiNetworks(output) {
  const seen = new Set();

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ssid = '', signal = '', security = ''] = splitEscapedColon(line);
      return {
        ssid,
        signal,
        security: security || 'Open',
      };
    })
    .filter((network) => {
      if (!network.ssid || seen.has(network.ssid)) {
        return false;
      }

      seen.add(network.ssid);
      return true;
    });
}

function parseBluetoothDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^Device\s+([0-9A-Fa-f:]{17})\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      address: match[1].toUpperCase(),
      name: match[2],
    }));
}

function parseRemoteDirectory(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [type, pathValue, name] = line.split('\t');
      return {
        type: type === 'd' ? 'directory' : 'file',
        path: pathValue,
        name,
      };
    })
    .filter((entry) => entry.path && entry.name)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTelemetryLog(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      const memUsed = toNumber(record.mem_used_MB);
      const memTotal = toNumber(record.mem_total_MB);
      const swapUsed = toNumber(record.swap_used_MB);
      const swapTotal = toNumber(record.swap_total_MB);

      return {
        timestamp: record.timestamp,
        memUsedMB: memUsed,
        memTotalMB: memTotal,
        memPercent: memUsed !== null && memTotal ? (memUsed / memTotal) * 100 : null,
        powerCurMW: toNumber(record.power_cur_mW),
        powerAvgMW: toNumber(record.power_avg_mW),
        gpuPercent: toNumber(record.gpu_util_percent),
        tempCpuC: toNumber(record.temp_cpu_C),
        tempGpuC: toNumber(record.temp_gpu_C),
        tempTjC: toNumber(record.temp_tj_C),
        cpuPercent: toNumber(record.cpu_total_percent),
        cpuPerCorePercent: record.cpu_per_core_percent
          ? record.cpu_per_core_percent.split('|').map(toNumber).filter((value) => value !== null)
          : [],
        swapUsedMB: swapUsed,
        swapTotalMB: swapTotal,
        swapPercent: swapUsed !== null && swapTotal ? (swapUsed / swapTotal) * 100 : null,
        diskReadBps: toNumber(record.disk_read_Bps),
        diskWriteBps: toNumber(record.disk_write_Bps),
      };
    })
    .filter((record) => record.timestamp);
}

function validateWifiCredentials(credentials) {
  const ssid = String(credentials?.ssid || '').trim();
  const password = String(credentials?.password || '');

  if (!ssid || ssid.length > 64 || /[\n\r\0]/.test(ssid)) {
    return { valid: false, message: 'Enter a valid Wi-Fi network name.' };
  }

  if (password.length > 128 || /[\n\r\0]/.test(password)) {
    return { valid: false, message: 'Enter a valid Wi-Fi password.' };
  }

  return { valid: true, ssid, password };
}

function validateBluetoothAddress(value) {
  const address = String(value || '').trim().toUpperCase();

  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(address)) {
    return { valid: false, message: 'Enter a valid Bluetooth device address.' };
  }

  return { valid: true, address };
}

function validatePowerState(value) {
  if (value === 'on' || value === 'off') {
    return { valid: true, value };
  }

  return { valid: false, message: 'Invalid power state.' };
}

function validateMonitorConfig(config = {}) {
  const pathValidation = validateRemotePath(config.logPath || JETSON_TELEMETRY_LOG_PATH);
  if (!pathValidation.valid) {
    return { valid: false, message: pathValidation.message };
  }

  const intervalSeconds = Number(config.intervalSeconds || 60);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 5 || intervalSeconds > 3600) {
    return { valid: false, message: 'Monitor interval must be between 5 and 3600 seconds.' };
  }

  const sessionName = String(config.sessionName || DEFAULT_MONITOR_SESSION).trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionName)) {
    return { valid: false, message: 'Session name can only use letters, numbers, hyphens, and underscores.' };
  }

  return {
    valid: true,
    logPath: pathValidation.value,
    intervalSeconds,
    sessionName,
  };
}

function validateScriptName(value, fallback) {
  const scriptName = String(value || fallback).trim();

  if (!/^[a-zA-Z0-9_.-]+\.py$/.test(scriptName)) {
    return { valid: false, message: 'Script names must be simple Python file names.' };
  }

  return { valid: true, value: scriptName };
}

function validateSessionName(value, fallback) {
  const sessionName = String(value || fallback).trim();

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionName)) {
    return { valid: false, message: 'Session name can only use letters, numbers, hyphens, and underscores.' };
  }

  return { valid: true, value: sessionName };
}

function validateCameraConfig(config = {}) {
  const basePath = validateRemotePath(config.basePath || DEFAULT_CAMERA_CONFIG.basePath);
  if (!basePath.valid) {
    return { valid: false, message: basePath.message };
  }

  const scriptFields = [
    ['streamScript', DEFAULT_CAMERA_CONFIG.streamScript],
    ['stopScript', DEFAULT_CAMERA_CONFIG.stopScript],
    ['captureScript', DEFAULT_CAMERA_CONFIG.captureScript],
    ['tapScript', DEFAULT_CAMERA_CONFIG.tapScript],
    ['collectorScript', DEFAULT_CAMERA_CONFIG.collectorScript],
  ];
  const scripts = {};

  for (const [field, fallback] of scriptFields) {
    const validation = validateScriptName(config[field], fallback);
    if (!validation.valid) {
      return validation;
    }
    scripts[field] = validation.value;
  }

  const streamSession = validateSessionName(config.streamSession, DEFAULT_CAMERA_CONFIG.streamSession);
  if (!streamSession.valid) {
    return streamSession;
  }

  const collectorSession = validateSessionName(config.collectorSession, DEFAULT_CAMERA_CONFIG.collectorSession);
  if (!collectorSession.valid) {
    return collectorSession;
  }

  const tapSession = validateSessionName(config.tapSession, DEFAULT_CAMERA_CONFIG.tapSession);
  if (!tapSession.valid) {
    return tapSession;
  }

  const streamUrl = String(config.streamUrl || DEFAULT_CAMERA_CONFIG.streamUrl).trim();
  if (!/^udp:\/\/[a-zA-Z0-9@.:/?_=&-]+$/.test(streamUrl)) {
    return { valid: false, message: 'Use a valid UDP stream URL.' };
  }

  const durationSeconds = Number(config.durationSeconds || DEFAULT_CAMERA_CONFIG.durationSeconds);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400) {
    return { valid: false, message: 'Duration must be between 1 and 86400 seconds.' };
  }

  const samples = Number(config.samples || DEFAULT_CAMERA_CONFIG.samples);
  if (!Number.isInteger(samples) || samples < 1 || samples > 10000) {
    return { valid: false, message: 'Samples must be between 1 and 10000.' };
  }

  const pauseSeconds = Number(config.pauseSeconds ?? DEFAULT_CAMERA_CONFIG.pauseSeconds);
  if (!Number.isInteger(pauseSeconds) || pauseSeconds < 0 || pauseSeconds > 86400) {
    return { valid: false, message: 'Pause seconds must be between 0 and 86400.' };
  }

  const captureOutputPath = validateRemotePath(
    config.captureOutputPath || `${basePath.value}/view_check`,
  );
  if (!captureOutputPath.valid) {
    return { valid: false, message: captureOutputPath.message };
  }

  const collectorOutputPath = validateRemotePath(
    config.collectorOutputPath || DEFAULT_CAMERA_CONFIG.collectorOutputPath,
  );
  if (!collectorOutputPath.valid) {
    return { valid: false, message: collectorOutputPath.message };
  }

  return {
    valid: true,
    basePath: basePath.value,
    captureOutputPath: captureOutputPath.value,
    collectorOutputPath: collectorOutputPath.value,
    ...scripts,
    streamSession: streamSession.value,
    tapSession: tapSession.value,
    collectorSession: collectorSession.value,
    streamUrl,
    durationSeconds,
    samples,
    pauseSeconds,
    useSudo: config.useSudo !== false,
  };
}

async function runSshRemoteCommand(sshAddress, remoteCommand, options = {}) {
  const validation = validateSshAddress(sshAddress);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const result = await runCommand('ssh', [
    '-o',
    'BatchMode=yes',
    '-o',
    `ConnectTimeout=${options.connectTimeout || 8}`,
    validation.value,
    remoteCommand,
  ]);

  if (!result.ok) {
    return {
      ok: false,
      message: failureMessageForSsh(result.stderr || result.stdout),
      detail: result.stderr || result.stdout,
    };
  }

  return result;
}

const JETSON_STATUS_SCRIPT = `
print_field() {
  printf '%s=' "$1"
  if [ -n "$2" ]; then printf '%s' "$2"; else printf 'Unavailable'; fi
  printf '\\n'
}

print_field hostname "$(hostname 2>/dev/null)"
print_field uptime "$(uptime -p 2>/dev/null || uptime 2>/dev/null || true)"
print_field load "$(cut -d ' ' -f 1-3 /proc/loadavg 2>/dev/null)"
print_field memory "$(free -h 2>/dev/null | awk '/Mem:/ {print $3 " used / " $2 " total (" $7 " available)"}')"

disk_devices=$(lsblk -b -dn -o NAME,SIZE,TYPE 2>/dev/null | awk '$3=="disk" && $1 !~ /^(loop|ram|zram)/ {printf "%s%s: %.1f GB physical", sep, $1, $2 / 1000000000; sep="; "}')
if [ -z "$disk_devices" ]; then
  disk_devices=$(for block in /sys/block/*; do
    [ -e "$block" ] || continue
    dev=$(basename "$block")
    case "$dev" in loop*|ram*|zram*) continue ;; esac
    sectors=$(cat "$block/size" 2>/dev/null)
    [ -n "$sectors" ] || continue
    awk -v sep="$sep" -v dev="$dev" -v sectors="$sectors" 'BEGIN { printf "%s%s: %.1f GB total", sep, dev, sectors * 512 / 1000000000 }'
    sep="; "
  done)
fi

root_usage=$(df -B1 / 2>/dev/null | awk 'NR==2 {free=($2 - $3) / 1000000000; total=$2 / 1000000000; printf "Root: %.1f GB free / %.1f GB total (%s used)", free, total, $5}')
filesystem_usage=$(df -B1 -x tmpfs -x devtmpfs --output=target,used,size,pcent 2>/dev/null | awk 'NR>1 && $1!="/" && $1!="/boot/efi" {free=($3 - $2) / 1000000000; printf "%s%s: %.1f GB free / %.1f GB total (%s used)", sep, $1, free, $3 / 1000000000, $4; sep="; "}')
if [ -z "$filesystem_usage" ]; then
  filesystem_usage=$(df -h -x tmpfs -x devtmpfs 2>/dev/null | awk 'NR>1 {printf "%s%s: %s used / %s total (%s)", sep, $6, $3, $2, $5; sep="; "}')
fi

if [ -n "$root_usage" ] && [ -n "$disk_devices" ] && [ -n "$filesystem_usage" ]; then
  disk_summary="$root_usage; Physical storage: $disk_devices; Other mounts: $filesystem_usage"
elif [ -n "$root_usage" ] && [ -n "$disk_devices" ]; then
  disk_summary="$root_usage; Physical storage: $disk_devices"
elif [ -n "$root_usage" ]; then
  disk_summary="$root_usage"
elif [ -n "$disk_devices" ]; then
  disk_summary="Physical storage: $disk_devices"
else
  disk_summary="$filesystem_usage"
fi
print_field disks "$disk_summary"

temperature=$(if [ -r /sys/devices/virtual/thermal/thermal_zone0/temp ]; then awk '{printf "%.1f C", $1 / 1000}' /sys/devices/virtual/thermal/thermal_zone0/temp; fi)
print_field temperature "$temperature"

system_state=$(systemctl is-system-running 2>/dev/null || true)
print_field system "$system_state"

if command -v nmcli >/dev/null 2>&1; then
  wifi_summary=$(nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status 2>/dev/null | awk -F: '$2=="wifi" {conn=$4; if (conn=="") conn="no connection"; printf "%s%s: %s - %s", sep, $1, $3, conn; sep="; "}')
else
  sep=""
  wifi_summary=$(for iface in /sys/class/net/*/wireless; do [ -e "$iface" ] || continue; dev=$(basename "$(dirname "$iface")"); state=$(cat "/sys/class/net/$dev/operstate" 2>/dev/null); printf "%s%s: %s" "$sep" "$dev" "$state"; sep="; "; done)
fi
print_field wifi "$wifi_summary"

if command -v nmcli >/dev/null 2>&1; then
  ethernet_summary=$(nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status 2>/dev/null | awk -F: '$2=="ethernet" {conn=$4; if (conn=="") conn="no connection"; printf "%s%s: %s - %s", sep, $1, $3, conn; sep="; "}')
else
  sep=""
  ethernet_summary=$(for netdev in /sys/class/net/eth* /sys/class/net/en*; do [ -e "$netdev" ] || continue; dev=$(basename "$netdev"); state=$(cat "$netdev/operstate" 2>/dev/null); printf "%s%s: %s" "$sep" "$dev" "$state"; sep="; "; done)
fi
print_field ethernet "$ethernet_summary"

bt_service=$(systemctl is-active bluetooth 2>/dev/null || true)
bt_controller=""
if command -v bluetoothctl >/dev/null 2>&1; then
  bt_name=$(bluetoothctl show 2>/dev/null | awk -F': ' '/Name/ {print $2; exit}')
  bt_power=$(bluetoothctl show 2>/dev/null | awk -F': ' '/Powered/ {print $2; exit}')
  if [ -n "$bt_name$bt_power" ]; then bt_controller="adapter $bt_name powered $bt_power"; fi
fi
bluetooth_summary=$(printf '%s %s' "$bt_service" "$bt_controller" | awk '{$1=$1; print}')
print_field bluetooth "$bluetooth_summary"
`.trim();

const MONITOR_PYTHON_SCRIPT = `
import csv
import os
import re
import subprocess
import sys
import time
from datetime import datetime

MEM_PATTERN = re.compile(r'RAM (\\d+)/(\\d+)MB')
POWER_PATTERN = re.compile(r'VDD_IN (\\d+)mW/(\\d+)mW')
GPU_PATTERN = re.compile(r'GR3D_FREQ (\\d+)%')
TEMP_CPU_PATTERN = re.compile(r'cpu@([\\d.]+)C')
TEMP_GPU_PATTERN = re.compile(r'gpu@([\\d.]+)C')
TEMP_TJ_PATTERN = re.compile(r'tj@([\\d.]+)C')
HEADER = [
    'timestamp',
    'mem_used_MB', 'mem_total_MB',
    'power_cur_mW', 'power_avg_mW',
    'gpu_util_percent',
    'temp_cpu_C', 'temp_gpu_C', 'temp_tj_C',
    'cpu_total_percent', 'cpu_per_core_percent',
    'swap_used_MB', 'swap_total_MB',
    'disk_read_Bps', 'disk_write_Bps'
]

def read_cpu_times():
    totals = []
    with open('/proc/stat', 'r', encoding='utf-8') as stat_file:
        for line in stat_file:
            if not line.startswith('cpu'):
                break
            parts = line.split()
            name = parts[0]
            values = [int(value) for value in parts[1:]]
            idle = values[3] + (values[4] if len(values) > 4 else 0)
            total = sum(values)
            totals.append((name, total, idle))
    return totals

def cpu_percentages():
    before = read_cpu_times()
    time.sleep(0.2)
    after = read_cpu_times()
    percentages = []
    for (_, total_a, idle_a), (_, total_b, idle_b) in zip(before, after):
        total_delta = total_b - total_a
        idle_delta = idle_b - idle_a
        if total_delta <= 0:
            percentages.append(0.0)
        else:
            percentages.append(round((1 - idle_delta / total_delta) * 100, 1))
    return percentages[0] if percentages else 0.0, percentages[1:]

def parse_tegrastats(line):
    def first(pattern):
        match = pattern.search(line)
        return match.groups() if match else None
    mem = first(MEM_PATTERN) or ('', '')
    power = first(POWER_PATTERN) or ('', '')
    gpu = first(GPU_PATTERN)
    cpu_temp = first(TEMP_CPU_PATTERN)
    gpu_temp = first(TEMP_GPU_PATTERN)
    tj_temp = first(TEMP_TJ_PATTERN)
    return [
        mem[0], mem[1],
        power[0], power[1],
        gpu[0] if gpu else '',
        cpu_temp[0] if cpu_temp else '',
        gpu_temp[0] if gpu_temp else '',
        tj_temp[0] if tj_temp else '',
    ]

def get_tegrastats():
    try:
        process = subprocess.Popen(
            ['tegrastats', '--interval', '1000'],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        line = process.stdout.readline().strip()
        process.terminate()
        return line
    except Exception:
        return ''

def swap_usage_mb():
    values = {}
    with open('/proc/meminfo', 'r', encoding='utf-8') as meminfo:
        for line in meminfo:
            key, value = line.split(':', 1)
            if key in ('SwapTotal', 'SwapFree'):
                values[key] = int(value.strip().split()[0])
    total = values.get('SwapTotal', 0) // 1024
    free = values.get('SwapFree', 0) // 1024
    return total - free, total

def disk_io_bytes():
    read_bytes = 0
    write_bytes = 0
    with open('/proc/diskstats', 'r', encoding='utf-8') as diskstats:
        for line in diskstats:
            parts = line.split()
            if len(parts) < 14:
                continue
            device = parts[2]
            if device.startswith(('loop', 'ram', 'zram')):
                continue
            read_bytes += int(parts[5]) * 512
            write_bytes += int(parts[9]) * 512
    return read_bytes, write_bytes

def ensure_header(log_path):
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    if not os.path.exists(log_path) or os.path.getsize(log_path) == 0:
        with open(log_path, 'w', newline='', encoding='utf-8') as log_file:
            csv.writer(log_file).writerow(HEADER)

def main():
    log_path = sys.argv[1]
    interval = int(sys.argv[2])
    ensure_header(log_path)
    previous_read, previous_write = disk_io_bytes()
    while True:
        start = time.time()
        tegra_values = parse_tegrastats(get_tegrastats())
        cpu_total, cpu_per_core = cpu_percentages()
        swap_used, swap_total = swap_usage_mb()
        current_read, current_write = disk_io_bytes()
        elapsed = max(time.time() - start, 1)
        read_bps = max(0, int((current_read - previous_read) / elapsed))
        write_bps = max(0, int((current_write - previous_write) / elapsed))
        previous_read, previous_write = current_read, current_write
        row = [
            datetime.now().astimezone().isoformat(),
            *tegra_values,
            cpu_total,
            '|'.join(str(value) for value in cpu_per_core),
            swap_used,
            swap_total,
            read_bps,
            write_bps,
        ]
        with open(log_path, 'a', newline='', encoding='utf-8') as log_file:
            csv.writer(log_file).writerow(row)
        time.sleep(max(1, interval - (time.time() - start)))

if __name__ == '__main__':
    main()
`.trim();

ipcMain.handle('plsk:check-dependencies', async () => {
  const [tailscale, ssh, code] = await Promise.all([
    checkCommand('tailscale'),
    checkCommand('ssh'),
    checkCommand('code'),
  ]);

  return { tailscale, ssh, code };
});

ipcMain.handle('plsk:tailscale-status', async () => {
  const command = await resolveCommand('tailscale');

  if (!command.installed) {
    return {
      ok: false,
      message: 'Could not find Tailscale on this laptop.',
      detail: 'Install Tailscale, or add tailscale.exe to PATH, then run the setup check again.',
    };
  }

  const result = await runCommand(command.path, ['status']);

  if (!result.ok) {
    return {
      ok: false,
      message: 'Could not read Tailscale status. Make sure Tailscale is running on this laptop.',
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

ipcMain.handle('plsk:jetson-status', async (_event, sshAddress) => {
  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(JETSON_STATUS_SCRIPT)}`);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: 'Jetson status loaded.',
    status: parseKeyValueOutput(result.stdout),
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:reboot-jetson', async (_event, sshAddress) => {
  const result = await runSshRemoteCommand(sshAddress, 'sudo -n systemctl reboot', {
    connectTimeout: 8,
  });

  if (!result.ok) {
    return {
      ...result,
      message: `${result.message}\n\nIf SSH works but reboot fails, allow this Jetson user to run systemctl reboot without a sudo password.`,
    };
  }

  return {
    ok: true,
    message: 'Reboot signal sent. The Jetson may be unreachable for a minute while it restarts.',
    detail: result.stdout || result.stderr,
  };
});

ipcMain.handle('plsk:telemetry-log', async (_event, sshAddress, config = {}) => {
  const pathValidation = validateRemotePath(config.logPath || JETSON_TELEMETRY_LOG_PATH);
  if (!pathValidation.valid) {
    return { ok: false, message: pathValidation.message, detail: '' };
  }

  const script = `
log_path=${shellQuote(pathValidation.value)}
if [ ! -r "$log_path" ]; then
  printf 'Telemetry log not found or not readable: %s' "$log_path" >&2
  exit 1
fi
head -n 1 "$log_path"
tail -n 120 "$log_path" | awk 'NR == 1 && /^timestamp,/ { next } { print }'
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 10,
  });

  if (!result.ok) {
    return result;
  }

  const samples = parseTelemetryLog(result.stdout);
  const latest = samples.at(-1) || null;

  return {
    ok: true,
    message: samples.length ? 'Telemetry log loaded.' : 'Telemetry log was found, but no samples were parsed.',
    samples,
    latest,
    logPath: pathValidation.value,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:list-remote-path', async (_event, sshAddress, remotePath) => {
  const pathValidation = validateRemotePath(remotePath || '/home/lcau');
  if (!pathValidation.valid) {
    return { ok: false, message: pathValidation.message, entries: [], detail: '' };
  }

  const script = `
dir=${shellQuote(pathValidation.value)}
if [ ! -d "$dir" ]; then
  printf 'Remote path is not a directory: %s' "$dir" >&2
  exit 1
fi
find "$dir" -mindepth 1 -maxdepth 1 \\( -type d -o -type f \\) -printf '%y\\t%p\\t%f\\n' 2>/dev/null
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 10,
  });

  if (!result.ok) {
    return {
      ...result,
      entries: [],
      path: pathValidation.value,
    };
  }

  return {
    ok: true,
    message: 'Remote folder loaded.',
    path: pathValidation.value,
    entries: parseRemoteDirectory(result.stdout),
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:monitor-status', async (_event, sshAddress, config) => {
  const validation = validateMonitorConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const script = `
session=${shellQuote(validation.sessionName)}
if ! command -v tmux >/dev/null 2>&1; then
  printf 'tmux is not available on this Jetson.' >&2
  exit 127
fi
if tmux has-session -t "$session" 2>/dev/null; then
  printf 'running'
else
  printf 'stopped'
fi
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`);
  if (!result.ok) {
    return result;
  }

  const running = result.stdout.trim() === 'running';
  return {
    ok: true,
    running,
    message: running ? 'Monitor is running.' : 'Monitor is stopped.',
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:start-monitor', async (_event, sshAddress, config) => {
  const validation = validateMonitorConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const remoteScriptPath = `/tmp/${validation.sessionName}.py`;
  const command = `python3 ${shellQuote(remoteScriptPath)} ${shellQuote(validation.logPath)} ${shellQuote(
    String(validation.intervalSeconds),
  )}`;
  const script = `
session=${shellQuote(validation.sessionName)}
monitor_script=${shellQuote(remoteScriptPath)}
run_command=${shellQuote(command)}
if ! command -v tmux >/dev/null 2>&1; then
  printf 'tmux is not available on this Jetson.' >&2
  exit 127
fi
if ! command -v python3 >/dev/null 2>&1; then
  printf 'python3 is not available on this Jetson.' >&2
  exit 127
fi
if tmux has-session -t "$session" 2>/dev/null; then
  printf 'Monitor is already running in tmux session %s.' "$session"
  exit 0
fi
cat > "$monitor_script" <<'PY_MONITOR'
${MONITOR_PYTHON_SCRIPT}
PY_MONITOR
tmux new-session -d -s "$session" "$run_command"
printf 'Monitor started in tmux session %s.' "$session"
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 12,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: result.stdout || `Monitor started in tmux session ${validation.sessionName}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:stop-monitor', async (_event, sshAddress, config) => {
  const validation = validateMonitorConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const script = `
session=${shellQuote(validation.sessionName)}
if ! command -v tmux >/dev/null 2>&1; then
  printf 'tmux is not available on this Jetson.' >&2
  exit 127
fi
if tmux has-session -t "$session" 2>/dev/null; then
  tmux kill-session -t "$session"
  printf 'Monitor stopped.'
else
  printf 'Monitor was not running.'
fi
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: result.stdout || 'Monitor stopped.',
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:wifi-scan', async (_event, sshAddress) => {
  const script = `
if ! command -v nmcli >/dev/null 2>&1; then
  printf 'NetworkManager nmcli is not available on this Jetson.' >&2
  exit 127
fi
nmcli radio wifi on >/dev/null 2>&1 || true
nmcli -t --escape yes -f SSID,SIGNAL,SECURITY device wifi list --rescan yes
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 15,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: 'Wi-Fi networks loaded.',
    networks: parseWifiNetworks(result.stdout),
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:wifi-connect', async (_event, sshAddress, credentials) => {
  const validation = validateWifiCredentials(credentials);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const passwordArgs = validation.password ? ` password ${shellQuote(validation.password)}` : '';
  const script = `
if ! command -v nmcli >/dev/null 2>&1; then
  printf 'NetworkManager nmcli is not available on this Jetson.' >&2
  exit 127
fi
nmcli radio wifi on
nmcli device wifi connect ${shellQuote(validation.ssid)}${passwordArgs}
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 20,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: `Wi-Fi connect request sent for ${validation.ssid}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:wifi-disconnect', async (_event, sshAddress) => {
  const script = `
if ! command -v nmcli >/dev/null 2>&1; then
  printf 'NetworkManager nmcli is not available on this Jetson.' >&2
  exit 127
fi
device=$(nmcli -t -f DEVICE,TYPE,STATE device status | awk -F: '$2=="wifi" && $3=="connected" {print $1; exit}')
if [ -z "$device" ]; then
  printf 'No connected Wi-Fi device found.'
  exit 0
fi
nmcli device disconnect "$device"
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: 'Wi-Fi disconnect request sent.',
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:wifi-power', async (_event, sshAddress, powerState) => {
  const validation = validatePowerState(powerState);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const script = `
if ! command -v nmcli >/dev/null 2>&1; then
  printf 'NetworkManager nmcli is not available on this Jetson.' >&2
  exit 127
fi
nmcli radio wifi ${validation.value}
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: `Wi-Fi turned ${validation.value}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:bluetooth-scan', async (_event, sshAddress) => {
  const script = `
if ! command -v bluetoothctl >/dev/null 2>&1; then
  printf 'bluetoothctl is not available on this Jetson.' >&2
  exit 127
fi
bluetoothctl power on >/dev/null 2>&1 || true
if bluetoothctl --help 2>/dev/null | grep -q -- '--timeout'; then
  bluetoothctl --timeout 8 scan on >/dev/null 2>&1 || true
else
  timeout 8 bluetoothctl scan on >/dev/null 2>&1 || true
fi
bluetoothctl scan off >/dev/null 2>&1 || true
bluetoothctl devices
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 15,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: 'Bluetooth devices loaded.',
    devices: parseBluetoothDevices(result.stdout),
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:bluetooth-power', async (_event, sshAddress, powerState) => {
  const validation = validatePowerState(powerState);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const script = `
if ! command -v bluetoothctl >/dev/null 2>&1; then
  printf 'bluetoothctl is not available on this Jetson.' >&2
  exit 127
fi
bluetoothctl power ${validation.value}
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: `Bluetooth turned ${validation.value}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:bluetooth-device-action', async (_event, sshAddress, action, deviceAddress) => {
  const validActions = new Set(['pair', 'connect', 'disconnect']);
  if (!validActions.has(action)) {
    return { ok: false, message: 'Invalid Bluetooth action.', detail: '' };
  }

  const validation = validateBluetoothAddress(deviceAddress);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const trustedStep = action === 'pair' ? `\nbluetoothctl trust ${validation.address}` : '';
  const script = `
if ! command -v bluetoothctl >/dev/null 2>&1; then
  printf 'bluetoothctl is not available on this Jetson.' >&2
  exit 127
fi
bluetoothctl power on
bluetoothctl ${action} ${validation.address}${trustedStep}
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 20,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: `Bluetooth ${action} request sent for ${validation.address}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:grant-passwordless-sudo', async (_event, sshAddress, username) => {
  const validation = validateSshAddress(sshAddress);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const user = String(username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!user) {
    return { ok: false, message: 'Enter a valid Jetson username.', detail: '' };
  }

  const script = `
sudoers_file=/etc/sudoers.d/${user}-nopasswd
rule="${user} ALL=(ALL) NOPASSWD: ALL"
if [ -f "$sudoers_file" ] && grep -qF "$rule" "$sudoers_file"; then
  printf 'Passwordless sudo already configured for %s.' '${user}'
  exit 0
fi
printf '%s\\n' "$rule" | sudo tee "$sudoers_file" > /dev/null
sudo chmod 440 "$sudoers_file"
if sudo -n true > /dev/null 2>&1; then
  printf 'Passwordless sudo granted for %s.' '${user}'
else
  printf 'Rule written but sudo -n test failed. Check sudoers manually.' >&2
  exit 1
fi
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 10,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: result.stdout || `Passwordless sudo granted for ${user}.`,
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:camera-status', async (_event, sshAddress, config) => {
  const validation = validateCameraConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const script = `
base=${shellQuote(validation.basePath)}
stream_session=${shellQuote(validation.streamSession)}
collector_session=${shellQuote(validation.collectorSession)}
stream_script=${shellQuote(validation.streamScript)}
capture_script=${shellQuote(validation.captureScript)}
collector_script=${shellQuote(validation.collectorScript)}
print_field() { printf '%s=%s\\n' "$1" "$2"; }
if [ -d "$base" ]; then print_field basePath ok; else print_field basePath missing; fi
if command -v python3 >/dev/null 2>&1; then print_field python ok; else print_field python missing; fi
if command -v tmux >/dev/null 2>&1; then print_field tmux ok; else print_field tmux missing; fi
if command -v ffmpeg >/dev/null 2>&1; then print_field ffmpeg ok; else print_field ffmpeg missing; fi
if sudo -n true >/dev/null 2>&1; then print_field passwordlessSudo ok; else print_field passwordlessSudo needs-password; fi
python3 - <<'PY' >/dev/null 2>&1
import open_gopro
PY
if [ "$?" -eq 0 ]; then print_field openGoPro ok; else print_field openGoPro missing; fi
python3 - <<'PY' >/dev/null 2>&1
import cv2
PY
if [ "$?" -eq 0 ]; then print_field opencv ok; else print_field opencv missing; fi
if [ -f "$base/$stream_script" ]; then print_field streamScript ok; else print_field streamScript missing; fi
if [ -f "$base/$capture_script" ]; then print_field captureScript ok; else print_field captureScript missing; fi
if [ -f "$base/$collector_script" ]; then print_field collectorScript ok; else print_field collectorScript missing; fi
if tmux has-session -t "$stream_session" 2>/dev/null; then
  print_field streamSession running
  stream_log=$(tmux capture-pane -p -t "$stream_session" -S -120 2>/dev/null)
else
  print_field streamSession stopped
  stream_log=""
fi
if tmux has-session -t "$collector_session" 2>/dev/null; then print_field collectorSession running; else print_field collectorSession stopped; fi
if command -v ss >/dev/null 2>&1 && ss -lun | grep -q ':8554'; then print_field udp8554 listening; else print_field udp8554 unknown; fi
if printf '%s' "$stream_log" | grep -qi 'Successfully connected to GoPro'; then
  print_field goproConnection connected
elif printf '%s' "$stream_log" | grep -Eqi 'Failed to connect|Error.*connect|No devices|not found'; then
  print_field goproConnection failed
elif [ -n "$stream_log" ]; then
  print_field goproConnection retrying
else
  print_field goproConnection unknown
fi
if printf '%s' "$stream_log" | grep -Eqi 'Streaming URL|Stream URL'; then
  print_field streamHealth streaming
elif printf '%s' "$stream_log" | grep -Eqi 'Failed to start stream|Error starting stream|Failed to start stream. Will retry'; then
  print_field streamHealth retrying
elif tmux has-session -t "$stream_session" 2>/dev/null; then
  print_field streamHealth running-no-stream-yet
else
  print_field streamHealth stopped
fi
`.trim();

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(script)}`, {
    connectTimeout: 12,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    message: 'Camera status loaded.',
    status: parseKeyValueOutput(result.stdout),
    detail: result.stdout,
  };
});

ipcMain.handle('plsk:camera-action', async (_event, sshAddress, action, config) => {
  const validation = validateCameraConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const actions = new Set([
    'start-stream',
    'stop-stream',
    'capture-frame',
    'start-collector',
    'stop-collector',
    'read-logs',
  ]);
  if (!actions.has(action)) {
    return { ok: false, message: 'Invalid camera action.', detail: '' };
  }

  const pythonCommand = (scriptName) =>
    validation.useSudo ? `sudo -n python3 ${shellQuote(scriptName)}` : `python3 ${shellQuote(scriptName)}`;
  const pythonCommandWithEnv = (scriptName, env = {}) => {
    const envArgs = Object.entries(env)
      .map(([key, value]) => `${key}=${shellQuote(String(value))}`)
      .join(' ');
    return validation.useSudo
      ? `sudo -n env ${envArgs} python3 ${shellQuote(scriptName)}`
      : `${envArgs} python3 ${shellQuote(scriptName)}`;
  };
  const streamCommand = `cd ${shellQuote(validation.basePath)} && ${pythonCommand(validation.streamScript)}`;
  const tapCommand = `cd ${shellQuote(validation.basePath)} && ${pythonCommandWithEnv(validation.tapScript, {
    STREAM_URL: validation.streamUrl,
    CAPTURE_OUTPUT_DIR: validation.captureOutputPath,
    STREAM_TAP_FPS: 5,
    PREVIEW_JPEG_QUALITY: 55,
  })}`;
  const sharedFrameEnv = {
    STREAM_URL: validation.streamUrl,
    CAPTURE_OUTPUT_DIR: validation.captureOutputPath,
    PREFER_SHARED_FRAME: '1',
  };
  const collectorCommand = [
    `cd ${shellQuote(validation.basePath)}`,
    pythonCommandWithEnv(validation.collectorScript, {
      STREAM_URL: validation.streamUrl,
      DURATION: validation.durationSeconds,
      SAMPLES: validation.samples,
      PAUSE_DURATION: validation.pauseSeconds,
      VIDEO_OUTPUT_DIR: validation.collectorOutputPath,
    }),
  ].join(' && ');

  const scripts = {
    'start-stream': `
base=${shellQuote(validation.basePath)}
session=${shellQuote(validation.streamSession)}
run_command=${shellQuote(streamCommand)}
if ! command -v tmux >/dev/null 2>&1; then printf 'tmux is not available.' >&2; exit 127; fi
tap_session=${shellQuote(validation.tapSession)}
tap_command=${shellQuote(tapCommand)}
tap_script=${shellQuote(validation.tapScript)}
if tmux has-session -t "$session" 2>/dev/null; then
  printf 'Stream session already running.'
else
  tmux new-session -d -s "$session" "$run_command"
  printf 'Stream session started.'
fi
if [ -f "$base/$tap_script" ]; then
  if tmux has-session -t "$tap_session" 2>/dev/null; then
    printf ' Stream tap already running.'
  else
    tmux new-session -d -s "$tap_session" "$tap_command"
    printf ' Stream tap started.'
  fi
else
  printf ' Stream tap script missing; capture while streaming may fail.'
fi
`,
    'stop-stream': `
base=${shellQuote(validation.basePath)}
session=${shellQuote(validation.streamSession)}
tap_session=${shellQuote(validation.tapSession)}
stop_script=${shellQuote(validation.stopScript)}
if tmux has-session -t "$tap_session" 2>/dev/null; then tmux kill-session -t "$tap_session"; fi
if tmux has-session -t "$session" 2>/dev/null; then tmux kill-session -t "$session"; fi
if [ -f "$base/$stop_script" ]; then cd "$base" && ${pythonCommand(validation.stopScript)}; else printf 'Stop script not found, killed tmux session only.'; fi
`,
    'capture-frame': `
base=${shellQuote(validation.basePath)}
capture_script=${shellQuote(validation.captureScript)}
helper_script=${shellQuote('gopro_stream_frame.py')}
if [ ! -f "$base/$capture_script" ]; then printf 'Capture script not found.' >&2; exit 1; fi
if [ ! -f "$base/$helper_script" ]; then printf 'Helper script gopro_stream_frame.py not found.' >&2; exit 1; fi
cd "$base" && ${pythonCommandWithEnv(validation.captureScript, sharedFrameEnv)}
`,
    'start-collector': `
session=${shellQuote(validation.collectorSession)}
run_command=${shellQuote(collectorCommand)}
if ! command -v tmux >/dev/null 2>&1; then printf 'tmux is not available.' >&2; exit 127; fi
if tmux has-session -t "$session" 2>/dev/null; then printf 'Collector session already running.'; exit 0; fi
tmux new-session -d -s "$session" "$run_command"
printf 'Collector session started.'
`,
    'stop-collector': `
session=${shellQuote(validation.collectorSession)}
if tmux has-session -t "$session" 2>/dev/null; then tmux kill-session -t "$session"; printf 'Collector session stopped.'; else printf 'Collector was not running.'; fi
`,
    'read-logs': `
stream_session=${shellQuote(validation.streamSession)}
collector_session=${shellQuote(validation.collectorSession)}
if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$stream_session" 2>/dev/null; then
  printf '[Stream]\\n'
  tmux capture-pane -p -t "$stream_session" -S -400
else
  printf '[Stream]\\nNot running.\\n'
fi
printf '\\n[Collector]\\n'
if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$collector_session" 2>/dev/null; then
  tmux capture-pane -p -t "$collector_session" -S -400
else
  printf 'Not running.\\n'
fi
`,
  };

  const result = await runSshRemoteCommand(sshAddress, `sh -lc ${shellQuote(scripts[action].trim())}`, {
    connectTimeout: action === 'capture-frame' ? 20 : 12,
  });

  if (!result.ok) {
    return result;
  }

  const messages = {
    'start-stream': 'GoPro stream start requested.',
    'stop-stream': 'GoPro stream stop requested.',
    'capture-frame': 'Frame capture requested.',
    'start-collector': 'Video collector start requested.',
    'stop-collector': 'Video collector stop requested.',
    'read-logs': 'Camera logs loaded.',
  };

  return {
    ok: true,
    message: messages[action],
    detail: [result.stdout, result.stderr].filter(Boolean).join('\n'),
  };
});

async function fetchRemoteImageBase64(sshAddress, remotePath, useSudo = false) {
  const sshValidation = validateSshAddress(sshAddress);
  if (!sshValidation.valid) {
    return { ok: false, message: sshValidation.message };
  }

  const pathValidation = validateRemotePath(remotePath);
  if (!pathValidation.valid) {
    return { ok: false, message: pathValidation.message };
  }

  const quotedPath = shellQuote(pathValidation.value);
  const commands = useSudo
    ? [`sudo -n base64 ${quotedPath}`, `base64 ${quotedPath}`]
    : [`base64 ${quotedPath}`, `sudo -n base64 ${quotedPath}`];

  let lastError = '';
  for (const remoteCommand of commands) {
    const result = await runCommand('ssh', [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=15',
      sshValidation.value,
      remoteCommand,
    ]);

    const payload = result.stdout.replace(/\s/g, '');
    if (result.ok && payload.length > 0) {
      const ext = pathValidation.value.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      return {
        ok: true,
        dataUrl: `data:image/${ext};base64,${payload}`,
        path: pathValidation.value,
      };
    }

    lastError = result.stderr || result.stdout || 'Empty response from Jetson.';
  }

  return {
    ok: false,
    message: 'Could not fetch captured image from Jetson.',
    detail: lastError,
  };
}

ipcMain.handle('plsk:fetch-capture', async (_event, sshAddress, remotePath, useSudo = false) =>
  fetchRemoteImageBase64(sshAddress, remotePath, useSudo));

const GOPRO_LOCAL_CODE_DIR = path.join(__dirname, '../code/gopro');

ipcMain.handle('plsk:patch-gopro-to-jetson', async (_event, sshAddress, config) => {
  const validation = validateCameraConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message, detail: '' };
  }

  const sshValidation = validateSshAddress(sshAddress);
  if (!sshValidation.valid) {
    return { ok: false, message: sshValidation.message, detail: '' };
  }

  if (!existsSync(GOPRO_LOCAL_CODE_DIR)) {
    return {
      ok: false,
      message: 'Local GoPro code folder was not found in this app install.',
      detail: GOPRO_LOCAL_CODE_DIR,
    };
  }

  const scriptNames = readdirSync(GOPRO_LOCAL_CODE_DIR).filter((name) => name.endsWith('.py'));
  if (scriptNames.length === 0) {
    return {
      ok: false,
      message: 'No Python scripts found to patch.',
      detail: GOPRO_LOCAL_CODE_DIR,
    };
  }

  const installed = [];
  const failures = [];

  for (const scriptName of scriptNames) {
    const localScriptPath = path.join(GOPRO_LOCAL_CODE_DIR, scriptName);
    const remoteScriptPath = `${validation.basePath}/${scriptName}`;
    const result = await runCommand('scp', [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=12',
      localScriptPath,
      `${sshValidation.value}:${remoteScriptPath}`,
    ]);

    if (result.ok) {
      installed.push(remoteScriptPath);
    } else {
      failures.push(`${scriptName}: ${result.stderr || result.stdout || 'copy failed'}`);
    }
  }

  if (installed.length === 0) {
    return {
      ok: false,
      message: 'Could not patch GoPro code to the Jetson.',
      detail: failures.join('\n'),
    };
  }

  return {
    ok: failures.length === 0,
    message:
      failures.length === 0
        ? `Patched ${installed.length} GoPro script(s) to the Jetson.`
        : `Patched ${installed.length} script(s), but ${failures.length} failed.`,
    detail: [...installed, ...failures].join('\n'),
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
    // On Windows, 'code' is code.cmd — spawn can't resolve .cmd files without shell:true
    shell: process.platform === 'win32',
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
