# tmux new -s jetson_log
# python jetson_log.py
# ctrl+b, d
# tmux ls
# tmux a -t jetson_log
# ps aux | grep python
# tmux kill-session -t jetson_log
# pkill -f jetson_log.py

# export GOOGLE_APPLICATION_CREDENTIALS="/home/lcau/benchmark-aus-2/code/keys/benchmark-beta-test-ef408c2fc7e0.json"


import csv
import subprocess
import time
import re
from datetime import datetime
import psutil
import os
from google.cloud import storage
from dotenv import load_dotenv
import pytz

load_dotenv()

CSV_FILE = '/home/lcau/benchmark-aus-2/code/logs/jetson_status_log.csv'
LOG_INTERVAL = 60  # seconds
GCS_BUCKET = "benchmark-aus-v2"
GCS_BLOB = "logs/jetson_status_log.csv"
SERVICE_ACCOUNT_KEY = "/home/lcau/benchmark-aus-2/code/keys/benchmark-beta-test-ef408c2fc7e0.json"  # <-- Update this path if needed

# Regex patterns for tegrastats output
MEM_PATTERN = re.compile(r'RAM (\d+)/(\d+)MB')
POWER_PATTERN = re.compile(r'VDD_IN (\d+)mW/(\d+)mW')
GPU_PATTERN = re.compile(r'GR3D_FREQ (\d+)%')
TEMP_CPU_PATTERN = re.compile(r'cpu@([\d.]+)C')
TEMP_GPU_PATTERN = re.compile(r'gpu@([\d.]+)C')
TEMP_TJ_PATTERN = re.compile(r'tj@([\d.]+)C')

SYDNEY_TZ = pytz.timezone('Australia/Sydney')

def activate_gcloud_service_account(key_file):
    try:
        result = subprocess.run(
            ["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
            capture_output=True, text=True
        )
        if "gopro-logger" in result.stdout:  # or check for your service account email
            print("Service account already active for gcloud.")
            return
        print("Activating gcloud service account for gsutil...")
        subprocess.run(
            ["gcloud", "auth", "activate-service-account", "--key-file", key_file],
            check=True
        )
        print("gcloud service account activated.")
    except Exception as e:
        print(f"Failed to activate gcloud service account: {e}")

def upload_to_gcs(local_file, bucket_name, blob_name):
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(local_file)
        print(f"Uploaded {local_file} to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        print(f"Failed to upload to GCS: {e}")


def get_tegrastats():
    """Run tegrastats, capture the first output line, then terminate."""
    try:
        proc = subprocess.Popen(['tegrastats', '--interval', '1000'],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        line = proc.stdout.readline()
        proc.terminate()
        return line.strip()
    except Exception as e:
        print(f"Error running tegrastats: {e}")
        return ''


def parse_tegrastats(output):
    """Parse tegrastats output for RAM, power, GPU usage, and temperatures."""
    mem_match = MEM_PATTERN.search(output)
    power_match = POWER_PATTERN.search(output)
    gpu_match = GPU_PATTERN.search(output)
    temp_cpu_match = TEMP_CPU_PATTERN.search(output)
    temp_gpu_match = TEMP_GPU_PATTERN.search(output)
    temp_tj_match = TEMP_TJ_PATTERN.search(output)
    mem_used = mem_total = None
    power_cur = power_avg = None
    gpu_util = None
    temp_cpu = temp_gpu = temp_tj = None
    if mem_match:
        mem_used, mem_total = mem_match.groups()
    if power_match:
        power_cur, power_avg = power_match.groups()
    if gpu_match:
        gpu_util = gpu_match.group(1)
    if temp_cpu_match:
        temp_cpu = temp_cpu_match.group(1)
    if temp_gpu_match:
        temp_gpu = temp_gpu_match.group(1)
    if temp_tj_match:
        temp_tj = temp_tj_match.group(1)
    return mem_used, mem_total, power_cur, power_avg, gpu_util, temp_cpu, temp_gpu, temp_tj


def get_cpu_usage():
    """Return total and per-core CPU usage percentages."""
    per_core = psutil.cpu_percent(percpu=True)
    total = psutil.cpu_percent()
    return total, per_core


def get_swap_usage():
    swap = psutil.swap_memory()
    return swap.used // (1024 * 1024), swap.total // (1024 * 1024)  # in MB


def get_disk_io(prev):
    curr = psutil.disk_io_counters()
    if prev is None:
        return 0, 0, curr
    read_bps = (curr.read_bytes - prev.read_bytes) // LOG_INTERVAL
    write_bps = (curr.write_bytes - prev.write_bytes) // LOG_INTERVAL
    return read_bps, write_bps, curr


def log_status():
    prev_disk = None
    with open(CSV_FILE, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        # Write header if file is empty
        if csvfile.tell() == 0:
            writer.writerow([
                'timestamp',
                'mem_used_MB', 'mem_total_MB',
                'power_cur_mW', 'power_avg_mW',
                'gpu_util_percent',
                'temp_cpu_C', 'temp_gpu_C', 'temp_tj_C',
                'cpu_total_percent', 'cpu_per_core_percent',
                'swap_used_MB', 'swap_total_MB',
                'disk_read_Bps', 'disk_write_Bps'
            ])
        while True:
            ts = datetime.now(SYDNEY_TZ).isoformat()
            output = get_tegrastats()
            mem_used, mem_total, power_cur, power_avg, gpu_util, temp_cpu, temp_gpu, temp_tj = parse_tegrastats(output)
            cpu_total, cpu_per_core = get_cpu_usage()
            swap_used, swap_total = get_swap_usage()
            disk_read, disk_write, prev_disk = get_disk_io(prev_disk)
            writer.writerow([
                ts, mem_used, mem_total,
                power_cur, power_avg,
                gpu_util,
                temp_cpu, temp_gpu, temp_tj,
                cpu_total, '|'.join(str(x) for x in cpu_per_core),
                swap_used, swap_total,
                disk_read, disk_write
            ])
            csvfile.flush()
            upload_to_gcs(CSV_FILE, GCS_BUCKET, GCS_BLOB)
            print(f"{ts}: RAM {mem_used}/{mem_total}MB, Power {power_cur}/{power_avg}mW, GPU {gpu_util}%, CPU {cpu_total}% ({cpu_per_core}), Temp CPU/GPU/TJ {temp_cpu}/{temp_gpu}/{temp_tj}C, Swap {swap_used}/{swap_total}MB, Disk R/W {disk_read}/{disk_write} Bps")
            time.sleep(LOG_INTERVAL)


if __name__ == '__main__':
    print("GOOGLE_APPLICATION_CREDENTIALS:", os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    activate_gcloud_service_account(SERVICE_ACCOUNT_KEY)
    log_status()
