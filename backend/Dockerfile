FROM mcr.microsoft.com/playwright:v1.57.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the backend code
COPY . .

# Build the NestJS app
RUN npm run build

# Expose the port 
EXPOSE 8080

# Command to start the app (migrate + start)
CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]