# Fix: Final CJS module fix
FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

# --- START CACHE BUSTER ---
RUN echo "cache_buster_$(date +%Y%m%d%H%M%S)" > .cache_buster
# --- END CACHE BUSTER ---

RUN npm install

COPY . .

EXPOSE 8080

# CRITICAL FIX: Explicitly run the CJS module with the .cjs extension
CMD ["node", "--preserve-symlinks-main", "index.cjs"]
