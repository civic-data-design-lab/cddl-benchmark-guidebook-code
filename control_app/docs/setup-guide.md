# Setup Guide

This guide keeps setup intentionally short. The Electron app will verify Tailscale, SSH, VS Code CLI, saved device settings, and SSH connectivity for you.

## Step 1: Create or Use a Tailscale Account

Open https://login.tailscale.com/start and sign in or register with Google, Microsoft, GitHub, Apple, or your organization SSO.

Use the same Tailscale account or organization on both:

- Your laptop
- The Jetson

Cost disclaimer: Tailscale pricing can change. Personal use may be free depending on Tailscale's current plan limits, while team or organization use may require a paid plan. Check the official pricing page before relying on this for budgeting:

https://tailscale.com/pricing

## Step 2: Install Tailscale on the Laptop

Install Tailscale from:

https://tailscale.com/download

Then open Tailscale and sign in.

## Step 3: Prepare the Jetson

On the Jetson, run:

```bash
bash jetson/install-jetson-ssh.sh
```

Then connect the Jetson to Tailscale:

```bash
sudo tailscale up
```

Open the browser link shown by Tailscale and sign in with the same account or organization used on the laptop.

## Step 4: Open the App

On the laptop, run:

```bash
npm install
npm start
```

In the app:

1. Click **Run Setup Check**.
2. Enter the Jetson SSH address, such as `min@plsk-jetson-001` or `min@100.x.x.x`.
3. Enter the remote folder, such as `/home/min`.
4. Click **Save Device**.
5. Click **Test Connection**.
6. Click **Open SSH Terminal** or **Open VS Code**.

## If Something Fails

Use the error message shown in the app first. For deeper checks, see [troubleshooting.md](troubleshooting.md).
