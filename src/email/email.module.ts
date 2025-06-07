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
        
        // Get email configuration
        const emailHost = config.get('EMAIL_HOST', 'smtp.gmail.com');
        const emailPort = parseInt(config.get('EMAIL_PORT', '587'));
        const emailSecure = config.get('EMAIL_SECURE') === 'true';
        const emailUser = config.get('EMAIL_USER');
        const emailPassword = config.get('EMAIL_PASSWORD');
        
        console.log(`   Host: ${emailHost}:${emailPort}`);
        console.log(`   Secure: ${emailSecure}`);
        console.log(`   User: ${emailUser}`);
        console.log(`   Password: ${emailPassword ? '[SET]' : '[NOT SET]'}`);

        return {
          transport: {
            host: emailHost,
            port: emailPort,
            secure: emailSecure, // false for 587, true for 465
            requireTLS: true, // Force TLS
            auth: {
              user: emailUser,
              pass: emailPassword,
            },
            // TLS configuration to fix SSL errors
            tls: {
              // Don't fail on invalid certificates
              rejectUnauthorized: false,
              // Minimum TLS version
              minVersion: 'TLSv1.2',
              // TLS ciphers
              ciphers: 'ECDHE-RSA-AES256-GCM-SHA384',
              // Servername for SNI
              servername: emailHost,
            },
            // Connection timeout
            connectionTimeout: 60000, // 60 seconds
            greetingTimeout: 30000, // 30 seconds
            socketTimeout: 60000, // 60 seconds
            // Debugging (only in development)
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
            // Pool configuration for better performance
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
          },
          defaults: {
            from: `"SeeU Cafe" <${config.get('EMAIL_FROM', 'noreply@seeucafe.com')}>`,
          },
          template: {
            dir: templateDir,
            adapter: new HandlebarsAdapter({
              // Custom Handlebars helpers
              formatDate: (date: Date) => {
                try {
                  return new Intl.DateTimeFormat('lo-LA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(date));
                } catch (error) {
                  return date?.toString() || '';
                }
              },
              formatCurrency: (amount: number) => {
                try {
                  return new Intl.NumberFormat('lo-LA', {
                    style: 'currency',
                    currency: 'LAK',
                    minimumFractionDigits: 0,
                  })
                    .format(amount)
                    .replace('LAK', '₭');
                } catch (error) {
                  return `${amount} ₭`;
                }
              },
              uppercase: (str: string) => str?.toUpperCase() || '',
              lowercase: (str: string) => str?.toLowerCase() || '',
              // Add conditional helper
              ifEquals: function(arg1: any, arg2: any, options: any) {
                return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
              },
              // Add loop index helper
              addOne: (index: number) => index + 1,
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