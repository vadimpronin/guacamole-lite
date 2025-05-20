#!/usr/bin/env bash
set -e
export DISPLAY=:0

Xvfb :0 -screen 0 1280x720x24 &
XVFB_PID=$!

# run XFCE inside its own dbus session on :0
su -l "$USERNAME" -c "DISPLAY=:0 dbus-run-session -- xfce4-session" &
XFCE_PID=$!

x11vnc  -noxdamage -display :0 -forever -shared \
        -rfbport 5900 -passwd "$PASSWORD" &

/usr/sbin/xrdp-sesman &
exec /usr/sbin/xrdp -nodaemon
