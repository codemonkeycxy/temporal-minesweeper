FROM node:18-bullseye

# Install Temporal CLI
RUN curl -sSf https://temporal.download/cli.sh | sh
ENV PATH="/root/.temporalio/bin:${PATH}"

# Install process manager
RUN npm install -g pm2

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Copy PM2 configuration
COPY ecosystem.config.js ./

# Expose ports
EXPOSE 3000 7233 8233

# Start all services with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"] 