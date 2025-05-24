import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface GPSAccuracy {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  isAccurate: boolean;
  areaType: 'urban' | 'rural' | 'mountain' | 'unknown';
}

export interface DeliveryArea {
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  centerPoint: {
    latitude: number;
    longitude: number;
  };
  maxDeliveryRadius: number; // kilometers
  gpsReliability: 'high' | 'medium' | 'low';
}

export interface DistanceInfo {
  distance: number; // meters
  estimatedTime: number; // minutes
  isWithinDeliveryArea: boolean;
  deliveryFee: number; // LAK
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  // หลวงพระบาง - ขอบเขตพื้นที่จัดส่ง
  private readonly luangPrabangAreas: DeliveryArea[] = [
    {
      name: 'เขตตัวเมืองหลวงพระบาง',
      bounds: {
        north: 19.95, // เปลี่ยนจาก 19.9
        south: 19.8, // เปลี่ยนจาก 19.87
        east: 102.25, // เปลี่ยนจาก 102.15
        west: 102.05, // เปลี่ยนจาก 102.12
      },
      centerPoint: {
        latitude: 19.8845,
        longitude: 102.135,
      },
      maxDeliveryRadius: 15, // 8km รัศมี
      gpsReliability: 'high',
    },
    {
      name: 'พื้นที่รอบเมือง',
      bounds: {
        north: 19.98, // เปลี่ยนจาก 19.92
        south: 19.75, // เปลี่ยนจาก 19.85
        east: 102.3, // เปลี่ยนจาก 102.18
        west: 102.0, // เปลี่ยนจาก 102.1
      },
      centerPoint: {
        latitude: 19.885,
        longitude: 102.14,
      },
      maxDeliveryRadius: 25, // 15km รัศมี
      gpsReliability: 'medium',
    },
  ];

  // จุดสำคัญในหลวงพระบาง (สำหรับการอ้างอิง)
  private readonly landmarks = [
    { name: 'วัดซังทอง', lat: 19.8853, lng: 102.1347 },
    { name: 'พิพิธภัณฑ์พระราชวัง', lat: 19.8859, lng: 102.142 },
    { name: 'ตลาดเช้า', lat: 19.8838, lng: 102.1358 },
    { name: 'ถนนสีสะหวันวงศ์', lat: 19.8847, lng: 102.1365 },
    { name: 'สะพานข้ามแม่น้ำโขง', lat: 19.892, lng: 102.138 },
  ];

  /**
   * ตรวจสอบความแม่นยำของ GPS
   */
  validateGPSAccuracy(
    latitude: number,
    longitude: number,
    accuracy?: number,
  ): GPSAccuracy {
    // ตรวจสอบขอบเขตพื้นฐาน
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude ต้องอยู่ระหว่าง -90 ถึง 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude ต้องอยู่ระหว่าง -180 ถึง 180');
    }

    // ตรวจสอบว่าอยู่ในพื้นที่ลาวหรือไม่ (ประมาณ)
    const isInLaos =
      latitude >= 13.9 &&
      latitude <= 22.5 &&
      longitude >= 100.0 &&
      longitude <= 107.7;

    if (!isInLaos) {
      throw new BadRequestException('ตำแหน่งนี้อยู่นอกพื้นที่ประเทศลาว');
    }

    // ตรวจสอบว่าอยู่ในพื้นที่หลวงพระบางหรือไม่
    const isInLuangPrabang = this.isInLuangPrabangArea(latitude, longitude);

    if (!isInLuangPrabang) {
      console.log(
        `Location validation failed: lat=${latitude}, lng=${longitude}`,
      );
      console.log('Service area bounds:', {
        minLat: 19.8,
        maxLat: 19.95,
        minLng: 102.05,
        maxLng: 102.25,
      });
      throw new BadRequestException(
        `ตำแหน่งนี้อยู่นอกพื้นที่จัดส่งของหลวงพระบาง (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      );
    }

    // กำหนดประเภทพื้นที่และความแม่นยำ
    const areaType = this.determineAreaType(latitude, longitude);
    const gpsAccuracy = accuracy || this.estimateGPSAccuracy(areaType);

    // ตรวจสอบความแม่นยำ GPS
    const isAccurate = this.isGPSAccurate(gpsAccuracy, areaType);

    return {
      latitude,
      longitude,
      accuracy: gpsAccuracy,
      isAccurate,
      areaType,
    };
  }

  /**
   * คำนวณระยะทางและค่าจัดส่ง
   */
  calculateDeliveryDistance(
    restaurantLat: number,
    restaurantLng: number,
    customerLat: number,
    customerLng: number,
  ): DistanceInfo {
    // คำนวณระยะทางแบบ Haversine
    const distance = this.calculateHaversineDistance(
      restaurantLat,
      restaurantLng,
      customerLat,
      customerLng,
    );

    // ตรวจสอบว่าอยู่ในพื้นที่จัดส่งหรือไม่
    const deliveryArea = this.findDeliveryArea(customerLat, customerLng);
    const isWithinDeliveryArea = deliveryArea !== null;

    // คำนวณเวลาโดยประมาณ (15 กม./ชม. สำหรับในเมือง, 25 กม./ชม. สำหรับนอกเมือง)
    const avgSpeed = deliveryArea?.name.includes('ตัวเมือง') ? 20 : 30; // km/h เพิ่มขึ้น
    const baseTime = 15; // เพิ่มเวลาฐานเป็น 15 นาที
    const estimatedTime = Math.ceil(
      baseTime + (distance / 1000 / avgSpeed) * 60,
    ); // นาที

    // คำนวณค่าจัดส่ง
    const deliveryFee = this.calculateDeliveryFee(distance, deliveryArea);

    console.log(
      `Distance calculation: ${distance}m, ${estimatedTime}min, ${deliveryFee} LAK`,
    );

    return {
      distance: Math.round(distance),
      estimatedTime,
      isWithinDeliveryArea,
      deliveryFee,
    };
  }

  /**
   * หาจุดสถานที่ใกล้เคียง (สำหรับกรณี GPS ไม่แม่นยำ)
   */
  findNearbyLandmarks(
    latitude: number,
    longitude: number,
    radiusKm: number = 2,
  ) {
    return this.landmarks
      .map((landmark) => {
        const distance = this.calculateHaversineDistance(
          latitude,
          longitude,
          landmark.lat,
          landmark.lng,
        );
        return {
          ...landmark,
          distance: Math.round(distance),
        };
      })
      .filter((landmark) => landmark.distance <= radiusKm * 1000)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * แนะนำตำแหน่งที่แม่นยำขึ้น
   */
  suggestBetterLocation(latitude: number, longitude: number) {
    const nearbyLandmarks = this.findNearbyLandmarks(latitude, longitude, 1);

    if (nearbyLandmarks.length > 0) {
      return {
        suggestion: `ตำแหน่งของคุณใกล้กับ ${nearbyLandmarks[0].name} (ห่างประมาณ ${nearbyLandmarks[0].distance} เมตร)`,
        landmarks: nearbyLandmarks.slice(0, 3),
      };
    }

    return {
      suggestion: 'กรุณาตรวจสอบตำแหน่ง GPS หรือระบุที่อยู่เพิ่มเติม',
      landmarks: [],
    };
  }

  /**
   * ปรับปรุงตำแหน่งสำหรับพื้นที่ที่ GPS ไม่แม่นยำ
   */
  adjustLocationForPoorGPS(
    latitude: number,
    longitude: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    address?: string,
  ) {
    const areaType = this.determineAreaType(latitude, longitude);

    if (areaType === 'mountain' || areaType === 'rural') {
      // ในพื้นที่ที่ GPS ไม่แม่นยำ ให้ปรับไปยังจุดกึ่งกลางของพื้นที่
      const area = this.findDeliveryArea(latitude, longitude);
      if (area) {
        const adjustedLat =
          latitude + (area.centerPoint.latitude - latitude) * 0.3;
        const adjustedLng =
          longitude + (area.centerPoint.longitude - longitude) * 0.3;

        return {
          originalLocation: { latitude, longitude },
          adjustedLocation: {
            latitude: adjustedLat,
            longitude: adjustedLng,
          },
          reason: 'ปรับปรุงตำแหน่งสำหรับพื้นที่ที่สัญญาณ GPS ไม่แข็งแรง',
          confidence: 'medium',
        };
      }
    }

    return {
      originalLocation: { latitude, longitude },
      adjustedLocation: { latitude, longitude },
      reason: 'ตำแหน่ง GPS มีความแม่นยำดี',
      confidence: 'high',
    };
  }

  // Private methods

  private isInLuangPrabangArea(latitude: number, longitude: number): boolean {
    return this.luangPrabangAreas.some(
      (area) =>
        latitude >= area.bounds.south &&
        latitude <= area.bounds.north &&
        longitude >= area.bounds.west &&
        longitude <= area.bounds.east,
    );
  }

  private determineAreaType(
    latitude: number,
    longitude: number,
  ): 'urban' | 'rural' | 'mountain' | 'unknown' {
    // พื้นที่ใจกลางเมือง
    if (
      latitude >= 19.82 && // เปลี่ยนจาก 19.88
      latitude <= 19.92 && // เปลี่ยนจาก 19.89
      longitude >= 102.1 && // เปลี่ยนจาก 102.13
      longitude <= 102.18 // เปลี่ยนจาก 102.145
    ) {
      return 'urban';
    }

    // พื้นที่ภูเขา (ทางเหนือและทางใต้ของเมือง)
    if (
      latitude < 19.78 || // เปลี่ยนจาก 19.87
      latitude > 19.98 || // เปลี่ยนจาก 19.9
      longitude < 102.02 || // เปลี่ยนจาก 102.11
      longitude > 102.28 // เปลี่ยนจาก 102.16
    ) {
      return 'mountain';
    }

    // พื้นที่ชานเมือง
    return 'rural';
  }

  private estimateGPSAccuracy(
    areaType: 'urban' | 'rural' | 'mountain' | 'unknown',
  ): number {
    switch (areaType) {
      case 'urban':
        return 5; // 5 เมตร
      case 'rural':
        return 15; // 15 เมตร
      case 'mountain':
        return 50; // 50 เมตร
      case 'unknown':
        return 25; // 25 เมตร
    }
  }

  private isGPSAccurate(accuracy: number, areaType: string): boolean {
    const thresholds: Record<string, number> = {
      urban: 10,
      rural: 25,
      mountain: 100,
      unknown: 30,
    };

    return accuracy <= (thresholds[areaType] || 30);
  }

  private findDeliveryArea(
    latitude: number,
    longitude: number,
  ): DeliveryArea | null {
    return (
      this.luangPrabangAreas.find((area) => {
        const distance = this.calculateHaversineDistance(
          latitude,
          longitude,
          area.centerPoint.latitude,
          area.centerPoint.longitude,
        );
        return distance <= area.maxDeliveryRadius * 1000;
      }) || null
    );
  }

  private calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371e3; // รัศมีโลกเป็นเมตร
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateDeliveryFee(
    distance: number,
    area: DeliveryArea | null,
  ): number {
    if (!area) return 0;

    const distanceKm = distance / 1000;
    // eslint-disable-next-line prefer-const
    let baseFee = 6000; // 15,000 LAK เริ่มต้น

    // ค่าธรรมเนียมตามระยะทาง
    if (distanceKm <= 3) {
      return baseFee;
    } else if (distanceKm <= 6) {
      return baseFee + 3000; // เพิ่ม 3,000 LAK (ลดจาก 5,000)
    } else if (distanceKm <= 12) {
      // เพิ่มขึ้นจาก 10km
      return baseFee + 8000; // เพิ่ม 8,000 LAK (ลดจาก 10,000)
    } else if (distanceKm <= 20) {
      // เพิ่มระยะทางสูงสุด
      return baseFee + 12000; // เพิ่ม 12,000 LAK
    } else {
      return baseFee + 18000; // เพิ่ม 18,000 LAK สำหรับระยะไกลมาก
    }
  }
}
