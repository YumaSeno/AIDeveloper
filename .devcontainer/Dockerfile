FROM node:24-slim

RUN apt update && apt install -y sudo

ARG CONTAINER_WORKDIR
ENV CONTAINER_WORKDIR=$CONTAINER_WORKDIR
WORKDIR $CONTAINER_WORKDIR

ARG CONTAINER_USER
ENV CONTAINER_USER=$CONTAINER_USER
RUN useradd -ms /bin/bash $CONTAINER_USER
RUN echo $CONTAINER_USER:password | chpasswd
RUN echo "$CONTAINER_USER   ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# ユーザID等をホストに合わせる
COPY --chown=$CONTAINER_USER --chmod=755 .devcontainer/entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]

#Dockerを用意する(docker-in-docker)
RUN apt update
RUN apt install -y locales-all
RUN apt install -y ca-certificates
RUN apt install -y curl
RUN apt install -y gnupg
RUN apt install -y lsb-release

RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt update
RUN apt install -y docker-ce
RUN apt install -y docker-ce-cli
RUN apt install -y containerd.io
RUN apt install -y docker-compose-plugin

RUN usermod -aG docker $CONTAINER_USER

CMD ["sudo service docker start; /bin/bash"]
