import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'; // แก้ import
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // ระบุ type
  ) {}

  async create(createSettingDto: CreateSettingDto) {
    const existingSetting = await this.prisma.systemSettings.findUnique({
      where: { key: createSettingDto.key },
    });

    if (existingSetting) {
      throw new ConflictException(
        `Setting with key '${createSettingDto.key}' already exists`,
      );
    }

    const setting = await this.prisma.systemSettings.create({
      data: createSettingDto,
    });

    // แก้การเรียก set
    await this.cacheManager.set(`setting:${setting.key}`, setting.value, 3600);

    return setting;
  }

  async findAll() {
    return this.prisma.systemSettings.findMany({
      orderBy: {
        key: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { id },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    return setting;
  }

  async findByKey(key: string) {
    const cachedValue = await this.cacheManager.get(`setting:${key}`);
    if (cachedValue) {
      return {
        key,
        value: cachedValue,
        from_cache: true,
      };
    }

    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }

    // แก้การเรียก set
    await this.cacheManager.set(`setting:${key}`, setting.value, 3600);

    return {
      ...setting,
      from_cache: false,
    };
  }

  async update(id: number, updateSettingDto: UpdateSettingDto) {
    const _setting = await this.findOne(id);

    const updatedSetting = await this.prisma.systemSettings.update({
      where: { id },
      data: updateSettingDto,
    });

    // แก้การเรียก set
    await this.cacheManager.set(
      `setting:${updatedSetting.key}`,
      updatedSetting.value,
      3600,
    );

    return updatedSetting;
  }

  async updateByKey(key: string, updateSettingDto: UpdateSettingDto) {
    const _setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!_setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }

    const updatedSetting = await this.prisma.systemSettings.update({
      where: { key },
      data: updateSettingDto,
    });

    // แก้การเรียก set
    await this.cacheManager.set(`setting:${key}`, updatedSetting.value, 3600);

    return updatedSetting;
  }

  async remove(id: number) {
    const setting = await this.findOne(id);

    await this.prisma.systemSettings.delete({
      where: { id },
    });

    await this.cacheManager.del(`setting:${setting.key}`);

    return { message: 'Setting deleted successfully' };
  }

  async clearCache() {
    const settings = await this.findAll();

    for (const setting of settings) {
      await this.cacheManager.del(`setting:${setting.key}`);
    }

    return { message: 'Settings cache cleared successfully' };
  }
}
