FROM node:18-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build


FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Copy package json ก่อนติดตั้ง dependencies production
COPY package*.json ./

# Copy prisma schema และไฟล์ที่จำเป็นสำหรับ prisma generate
COPY prisma ./prisma

# Copy build output จาก development stage
COPY --from=development /app/dist ./dist

# ติดตั้งเฉพาะ production dependencies
RUN npm install --only=production

# รัน prisma generate หลังจากไฟล์ prisma/schema.prisma อยู่ใน image แล้ว
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
