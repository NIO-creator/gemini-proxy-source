# Fix: Final CJS module fix
FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

# --- START CACHE BUSTER ---
# This line forces npm install to run again by changing the Docker layer
# The next build will NOT use the cached npm install result from previous attempts
RUN echo "cache_buster_$(date +%Y%m%d%H%M%S)" > .cache_buster
# --- END CACHE BUSTER ---

RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index.cjs"]
