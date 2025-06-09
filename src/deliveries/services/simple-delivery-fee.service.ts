// src/deliveries/services/simple-delivery-fee.service.ts
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class SimpleDeliveryFeeService {
  constructor(private readonly prisma: PrismaService) {}

  // ดึงการตั้งค่าค่าจัดส่ง
  async getDeliverySettings() {
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

    // แก้ไข: ระบุประเภทของ settingsMap
    const settingsMap: SettingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key as keyof SettingsMap] = setting.value;
    });

    return {
      baseFee: parseInt(settingsMap.delivery_base_fee || '6000'),
      perKmFee: parseInt(settingsMap.delivery_per_km_fee || '2000'),
      freeDistance: parseFloat(settingsMap.delivery_free_distance || '3'),
      restaurantLat: parseFloat(settingsMap.restaurant_latitude || '19.8845'),
      restaurantLng: parseFloat(settingsMap.restaurant_longitude || '102.135')
    };
  }

  // คำนวณค่าจัดส่ง
  async calculateDeliveryFee(customerLat: number, customerLng: number) {
    const settings = await this.getDeliverySettings();
    
    // คำนวณระยะทาง
    const distance = this.calculateDistance(
      settings.restaurantLat,
      settings.restaurantLng,
      customerLat,
      customerLng
    );

    // คำนวณค่าจัดส่ง
    let deliveryFee = settings.baseFee;
    
    if (distance > settings.freeDistance) {
      const extraDistance = distance - settings.freeDistance;
      deliveryFee += Math.ceil(extraDistance) * settings.perKmFee;
    }

    // คำนวณเวลาโดยประมาณ (15 นาที + 2 นาที/กม)
    const estimatedTime = 15 + Math.ceil(distance * 2);

    return {
      distance: Math.round(distance * 100) / 100, // ปัดเศษ 2 ตำแหน่ง
      deliveryFee,
      estimatedTime,
      isWithinDeliveryArea: this.isWithinServiceArea(customerLat, customerLng),
      breakdown: {
        baseFee: settings.baseFee,
        distanceFee: distance > settings.freeDistance ? 
          Math.ceil(distance - settings.freeDistance) * settings.perKmFee : 0,
        freeDistance: settings.freeDistance
      }
    };
  }

  // อัปเดตการตั้งค่า
  async updateDeliverySettings(newSettings: {
    baseFee?: number;
    perKmFee?: number;
    freeDistance?: number;
    restaurantLat?: number;
    restaurantLng?: number;
  }) {
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

    for (const update of updates) {
      await this.prisma.systemSettings.upsert({
        where: { key: update.key },
        update: { value: update.value, updated_at: new Date() },
        create: { key: update.key, value: update.value }
      });
    }

    return { success: true };
  }

  // ฟังก์ชันช่วย
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // รัศมีโลกในกิโลเมตร
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private isWithinServiceArea(lat: number, lng: number): boolean {
    // เขตการบริการหลวงพระบาง
    return lat >= 19.8 && lat <= 19.95 && lng >= 102.05 && lng <= 102.25;
  }
}