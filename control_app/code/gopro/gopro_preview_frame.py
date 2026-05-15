import base64
import os
import sys

import cv2

from gopro_stream_frame import acquire_stream_frame, resolve_output_dir


def main():
    stream_url = os.getenv('STREAM_URL', 'udp://@0.0.0.0:8554')
    output_directory = resolve_output_dir(
        '/home/lcau/Desktop/PLSK/cddl-benchmark-guidebook-code/control_app/code/gopro/view_check',
    )
    prefer_shared = os.getenv('PREFER_SHARED_FRAME', '1').lower() in {'1', 'true', 'yes'}

    frame, _source = acquire_stream_frame(
        stream_url,
        output_directory,
        prefer_shared=prefer_shared,
    )
    if frame is None:
        print(
            'PREVIEW_ERROR:No frame available. Start stream + stream tap, or stop other UDP consumers.',
            flush=True,
        )
        sys.exit(1)

    ok, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
    if not ok:
        print('PREVIEW_ERROR:Could not encode preview frame.', flush=True)
        sys.exit(1)

    encoded = base64.b64encode(buffer).decode('ascii')
    print(f'PREVIEW_B64:{encoded}', flush=True)


if __name__ == '__main__':
    main()
