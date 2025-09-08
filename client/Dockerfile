# Use Node to build the React app
FROM node:18 AS build

WORKDIR /app
COPY package.json package-lock.json ./
# RUN npm ci
RUN npm install
COPY . .
RUN npm run build

# Serve build with nginx
FROM nginx:alpine
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
