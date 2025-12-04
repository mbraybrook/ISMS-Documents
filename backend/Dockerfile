FROM node:18-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client during build
RUN node node_modules/prisma/build/index.js generate

EXPOSE 4000

CMD ["npm", "run", "dev"]

