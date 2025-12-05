# Fix: Final CJS module fix
FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

# --- START CACHE BUSTER ---
# This line ensures npm install runs fresh every time by invalidating the cache layer.
RUN echo "cache_buster_$(date +%Y%m%d%H%M%S)" > .cache_buster
# --- END CACHE BUSTER ---

RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index.cjs"]
