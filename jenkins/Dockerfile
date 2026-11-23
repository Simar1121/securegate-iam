FROM jenkins/jenkins:lts-jdk21

USER root

# Install the Docker CLI and Compose plugin. The Jenkins controller connects
# to a separate TLS-protected Docker-in-Docker daemon; it does not mount the
# host Docker socket.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl lsb-release \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER jenkins

RUN jenkins-plugin-cli --plugins "workflow-aggregator git github-branch-source credentials-binding timestamper"
