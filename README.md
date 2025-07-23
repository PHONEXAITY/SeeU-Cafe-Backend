# SeeU Cafe API

API backend for SeeU Cafe's ordering online web application, built with NestJS, PostgreSQL, Redis, Cloudinary, and more.

## Features

- User authentication and role-based authorization (JWT)
- Menu management (food & beverage items, categories)
- Order processing system
- Table management
- Promotions and discounts
- Payment processing
- Employee management
- Blog and content management
- Cloudinary integration for image uploads
- Redis caching
- Swagger API documentation

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Cache**: Redis
- **Image Storage**: Cloudinary
- **Authentication**: Passport.js with JWT
- **Documentation**: Swagger
- **Containerization**: Docker
- **Testing**: Jest

## Prerequisites

- Node.js (v16 or higher)
- Docker and Docker Compose
- Cloudinary account (for image uploads)

## Getting Started

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/seeu-cafe-api.git
cd seeu-cafe-api
```

2. Create a `.env` file based on the provided `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your credentials:
```
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/seeu_cafe"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=seeu_cafe

# Authentication
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRATION=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server
PORT=3000
NODE_ENV=development
```

### Installation

#### Using Docker (Recommended)

1. Build and start the containers:
```bash
npm run docker:build
npm run docker:up
```

2. Generate Prisma client:
```bash
npm run prisma:generate
```

3. Apply database migrations:
```bash
npm run prisma:migrate
```

4. Seed the database:
```bash
npm run prisma:seed
```

#### Without Docker

1. Install dependencies:
```bash
npm install
```

2. Make sure PostgreSQL and Redis are running locally.

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Apply database migrations:
```bash
npm run prisma:migrate
```

5. Seed the database:
```bash
npm run prisma:seed
```

6. Start the application:
```bash
npm run start:dev
```

### Usage

Once the application is running, you can access:

- API Endpoints: `http://localhost:3000/api`
- Swagger Documentation: `http://localhost:3000/api/docs`
- Prisma Studio (for database exploration): `npm run prisma:studio` (then open `http://localhost:5555`)

### API Documentation

Comprehensive API documentation is available through Swagger UI at `/api/docs`.

### Default Admin User

After seeding the database, you can use the following credentials to log in as an admin:

- Email: `admin@seeu.cafe`
- Password: `admin123`

## Development

### Available Scripts

- `npm run start:dev` - Start the application in development mode
- `npm run build` - Build the application
- `npm run start:prod` - Start the application in production mode
- `npm run lint` - Lint the code
- `npm run test` - Run tests
- `npm run prisma:studio` - Open Prisma Studio
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers

### Project Structure

```
seeu-cafe-api/
├── src/
│   ├── auth/                # Authentication module
│   ├── blogs/               # Blog module
│   ├── categories/          # Categories module
│   ├── cloudinary/          # Cloudinary integration
│   ├── employees/           # Employees module
│   ├── orders/              # Orders module
│   ├── payments/            # Payments module
│   ├── prisma/              # Prisma service
│   ├── products/            # Products module (food & beverage)
│   ├── promotions/          # Promotions module
│   ├── settings/            # System settings module
│   ├── tables/              # Tables module
│   ├── users/               # Users module
│   ├── app.module.ts        # Main application module
│   └── main.ts              # Application entry point
├── prisma/
│   ├── migrations/          # Database migrations
│   ├── schema.prisma        # Prisma schema
│   └── seed.ts              # Database seed
├── test/                    # Test files
├── .env                     # Environment variables
├── .env.example             # Example environment variables
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Docker configuration
└── package.json             # NPM dependencies and scripts
```

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set the appropriate environment variables for production.

3. Start the application:
```bash
npm run start:prod
```

Alternatively, use Docker for production:

```bash
NODE_ENV=production npm run docker:up
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is licensed under the PXDEV License - see the LICENSE file for details.