FROM docker:dind

# パッケージマネージャをapkに変更し、必要なパッケージをインストール
# lsb-release はAlpineにないため削除し、シェルとして利用するbashを追加
RUN apk update && apk add --no-cache \
  sudo \
  ca-certificates \
  curl \
  gnupg \
  bash \
  openrc \
  setpriv

ARG CONTAINER_USER=user
ENV CONTAINER_USER=${CONTAINER_USER}
# Alpineではadduserコマンドが推奨される
# -D: システムユーザーとして作成、-s: シェルを指定
RUN adduser -D -s /bin/bash ${CONTAINER_USER}
RUN echo ${CONTAINER_USER}:password | chpasswd
RUN echo "${CONTAINER_USER}   ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# ユーザID等をホストに合わせる
COPY --chown=${CONTAINER_USER} --chmod=755 entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]

ARG CONTAINER_WORKDIR=/workspace
ENV CONTAINER_WORKDIR=${CONTAINER_WORKDIR}
WORKDIR ${CONTAINER_WORKDIR}

# ユーザーをdockerグループに追加
RUN addgroup ${CONTAINER_USER} docker

CMD ["/bin/bash"]