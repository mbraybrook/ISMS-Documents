FROM node:18-alpine

# Install OpenSSL for Prisma and LibreOffice for document conversion
# Xvfb is needed for headless LibreOffice operation
RUN apk add --no-cache openssl libreoffice \
    xvfb \
    ttf-dejavu \
    ttf-liberation \
    font-noto \
    font-noto-extra \
    ttf-opensans \
    && fc-cache -f -v \
    && mkdir -p /usr/share/fonts/truetype

# Create LibreOffice user config directory and set up font substitution
RUN mkdir -p /root/.config/libreoffice/4/user/registrymodifications.xcu.d

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Copy LibreOffice font configuration
COPY libreoffice-font-config/registrymodifications.xcu /root/.config/libreoffice/4/user/registrymodifications.xcu

# Copy and make startup script executable
COPY scripts/start-xvfb.sh /usr/local/bin/start-xvfb.sh
RUN chmod +x /usr/local/bin/start-xvfb.sh

# Generate Prisma client during build
RUN node node_modules/prisma/build/index.js generate

# Set LibreOffice environment variables for headless operation
ENV SAL_USE_VCLPLUGIN=gen \
    OOO_FORCE_DESKTOP=gnome \
    HOME=/root \
    DISPLAY=:99 \
    JAVA_HOME="" \
    SAL_DISABLE_OPENCL=1

EXPOSE 4000

CMD ["sh", "-c", "start-xvfb.sh && npm run dev"]

