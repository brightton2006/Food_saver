# Use official Node.js 20 lightweight Alpine image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files for caching layer
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production

# Start backend server
CMD ["npm", "start"]
