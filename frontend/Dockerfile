FROM node:18-alpine

WORKDIR /app

# Expose Vite's default port
EXPOSE 5173

# The dependencies and app source are mounted dynamically in docker-compose
# If node_modules does not exist (first run), it installs them.
CMD ["/bin/sh", "-c", "if [ ! -d node_modules ]; then npm install; fi && npm run dev -- --host 0.0.0.0"]
