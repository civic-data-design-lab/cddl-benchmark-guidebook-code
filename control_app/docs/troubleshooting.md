# Troubleshooting

## Jetson Does Not Appear in Tailscale

Run on the Jetson:

```bash
sudo tailscale status
sudo systemctl status tailscaled
```

If Tailscale is not logged in, run:

```bash
sudo tailscale up
```

Install Tailscale and log in on both the laptop and the Jetson.

## SSH Fails

Run on the Jetson:

```bash
sudo systemctl status ssh
hostname
tailscale ip -4
whoami
```

Confirm that the SSH address in the laptop app matches the Jetson username and hostname or Tailscale IP.

## VS Code Does Not Open

Run on the laptop:

```bash
code --version
```

If the command is missing, open VS Code, press Cmd/Ctrl + Shift + P, and run:

```text
Shell Command: Install 'code' command in PATH
```

## Permission Denied

Check the correct username on the Jetson:

```bash
whoami
```

Then connect with:

```bash
ssh username@jetson-hostname
```

If you use SSH keys, make sure the correct public key is installed in `~/.ssh/authorized_keys` on the Jetson.

## Tailscale Missing

Install Tailscale and log in on both devices. After the Jetson is logged in, check:

```bash
tailscale status
```
