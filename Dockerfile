FROM node:20-slim

# Install Google Chrome (stable) plus the shared libraries headless Chrome
# needs to actually render pages — without these, Chrome fails to launch
# on a minimal Debian image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       wget gnupg ca-certificates fonts-liberation \
       libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
       libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
       libnss3 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
       libxrandr2 xdg-utils \
  && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

# We install system Chrome above, so skip Puppeteer's own ~200MB Chromium
# download — getChromeExecutablePath() in index.js already looks for
# /usr/bin/google-chrome as a fallback candidate.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/google-chrome
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
