# ==============================================================================
# CampusQuest Production Frontend Dockerfile (Expo Web + Nginx)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY patch-rn-private-fields.js ./

# Install dependencies (respecting package-lock overrides)
RUN npm ci --ignore-scripts && node patch-rn-private-fields.js

# Copy source code
COPY . .

# Build production static web bundle
ENV NODE_ENV=production
RUN npx expo export --platform web

# ==============================================================================
# Production Static Serving Image (Nginx Alpine)
# ==============================================================================
FROM nginx:alpine

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy production Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
