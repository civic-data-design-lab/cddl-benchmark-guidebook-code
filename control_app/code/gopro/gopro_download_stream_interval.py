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

try:
    from google.cloud import storage
except ImportError:
    storage = None

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

VIDEO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../video/"))
GCS_BUCKET = os.getenv("GCS_BUCKET", "benchmark-boston-test")

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

    # Save/update recent_footage.mp4
    recent_footage_path = os.path.join(output_directory, "recent_footage.mp4")
    try:
        import shutil
        shutil.copy2(output_file, recent_footage_path)
        logging.info(f"Updated recent footage: {recent_footage_path}")
    except Exception as e:
        logging.error(f"Failed to update recent footage: {e}")

    # Upload recent_footage.mp4 to GCS and make it public
    recent_blob_name = "videos/recent_footage.mp4"
    upload_to_gcs(recent_footage_path, GCS_BUCKET, recent_blob_name)
    make_gcs_file_public(GCS_BUCKET, recent_blob_name)

    # Upload to GCS
    blob_name = os.path.basename(output_file)
    upload_to_gcs(output_file, GCS_BUCKET, f"videos/{blob_name}")

    # Delete local file after upload
    try:
        os.remove(output_file)
        logging.info(f"Deleted local file: {output_file}")
    except Exception as e:
        logging.error(f"Failed to delete local file: {e}")

def main():
    stream_url = os.getenv("STREAM_URL", "udp://@0.0.0.0:8554") # udp://127.0.0.1:8556 udp://@0.0.0.0:8554
    samples = int(os.getenv("SAMPLES", 24))
    duration = int(os.getenv("DURATION", 60))  # seconds
    pause_duration = int(os.getenv("PAUSE_DURATION", 3540))  # seconds

    for i in range(samples):
        logging.info(f"Starting sample {i + 1} of {samples}")
        capture_stream_with_ffmpeg(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1", duration=duration, output_directory=VIDEO_PATH)
        if i < samples - 1:
            for remaining in range(pause_duration, 0, -1):
                print(f"\rPausing... {remaining} seconds remaining", end="")
                time.sleep(1)
            print()
    logging.info(f"Completed capturing {samples} samples.")

if __name__ == "__main__":
    main()
