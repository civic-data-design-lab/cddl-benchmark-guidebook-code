import subprocess
import time
from datetime import datetime, timedelta

def capture_stream_with_ffmpeg(stream_url, duration=120, output_directory='/home/lcau/benchmark-aus-2/code/sample/'):
    """Capture video stream using FFmpeg and save to file."""
    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = f"{output_directory}video_{current_time}.mp4"

    ffmpeg_command = [
        'ffmpeg',
        '-i', stream_url,
        '-t', str(duration),
        '-r', '5',  # Set frame rate to 5 FPS
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        output_file
    ]

    process = subprocess.Popen(ffmpeg_command)
    try:
        process.wait(timeout=duration + 5)
    except subprocess.TimeoutExpired:
        process.terminate()
        process.wait()

    print(f"Video saved as {output_file}")

def main():
    stream_url = "udp://@0.0.0.0:8554"  # Your stream URL
    samples = 48
    duration = 600  # 10 minutes
    pause_duration = 1200  # 20 minutes

    for i in range(samples):
        print(f"Starting sample {i + 1} of {samples}")
        capture_stream_with_ffmpeg(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1", duration=duration)
        if i < samples - 1:  # No need to pause after the last sample
            print(f"Pausing for {pause_duration / 60} minutes")
            time.sleep(pause_duration)
    
    print("Completed capturing 20 samples.")

if __name__ == "__main__":
    main()
