# gopro_shutdown_stream.py
import argparse
import asyncio
from rich.console import Console
from open_gopro import WirelessGoPro
from open_gopro.logger import setup_logging

console = Console()

class GoProShutdownStreamer:
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

    async def stop_stream(self):
        """Stops the current live stream."""
        try:
            console.print("Stopping current live stream...")
            response = await self.gopro.http_command.webcam_stop()
            if response.ok:
                console.print("Successfully stopped the current stream.")
            else:
                console.print(f"Failed to stop stream: {response}")
        except AttributeError as e:
            console.print(f"Error stopping stream: {repr(e)} - The method might be incorrect or not available.")
        except Exception as e:
            console.print(f"Error stopping stream: {repr(e)}")

    async def run(self):
        """Runs the streamer shutdown."""
        await self.connect_gopro()
        await self.stop_stream()

def parse_arguments():
    parser = argparse.ArgumentParser(description="GoPro Stream Shutdown")
    parser.add_argument("--log", type=str, default=None, help="Path to save the log file")
    return parser.parse_args()

def main():
    args = parse_arguments()
    shutdown_streamer = GoProShutdownStreamer(args)
    asyncio.run(shutdown_streamer.run())

if __name__ == "__main__":
    main()
