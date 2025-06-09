// src/deliveries/services/simple-delivery-fee.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// เพิ่ม interface สำหรับ settings map
interface SettingsMap {
  delivery_base_fee?: string;
  delivery_per_km_fee?: string;
  delivery_free_distance?: string;
  restaurant_latitude?: string;
  restaurant_longitude?: string;
}

// เพิ่ม interface สำหรับ update object
interface SettingUpdate {
  key: string;
  value: string;
}

// เพิ่ม interface สำหรับ validation
interface UpdateSettingsInput {
  baseFee?: number;
  perKmFee?: number;
  freeDistance?: number;
  restaurantLat?: number;
  restaurantLng?: number;
}

@Injectable()
export class SimpleDeliveryFeeService {
  private readonly logger = new Logger(SimpleDeliveryFeeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ดึงการตั้งค่าค่าจัดส่ง
  async getDeliverySettings() {
    try {
      this.logger.log('📥 Getting delivery settings from database');
      
      const settings = await this.prisma.systemSettings.findMany({
        where: {
          key: {
            in: [
              'delivery_base_fee',
              'delivery_per_km_fee', 
              'delivery_free_distance',
              'restaurant_latitude',
              'restaurant_longitude'
            ]
          }
        }
      });

      this.logger.log(`📊 Found ${settings.length} settings in database`);

      // แก้ไข: ระบุประเภทของ settingsMap
      const settingsMap: SettingsMap = {};
      settings.forEach(setting => {
        settingsMap[setting.key as keyof SettingsMap] = setting.value;
        this.logger.log(`⚙️  ${setting.key}: ${setting.value}`);
      });

      const result = {
        baseFee: parseInt(settingsMap.delivery_base_fee || '6000'),
        perKmFee: parseInt(settingsMap.delivery_per_km_fee || '2000'),
        freeDistance: parseFloat(settingsMap.delivery_free_distance || '3'),
        restaurantLat: parseFloat(settingsMap.restaurant_latitude || '19.8845'),
        restaurantLng: parseFloat(settingsMap.restaurant_longitude || '102.135')
      };

      this.logger.log('✅ Delivery settings loaded successfully:', result);
      return result;
    } catch (error) {
      this.logger.error('❌ Error getting delivery settings:', error);
      throw new BadRequestException('Failed to get delivery settings');
    }
  }

  // คำนวณค่าจัดส่ง
  async calculateDeliveryFee(customerLat: number, customerLng: number) {
    try {
      this.logger.log(`🧮 Calculating delivery fee for coordinates: ${customerLat}, ${customerLng}`);
      
      // Validate coordinates
      if (!this.isValidCoordinates(customerLat, customerLng)) {
        throw new BadRequestException('Invalid coordinates provided');
      }

      const settings = await this.getDeliverySettings();
      
      // คำนวณระยะทาง
      const distance = this.calculateDistance(
        settings.restaurantLat,
        settings.restaurantLng,
        customerLat,
        customerLng
      );

      this.logger.log(`📏 Distance calculated: ${distance.toFixed(2)} km`);

      // คำนวณค่าจัดส่ง
      let deliveryFee = settings.baseFee;
      let distanceFee = 0;
      
      if (distance > settings.freeDistance) {
        const extraDistance = distance - settings.freeDistance;
        distanceFee = Math.ceil(extraDistance) * settings.perKmFee;
        deliveryFee += distanceFee;
      }

      // คำนวณเวลาโดยประมาณ (15 นาที + 2 นาที/กม)
      const estimatedTime = 15 + Math.ceil(distance * 2);

      const result = {
        distance: Math.round(distance * 100) / 100, // ปัดเศษ 2 ตำแหน่ง
        deliveryFee,
        estimatedTime,
        isWithinDeliveryArea: this.isWithinServiceArea(customerLat, customerLng),
        breakdown: {
          baseFee: settings.baseFee,
          distanceFee,
          freeDistance: settings.freeDistance,
          extraDistance: Math.max(0, distance - settings.freeDistance)
        }
      };

      this.logger.log('✅ Delivery fee calculated:', {
        distance: result.distance,
        fee: result.deliveryFee,
        breakdown: result.breakdown
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Error calculating delivery fee:', error);
      throw error instanceof BadRequestException ? error : new BadRequestException('Failed to calculate delivery fee');
    }
  }

  // อัปเดตการตั้งค่า - แก้ไขให้ครบถ้วน
  async updateDeliverySettings(newSettings: UpdateSettingsInput) {
    try {
      this.logger.log('🔧 Updating delivery settings:', newSettings);

      // Validate input
      this.validateUpdateSettings(newSettings);

      // แก้ไข: ระบุประเภทของ updates array
      const updates: SettingUpdate[] = [];

      if (newSettings.baseFee !== undefined) {
        updates.push({ key: 'delivery_base_fee', value: newSettings.baseFee.toString() });
      }
      if (newSettings.perKmFee !== undefined) {
        updates.push({ key: 'delivery_per_km_fee', value: newSettings.perKmFee.toString() });
      }
      if (newSettings.freeDistance !== undefined) {
        updates.push({ key: 'delivery_free_distance', value: newSettings.freeDistance.toString() });
      }
      if (newSettings.restaurantLat !== undefined) {
        updates.push({ key: 'restaurant_latitude', value: newSettings.restaurantLat.toString() });
      }
      if (newSettings.restaurantLng !== undefined) {
        updates.push({ key: 'restaurant_longitude', value: newSettings.restaurantLng.toString() });
      }

      this.logger.log(`📝 Preparing to update ${updates.length} settings`);

      // ✅ แก้ไข: ใช้ Promise.all แทน transaction เพื่อหลีกเลี่ยง type issue
      const updatePromises = updates.map(async (update) => {
        this.logger.log(`🔄 Updating ${update.key} = ${update.value}`);
        
        const result = await this.prisma.systemSettings.upsert({
          where: { key: update.key },
          update: { 
            value: update.value, 
            updated_at: new Date() 
          },
          create: { 
            key: update.key, 
            value: update.value,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        
        this.logger.log(`✅ Successfully updated ${update.key}`);
        return result;
      });

      const results = await Promise.all(updatePromises);

      this.logger.log(`🎉 Successfully updated ${results.length} settings`);

      // Return updated settings
      const updatedSettings = await this.getDeliverySettings();
      
      return {
        success: true,
        message: `Updated ${updates.length} settings successfully`,
        settings: updatedSettings,
        updatedCount: results.length
      };

    } catch (error) {
      this.logger.error('❌ Error updating delivery settings:', error);
      throw new BadRequestException(`Failed to update delivery settings: ${error.message}`);
    }
  }

  // เพิ่มฟังก์ชัน validation
  private validateUpdateSettings(settings: UpdateSettingsInput): void {
    if (settings.baseFee !== undefined) {
      if (settings.baseFee < 0 || settings.baseFee > 100000) {
        throw new BadRequestException('Base fee must be between 0 and 100,000 LAK');
      }
    }

    if (settings.perKmFee !== undefined) {
      if (settings.perKmFee < 0 || settings.perKmFee > 50000) {
        throw new BadRequestException('Per km fee must be between 0 and 50,000 LAK');
      }
    }

    if (settings.freeDistance !== undefined) {
      if (settings.freeDistance < 0 || settings.freeDistance > 50) {
        throw new BadRequestException('Free distance must be between 0 and 50 km');
      }
    }

    if (settings.restaurantLat !== undefined) {
      if (settings.restaurantLat < -90 || settings.restaurantLat > 90) {
        throw new BadRequestException('Restaurant latitude must be between -90 and 90');
      }
    }

    if (settings.restaurantLng !== undefined) {
      if (settings.restaurantLng < -180 || settings.restaurantLng > 180) {
        throw new BadRequestException('Restaurant longitude must be between -180 and 180');
      }
    }
  }

  // เพิ่มฟังก์ชัน validate coordinates
  private isValidCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // ฟังก์ชันช่วย - ปรับปรุงให้แม่นยำขึ้น
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // รัศมีโลกในกิโลเมตร
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private isWithinServiceArea(lat: number, lng: number): boolean {
    // เขตการบริการหลวงพระบาง
    return lat >= 19.8 && lat <= 19.95 && lng >= 102.05 && lng <= 102.25;
  }

  // เพิ่มฟังก์ชันสำหรับ debug
  async debugSettings() {
    try {
      const allSettings = await this.prisma.systemSettings.findMany({
        where: {
          key: {
            startsWith: 'delivery_'
          }
        },
        orderBy: {
          key: 'asc'
        }
      });

      this.logger.log('🔍 All delivery-related settings in database:');
      allSettings.forEach(setting => {
        this.logger.log(`   ${setting.key}: ${setting.value} (updated: ${setting.updated_at})`);
      });

      return allSettings;
    } catch (error) {
      this.logger.error('❌ Error debugging settings:', error);
      throw error;
    }
  }

  // เพิ่มฟังก์ชันสำหรับ reset settings เป็นค่า default
  async resetToDefault() {
    try {
      this.logger.log('🔄 Resetting delivery settings to default values');

      const defaultSettings = {
        baseFee: 6000,
        perKmFee: 2000,
        freeDistance: 3,
        restaurantLat: 19.8845,
        restaurantLng: 102.135
      };

      const result = await this.updateDeliverySettings(defaultSettings);
      
      this.logger.log('✅ Settings reset to default successfully');
      return result;

    } catch (error) {
      this.logger.error('❌ Error resetting settings:', error);
      throw new BadRequestException(`Failed to reset settings: ${error.message}`);
    }
  }
}