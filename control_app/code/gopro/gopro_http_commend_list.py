import asyncio
from open_gopro import WirelessGoPro

async def check_stream_status():
    print("Attempting to connect via Bluetooth...")
    gopro = WirelessGoPro()
    await gopro.__aenter__()
    if gopro:
        print("Successfully connected to GoPro.")
    else:
        print("Failed to connect to GoPro.")
    print("Available methods in gopro.http_command:")
    print([m for m in dir(gopro.http_command) if not m.startswith('_')])
    await gopro.__aexit__(None, None, None)

if __name__ == "__main__":
    asyncio.run(check_stream_status())

# Available methods in gopro.http_command:
# ['add_file_hilight', 'clear', 'copy', 'delete_all', 'delete_file', 'delete_group', 'download_file', 'fromkeys', 'get', 'get_camera_info', 'get_camera_state', 'get_date_time', 'get_gpmf_data', 'get_last_captured_media', 'get_media_list', 'get_media_metadata', 'get_open_gopro_api_version', 'get_preset_status', 'get_screennail__call__', 'get_telemetry', 'get_thumbnail', 'get_webcam_version', 'items', 'keys', 'load_preset', 'load_preset_group', 'pop', 'popitem', 'remove_file_hilight', 'set_camera_control', 'set_date_time', 'set_digital_zoom', 'set_keep_alive', 'set_preview_stream', 'set_shutter', 'set_third_party_client_info', 'set_turbo_mode', 'setdefault', 'update', 'update_custom_preset', 'values', 'webcam_exit', 'webcam_preview', 'webcam_start', 'webcam_status', 'webcam_stop', 'wired_usb_control']    