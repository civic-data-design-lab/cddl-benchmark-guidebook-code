# tmux new -s gopro_download_stream_interval
# python gopro_download_stream_interval.py
# ctrl+b, d
# tmux ls
# tmux a -t gopro_download_stream_interval
# ps aux | grep python
# tmux kill-session -t gopro_download_stream_interval
# pkill -f gopro_download_stream_interval.py

import subprocess
import time
from datetime import datetime
import os
import logging
from dotenv import load_dotenv

# Add timezone support
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:
    from pytz import timezone as ZoneInfo  # fallback for older Python

try:
    from google.cloud import storage
except ImportError:
    storage = None

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

VIDEO_PATH = "/home/lcau/benchmark-aus-2/code/sample"
GCS_BUCKET = os.getenv("GCS_BUCKET", "benchmark-aus-v2")

def upload_to_gcs(local_file, bucket_name, blob_name):
    if storage is None:
        logging.warning("google-cloud-storage is not installed. Skipping upload.")
        return
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(local_file)
        logging.info(f"Uploaded {local_file} to gs://{bucket_name}/{blob_name}")
    except Exception as e:
        logging.error(f"Failed to upload to GCS: {e}")

def make_gcs_file_public(bucket, blob):
    try:
        result = subprocess.run(
            ["gsutil", "acl", "ch", "-u", "AllUsers:R", f"gs://{bucket}/{blob}"],
            check=True,
            capture_output=True,
            text=True
        )
        logging.info(f"Made gs://{bucket}/{blob} public.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Failed to make public: {e.stderr}")

def check_ffmpeg():
    if subprocess.call(['which', 'ffmpeg'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
        raise RuntimeError("ffmpeg is not installed or not in PATH.")

def capture_stream_with_ffmpeg(stream_url, duration=120, output_directory=VIDEO_PATH):
    check_ffmpeg()
    os.makedirs(output_directory, exist_ok=True)
    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = os.path.join(output_directory, f"video_{current_time}.mp4")

    ffmpeg_command = [
        'ffmpeg',
        '-loglevel', 'warning',
        '-analyzeduration', '10000000',
        '-probesize', '10000000',
        '-i', stream_url,
        '-t', str(duration),
        '-r', '5',  # Set FPS to 5
        '-vf', "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{localtime}':fontcolor=yellow:fontsize=48:box=1:boxcolor=0x00000099:x=20:y=20",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        output_file
    ]

    process = subprocess.Popen(ffmpeg_command)
    try:
        process.wait(timeout=duration + 5)
    except subprocess.TimeoutExpired:
        process.terminate()
        process.wait()

    logging.info(f"Video saved as {output_file}")

    # Upload the uniquely named file to GCS
    blob_name = os.path.basename(output_file)
    upload_to_gcs(output_file, GCS_BUCKET, f"videos/{blob_name}")

    # # Delete local file after upload
    # try:
    #     os.remove(output_file)
    #     logging.info(f"Deleted local file: {output_file}")
    # except Exception as e:
    #     logging.error(f"Failed to delete local file: {e}")

def main():
    import pytz
    from datetime import timedelta
    
    # Configurable start and end hours (24-hour format)
    START_HOUR = 17  # 5pm
    END_HOUR = 20    # 8pm
    
    # Set timezone to Sydney
    SYDNEY_TZ = pytz.timezone('Australia/Sydney')
    now_utc = datetime.now(pytz.utc)
    now_sydney = now_utc.astimezone(SYDNEY_TZ)

    # Calculate today's start and end time in Sydney time
    start_time = now_sydney.replace(hour=START_HOUR, minute=0, second=0, microsecond=0)
    end_time = now_sydney.replace(hour=END_HOUR, minute=0, second=0, microsecond=0)
    if now_sydney > end_time:
        # If already past end hour, schedule for tomorrow
        start_time = start_time + timedelta(days=1)
        end_time = end_time + timedelta(days=1)

    # Wait until start hour if started earlier
    if now_sydney < start_time:
        wait_seconds = (start_time - now_sydney).total_seconds()
        logging.info(f"Waiting until {START_HOUR}:00 Sydney time to start ({wait_seconds/60:.1f} minutes)")
        time.sleep(wait_seconds)

    # Start sampling every 10 minutes from start to end hour
    stream_url = os.getenv("STREAM_URL", "udp://@0.0.0.0:8554")
    duration = 120  # 2 minutes
    interval = 480  # 8 minutes
    current = start_time
    while current < end_time:
        now_utc = datetime.now(pytz.utc)
        now_sydney = now_utc.astimezone(SYDNEY_TZ)
        if now_sydney < current:
            sleep_seconds = (current - now_sydney).total_seconds()
            logging.info(f"Sleeping {sleep_seconds:.1f} seconds until next sample at {current.strftime('%H:%M:%S')}")
            time.sleep(sleep_seconds)
        logging.info(f"Capturing sample at {current.strftime('%Y-%m-%d %H:%M:%S')} Sydney time")
        capture_stream_with_ffmpeg(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1", duration=duration, output_directory=VIDEO_PATH)
        current += timedelta(seconds=interval)
    logging.info(f"Completed capturing samples from {START_HOUR}:00 to {END_HOUR}:00 Sydney time.")

if __name__ == "__main__":
    main()
