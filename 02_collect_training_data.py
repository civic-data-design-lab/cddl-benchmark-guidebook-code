 import subprocess
 import time
 from datetime import datetime, timedelta

 def capture_stream_with_ffmpeg(stream_url, duration=120, output_directory='{output path}'):
     """Capture video stream using FFmpeg and save to file."""
     current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
     output_file = f"{output_directory}video_{current_time}.mp4"

     ffmpeg_command = [
         'ffmpeg',
         '-i', stream_url,
         '-t', str(duration),
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
     duration = 120  # 2 minutes
     start_hour = 6  # 6 AM
     end_hour = 24  # 12 AM
     interval = 3600  # 1 hour in seconds

     for hour in range(start_hour, end_hour):
         print(f"Starting capture for hour {hour}")
         capture_stream_with_ffmpeg(f"{stream_url}?fifo_size=100000000&overrun_nonfatal=1", duration=duration)
         if hour < end_hour - 1:  # No need to pause after the last capture
             print(f"Pausing for {interval / 60} minutes")
             time.sleep(interval)

     print("Completed capturing for one day.")

 if __name__ == "__main__":
     main()