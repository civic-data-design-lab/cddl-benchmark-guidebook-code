# tmux new -s gopro_start_stream
# python gopro_start_stream_lin.py
# ctrl+b, d
# tmux ls
# tmux a -t gopro_start_stream
# ps aux | grep python
# tmux kill-session -t gopro_start_stream_lin
# pkill -f gopro_start_stream.py

import argparse
import asyncio
from rich.console import Console
from open_gopro import WirelessGoPro
from open_gopro.logger import setup_logging
import open_gopro.api

console = Console()

class GoProStreamer:
    def __init__(self, args):
        self.args = args
        self.logger = setup_logging(__name__, args.log)
        self.gopro = None

    async def connect_gopro(self):
        """Connects to the GoPro camera."""
        console.print("Attempting to connect via Bluetooth...")
        self.gopro = WirelessGoPro()
        await self.gopro.__aenter__()
        if self.gopro:
            console.print("Successfully connected to GoPro.")
        else:
            console.print("Failed to connect to GoPro.")

    async def start_stream(self):
        """Starts the live stream."""
        try:
            console.print("Starting live stream...")
            response = await self.gopro.http_command.webcam_start(resolution="7", fov="4", port="8554", protocol="TS") # 12 : 1080p, 7 : 720p, 4 : 480p
            if response.ok:
                stream_url = "udp://@0.0.0.0:8554"
                console.print(f"Streaming URL: {stream_url}")
                return stream_url
            else:
                console.print(f"Failed to start stream: {response}")
        except AttributeError as e:
            console.print(f"Error starting stream: {repr(e)} - The method might be incorrect or not available.")
        except Exception as e:
            console.print(f"Error starting stream: {repr(e)}")
        return None

    async def run(self):
        """Runs the streamer."""
        await self.connect_gopro()
        stream_url = await self.start_stream()
        if stream_url:
            return stream_url

def parse_arguments():
    parser = argparse.ArgumentParser(description="GoPro WiFi Command Tutorial")
    parser.add_argument("--log", type=str, default=None, help="Path to save the log file")
    return parser.parse_args()

def main():
    args = parse_arguments()
    streamer = GoProStreamer(args)
    stream_url = asyncio.run(streamer.run())
    if stream_url:
        console.print(f"Stream URL: {stream_url}")

if __name__ == "__main__":
    main()
