FROM node:6.14.4-alpine
LABEL maintainer="Mapwize <support@mapwize.io>"

ENV INSTALL_PACKAGES git build-base python

COPY . /root/meraki-indoor-location/

WORKDIR /root/meraki-indoor-location

RUN \
    apk --no-cache add $INSTALL_PACKAGES $RUNTIME_PACKAGES && \
    npm config set user 0 && \
    npm config set unsafe-perm true && \
    git init && git clean -fdX && npm install --production && \
    apk del $INSTALL_PACKAGES

ENTRYPOINT [ "/usr/local/bin/npm" ]
