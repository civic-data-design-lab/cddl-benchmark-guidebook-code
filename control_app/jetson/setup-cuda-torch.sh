#!/usr/bin/env bash
set -Eeuo pipefail

ENV_NAME="${1:-${PLSK_CONDA_ENV:-plsk}}"

echo "PLSK Jetson CUDA Torch setup"
echo "============================"
echo "Conda env: ${ENV_NAME}"
echo

if [ "$(uname -s)" != "Linux" ]; then
  echo "This script must be run on the Jetson Linux terminal."
  exit 1
fi

if [ "$(uname -m)" != "aarch64" ]; then
  echo "This script expects an aarch64 Jetson. Detected: $(uname -m)"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get is required."
  exit 1
fi

find_conda() {
  if command -v conda >/dev/null 2>&1; then
    command -v conda
    return 0
  fi

  for candidate in "$HOME/miniconda3/bin/conda" "$HOME/anaconda3/bin/conda" "/opt/conda/bin/conda"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

CONDA_BIN="$(find_conda || true)"
if [ -z "$CONDA_BIN" ]; then
  echo "No conda executable found. Install Miniconda/Miniforge first."
  exit 1
fi

if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/miniconda3/etc/profile.d/conda.sh"
elif [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/anaconda3/etc/profile.d/conda.sh"
fi

if [ ! -f /etc/nv_tegra_release ]; then
  echo "/etc/nv_tegra_release not found. This does not look like a Jetson Linux install."
  exit 1
fi

L4T_RELEASE="$(sed -n 's/^# R\([0-9]\+\).*/\1/p' /etc/nv_tegra_release | head -n 1)"
L4T_REVISION="$(sed -n 's/.*REVISION: \([0-9.]\+\).*/\1/p' /etc/nv_tegra_release | head -n 1)"
echo "Detected Jetson Linux: R${L4T_RELEASE}.${L4T_REVISION:-unknown}"

if ! "$CONDA_BIN" env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
  echo "Conda env '${ENV_NAME}' was not found. Create it first with code/environment.yml."
  exit 1
fi

apt_install_if_available() {
  local package_name="$1"
  if apt-cache show "$package_name" >/dev/null 2>&1; then
    echo "Installing ${package_name}..."
    sudo apt-get install -y "$package_name"
  else
    echo "Package not available from apt repo: ${package_name}"
  fi
}

echo
echo "Installing Jetson CUDA/cuDNN runtime packages..."
sudo apt-get update
sudo apt-get install -y python3-pip libopenblas-dev

PYTORCH_INDEX_URL=""
TORCH_VERSION=""
TORCHVISION_VERSION=""
NUMPY_SPEC="numpy==1.26.1"

case "$L4T_RELEASE" in
  36)
    apt_install_if_available "libcudnn9-cuda-12"
    apt_install_if_available "libcudnn9-dev-cuda-12"
    apt_install_if_available "cuda-cupti-12-6"
    PYTORCH_INDEX_URL="https://pypi.jetson-ai-lab.io/jp6/cu126"
    TORCH_VERSION="2.8.0"
    TORCHVISION_VERSION="0.23.0"
    ;;
  35)
    apt_install_if_available "libcudnn8"
    apt_install_if_available "libcudnn8-dev"
    PYTORCH_INDEX_URL="https://pypi.jetson-ai-lab.io/jp5/cu114"
    TORCH_VERSION="2.4.0"
    TORCHVISION_VERSION="0.19.1"
    ;;
  *)
    echo "Unsupported Jetson Linux release R${L4T_RELEASE}. Supported: R35 and R36."
    exit 1
    ;;
esac

echo
echo "Reinstalling CUDA-enabled Torch in conda env '${ENV_NAME}'..."
"$CONDA_BIN" run -n "$ENV_NAME" python3 -m pip install --upgrade pip setuptools wheel
"$CONDA_BIN" run -n "$ENV_NAME" python3 -m pip install --no-cache-dir --force-reinstall "$NUMPY_SPEC"
"$CONDA_BIN" run -n "$ENV_NAME" python3 -m pip install \
  --no-cache-dir \
  --force-reinstall \
  "torch==${TORCH_VERSION}" \
  "torchvision==${TORCHVISION_VERSION}" \
  --index-url "$PYTORCH_INDEX_URL"

echo
echo "Verifying Torch CUDA..."
"$CONDA_BIN" run -n "$ENV_NAME" python3 - <<'PY'
import os
import subprocess
import torch

print("torch_version=", torch.__version__)
print("torch_cuda_version=", torch.version.cuda)
print("cuda_available=", torch.cuda.is_available())
if torch.cuda.is_available():
    x = torch.zeros(1).to("cuda")
    print("cuda_tensor_device=", x.device)
else:
    raise SystemExit("Torch imported, but CUDA is not available.")

print("cudnn_version=", torch.backends.cudnn.version())
print("nvidia_runtime_libs=")
subprocess.run(["bash", "-lc", "ls -l /lib/aarch64-linux-gnu/libcudnn* /usr/lib/aarch64-linux-gnu/libcudnn* 2>/dev/null | tail -n 20"], check=False)
PY

echo
echo "CUDA Torch setup complete."
