#!/usr/bin/env bash
set -e

echo "PLSK Jetson SSH manual cleanup notes"
echo "===================================="
echo
echo "This MVP installer may have installed or enabled:"
echo "- curl"
echo "- openssh-server"
echo "- tailscale"
echo "- ssh systemd service"
echo "- tailscaled systemd service"
echo
echo "This script does not remove SSH or Tailscale automatically."
echo "Remote access tools can be shared by other workflows, so removal should be deliberate."
echo
echo "Optional manual commands:"
echo
echo "Stop SSH:"
echo "  sudo systemctl stop ssh"
echo "  sudo systemctl disable ssh"
echo
echo "Stop Tailscale:"
echo "  sudo tailscale down"
echo "  sudo systemctl stop tailscaled"
echo "  sudo systemctl disable tailscaled"
echo
echo "Remove packages only if you are sure they are not needed:"
echo "  sudo apt-get remove openssh-server tailscale"
