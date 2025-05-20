FROM nginx:alpine
ARG GUAC_VERSION

COPY html /usr/share/nginx/html

RUN apk add --no-cache curl unzip

# download the WAR from the Apache mirrors
RUN curl -fsSL "https://downloads.apache.org/guacamole/${GUAC_VERSION}/binary/guacamole-${GUAC_VERSION}.war" \
      -o /tmp/guac.war

# extract guacamole-common-js bundles into /usr/share/nginx/html/js
RUN mkdir -p /usr/share/nginx/html/js && \
    unzip -j /tmp/guac.war \
      "guacamole-common-js/all.js" \
      "guacamole-common-js/all.min.js" \
      -d /usr/share/nginx/html/js && \
    rm /tmp/guac.war
