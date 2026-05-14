# Security Notes

PLSK Remote SSH Manager is a laptop-side wrapper around Tailscale, SSH, and VS Code Remote SSH.

- The app does not expose public SSH.
- The app does not require a cloud VM.
- The app does not use reverse SSH.
- Tailscale creates a private network between the laptop and Jetson.
- The app does not store passwords.
- The app saves only the SSH address and remote folder locally.
- The local config is stored at `~/.plsk-remote-ssh/config.json`.
- The renderer process does not receive direct shell access.
- Inputs are validated before commands run.
- System commands are limited to specific IPC handlers.
- This MVP is not a full enterprise access-control system.

Use normal SSH hardening practices on the Jetson, including strong account passwords or SSH keys, regular updates, and careful tailnet membership management.
