FROM node:20-alpine

WORKDIR /app

# Copy dependency configs
COPY package*.json pnpm-lock.yaml* ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build Next.js
RUN npm run build

# Expose server port
EXPOSE 3000

ENV NODE_ENV=production

# Start Express server
CMD ["node", "server.js"]
