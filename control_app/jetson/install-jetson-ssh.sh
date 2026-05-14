#!/usr/bin/env bash
set -e

echo "PLSK Jetson SSH setup"
echo "======================"

if [ "$(uname -s)" != "Linux" ]; then
  echo "This installer must be run on Linux."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer expects an Ubuntu/Debian-based Jetson with apt-get."
  exit 1
fi

echo "Updating package metadata..."
sudo apt-get update

if ! command -v curl >/dev/null 2>&1; then
  echo "Installing curl..."
  sudo apt-get install -y curl
else
  echo "curl is already installed."
fi

echo "Installing OpenSSH server..."
sudo apt-get install -y openssh-server

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
else
  echo "Tailscale is already installed."
fi

echo "Enabling and starting SSH..."
sudo systemctl enable ssh
sudo systemctl start ssh

echo "Enabling and starting Tailscale..."
sudo systemctl enable tailscaled
sudo systemctl start tailscaled

CURRENT_USER="$(whoami)"
CURRENT_HOSTNAME="$(hostname)"
TAILSCALE_IP=""

if command -v tailscale >/dev/null 2>&1; then
  TAILSCALE_IP="$(tailscale ip -4 2>/dev/null || true)"
fi

echo
echo "Detected device details:"
echo "User: ${CURRENT_USER}"
echo "Hostname: ${CURRENT_HOSTNAME}"

if [ -n "${TAILSCALE_IP}" ]; then
  echo "Tailscale IP: ${TAILSCALE_IP}"
else
  echo "Tailscale IP: not available yet"
fi

echo
echo "PLSK Jetson SSH setup complete."
echo
echo "Next steps:"
echo "1. Run: sudo tailscale up"
echo "2. Log in to Tailscale from the browser link."
echo "3. On your laptop, open PLSK Remote SSH Manager."
echo "4. Enter this SSH address:"
echo
echo "${CURRENT_USER}@${CURRENT_HOSTNAME}"
