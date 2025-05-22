import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { EmailService } from './email.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Template path resolution (same as before)
        const possiblePaths = [
          join(process.cwd(), 'templates', 'email'),
          join(__dirname, '..', '..', 'templates', 'email'),
          join(__dirname, '..', 'templates', 'email'),
          join(process.cwd(), 'dist', 'templates', 'email'),
        ];

        let templateDir = possiblePaths[0];

        for (const path of possiblePaths) {
          if (existsSync(path)) {
            templateDir = path;
            console.log(`✅ Found email templates at: ${path}`);
            break;
          }
        }

        // Check if notification.hbs exists
        const notificationTemplate = join(templateDir, 'notification.hbs');
        if (!existsSync(notificationTemplate)) {
          console.error(
            `❌ notification.hbs template not found at: ${notificationTemplate}`,
          );
        }

        console.log('📧 Email configuration initialized');
        console.log(`   Template directory: ${templateDir}`);

        return {
          transport: {
            host: config.get('EMAIL_HOST', 'smtp.gmail.com'),
            port: config.get('EMAIL_PORT', 587),
            secure: config.get('EMAIL_SECURE', false),
            auth: {
              user: config.get('EMAIL_USER'),
              pass: config.get('EMAIL_PASSWORD'),
            },
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
          },
          defaults: {
            from: `"SeeU Cafe" <${config.get('EMAIL_FROM', 'noreply@seeucafe.com')}>`,
          },
          template: {
            dir: templateDir,
            adapter: new HandlebarsAdapter({
              // Custom Handlebars helpers can be added here
              formatDate: (date: Date) => {
                return new Intl.DateTimeFormat('lo-LA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(date);
              },
              formatCurrency: (amount: number) => {
                return new Intl.NumberFormat('lo-LA', {
                  style: 'currency',
                  currency: 'LAK',
                  minimumFractionDigits: 0,
                })
                  .format(amount)
                  .replace('LAK', '₭');
              },
              uppercase: (str: string) => str?.toUpperCase() || '',
              lowercase: (str: string) => str?.toLowerCase() || '',
            }),
            options: {
              strict: false,
            },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
