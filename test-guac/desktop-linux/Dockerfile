FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    USERNAME=testuser \
    PASSWORD=Passw0rd!

# -------------------------------------------------
# Base desktop stack + a few demo X11 apps
# -------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        xrdp xorgxrdp                       \
        xfce4 xfce4-goodies dbus-x11        \
        xterm x11-apps                      \
        sudo                                \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------
# Create test user
# -------------------------------------------------
RUN adduser --disabled-password --gecos "" "${USERNAME}" && \
   echo "${USERNAME}:${PASSWORD}" | chpasswd && \
   echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} && \
   chmod 0440 /etc/sudoers.d/${USERNAME}

# -------------------------------------------------
# Start XFCE in every RDP session
# -------------------------------------------------
COPY --chown="${USERNAME}:${USERNAME}" config/.xsession /home/${USERNAME}/.xsession
RUN chmod +x /home/${USERNAME}/.xsession

# Create Desktop directory
RUN mkdir /home/${USERNAME}/Desktop && chown "${USERNAME}:${USERNAME}" /home/${USERNAME}/Desktop

# -------------------------------------------------
# Expose RDP port and launch XRDP
# -------------------------------------------------
EXPOSE 3389
CMD ["/bin/sh", "-c", "/usr/sbin/xrdp-sesman && exec /usr/sbin/xrdp -nodaemon"]
