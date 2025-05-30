// scripts/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting database seeding...');

    // สร้าง Roles
    console.log('📋 Creating roles...');
    
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

    console.log('✅ Roles created:', { adminRole: adminRole.id, customerRole: customerRole.id, employeeRole: employeeRole.id });

    // สร้าง Admin User
    console.log('👤 Creating admin user...');
    
    const adminEmail = 'admin@seeu.cafe';
    const adminPassword = 'admin123'; // เปลี่ยนรหัสผ่านนี้ใน production
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedPassword,
        role_id: adminRole.id,
        email_verified: true,
      },
      create: {
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

    // สร้าง Test Customer
    console.log('👥 Creating test customer...');
    
    const customerEmail = 'customer@seeu.cafe';
    const customerPassword = 'customer123';
    
    const hashedCustomerPassword = await bcrypt.hash(customerPassword, 10);
    
    const customerUser = await prisma.user.upsert({
      where: { email: customerEmail },
      update: {
        password: hashedCustomerPassword,
        role_id: customerRole.id,
        email_verified: true,
      },
      create: {
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

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('👨‍💼 Admin:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('👤 Customer:');
    console.log(`   Email: ${customerEmail}`);
    console.log(`   Password: ${customerPassword}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();