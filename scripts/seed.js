// scripts/seed.js - Improved with data checking
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function checkExistingData() {
  const userCount = await prisma.user.count();
  const roleCount = await prisma.role.count();
  
  console.log(`📊 Current database state:`);
  console.log(`   - Users: ${userCount}`);
  console.log(`   - Roles: ${roleCount}`);
  
  return { userCount, roleCount };
}

async function main() {
  try {
    console.log('🌱 Starting database seeding...');

    // ตรวจสอบข้อมูลที่มีอยู่
    const { userCount, roleCount } = await checkExistingData();
    
    // ถ้ามีข้อมูลอยู่แล้ว ให้ถาม
    if (userCount > 0 || roleCount > 0) {
      console.log('⚠️  Database already contains data.');
      
      // ในสภาพแวดล้อมการพัฒนา ให้ skip การ seed ถ้ามีข้อมูลแล้ว
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Skipping seed in development mode (data exists)');
        return;
      }
    }

    // สร้าง Roles (ถ้ายังไม่มี)
    console.log('📋 Creating/checking roles...');
    
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });

    const customerRole = await prisma.role.upsert({
      where: { name: 'customer' },
      update: {},
      create: {
        name: 'customer',
        description: 'Customer with basic access',
      },
    });

    const employeeRole = await prisma.role.upsert({
      where: { name: 'employee' },
      update: {},
      create: {
        name: 'employee',
        description: 'Employee with staff access',
      },
    });

    console.log('✅ Roles ready:', { 
      admin: adminRole.id, 
      customer: customerRole.id, 
      employee: employeeRole.id 
    });

    // ตรวจสอบว่ามี admin user แล้วหรือไม่
    const adminEmail = 'admin@seeu.cafe';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists, skipping creation');
    } else {
      // สร้าง Admin User
      console.log('👤 Creating admin user...');
      
      const adminPassword = 'admin123'; // เปลี่ยนรหัสผ่านนี้ใน production
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      const adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          first_name: 'SeeU',
          last_name: 'Admin',
          User_id: BigInt(1),
          role_id: adminRole.id,
          email_verified: true,
          phone: '0891234567',
        },
      });

      console.log('✅ Admin user created:', {
        id: adminUser.id,
        email: adminUser.email,
        role_id: adminUser.role_id
      });
    }

    // ตรวจสอบว่ามี test customer แล้วหรือไม่
    const customerEmail = 'customer@seeu.cafe';
    const existingCustomer = await prisma.user.findUnique({
      where: { email: customerEmail }
    });

    if (existingCustomer) {
      console.log('✅ Test customer already exists, skipping creation');
    } else {
      // สร้าง Test Customer
      console.log('👥 Creating test customer...');
      
      const customerPassword = 'customer123';
      const hashedCustomerPassword = await bcrypt.hash(customerPassword, 10);
      
      const customerUser = await prisma.user.create({
        data: {
          email: customerEmail,
          password: hashedCustomerPassword,
          first_name: 'Test',
          last_name: 'Customer',
          User_id: BigInt(Date.now()),
          role_id: customerRole.id,
          email_verified: true,
        },
      });

      console.log('✅ Test customer created:', {
        id: customerUser.id,
        email: customerUser.email,
        role_id: customerUser.role_id
      });
    }

    // แสดงข้อมูลสุดท้าย
    const finalStats = await checkExistingData();
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('👨‍💼 Admin:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: admin123`);
    console.log('👤 Customer:');
    console.log(`   Email: ${customerEmail}`);
    console.log(`   Password: customer123`);
    
    console.log('\n💡 Tip: Use SKIP_SEED=true environment variable to skip seeding');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    
    // ให้ข้อมูลที่เป็นประโยชน์สำหรับการ debug
    if (error.code === 'P2002') {
      console.error('💡 This is likely a unique constraint violation - data may already exist');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// เรียกใช้งาน
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});