import argparse
  import asyncio
  from rich.console import Console
  from open_goPro import WirelessGoPro
  from open_goPro.logger import setup_logging

  console = Console()

  class GoProStreamer:
      def __init__(self, args):
          self.args = args
          self.logger = setup_logging(__name__, args.log)
          self.goPro = None

      async def connect_goPro(self):
          """Connects to the GoPro camera."""
          console.print("Attempting to connect via Bluetooth...")
          self.goPro = WirelessGoPro()
          await self.goPro.__aenter__()
          if self.goPro:
              console.print("Successfully connected to GoPro.")
          else:
              console.print("Failed to connect to GoPro.")

    async def start_stream(self):
        """Starts the live stream."""
        try:
            console.print("Starting live stream...")
            response = await self.goPro.http_command.webcam_start(resolution="12",fov="4", port="8554", protocol="TS") # Set FOV to Linear
            if response.ok:
                stream_url = "udp://@0.0.0.0:8554"
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
          await self.connect_goPro()
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