import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async clearDatabase(): Promise<unknown[]> {
    if (process.env.NODE_ENV !== 'production') {
      const models = Reflect.ownKeys(this).filter(
        (key) =>
          typeof key === 'string' &&
          !key.startsWith('_') &&
          key !== '$connect' &&
          key !== '$disconnect' &&
          key !== '$on' &&
          key !== '$transaction' &&
          key !== '$use',
      ) as string[];

      return Promise.all(
        models.map((modelKey) => {
          const model = this[modelKey as keyof this] as unknown as {
            deleteMany: () => Promise<unknown>;
          };
          return model.deleteMany();
        }),
      );
    }
    return [];
  }
}
