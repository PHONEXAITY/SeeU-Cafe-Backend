import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PromotionsModule } from './promotions/promotions.module';
import { EmployeesModule } from './employees/employees.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TablesModule } from './tables/tables.module';
import { BlogsModule } from './blogs/blogs.module';
import { GalleryModule } from './gallery/gallery.module';
import { SlideshowModule } from './slideshow/slideshow.module';
import { SettingsModule } from './settings/settings.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CustomerNotificationsModule } from './customer-notifications/customer-notifications.module';
import { SessionModule } from './session/session.module';
import { UserActivityMiddleware } from './session/user-activity.middleware';
import { CartModule } from './cart/cart.module';
//import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: 600, // 10 minutes
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Core modules
    PrismaModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    RolesModule, // Add the new RolesModule
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CartModule,
    CustomerNotificationsModule,
    PaymentsModule,
    PromotionsModule,
    EmployeesModule,
    DeliveriesModule,
    ReviewsModule,
    TablesModule,
    BlogsModule,
    GalleryModule,
    SlideshowModule,
    SettingsModule,
    CloudinaryModule,
    SessionModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserActivityMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
