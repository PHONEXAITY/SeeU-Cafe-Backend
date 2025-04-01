import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clear existing data if in development environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('Clearing existing data...');
    const modelNames = Reflect.ownKeys(prisma).filter((key) => {
      return (
        typeof key === 'string' &&
        !key.startsWith('_') &&
        key !== '$connect' &&
        key !== '$disconnect' &&
        key !== '$on' &&
        key !== '$transaction' &&
        key !== '$use'
      );
    });

    for (const modelName of modelNames) {
      try {
        await prisma[modelName].deleteMany({});
      } catch (error) {
        console.log(`Error clearing ${String(modelName)}: ${error.message}`);
      }
    }
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
      // Add other role fields if your schema requires them
    },
  });

  // Then create the admin user and connect to the role
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@seeu.cafe',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: {
        connect: {
          id: adminRole.id,
        },
      },
      User_id: 1,
    },
  });

  console.log('Created admin user:', adminUser.email);

  // Create menu categories
  const hotDrinksCategory = await prisma.menuCategory.create({
    data: {
      name: 'Hot Drinks',
      description: 'Warm beverages to start your day',
      type: 'beverage',
      category_id: 101,
      status: 'active',
    },
  });

  const coldDrinksCategory = await prisma.menuCategory.create({
    data: {
      name: 'Cold Drinks',
      description: 'Refreshing cold beverages',
      type: 'beverage',
      category_id: 102,
      status: 'active',
    },
  });

  const foodCategory = await prisma.menuCategory.create({
    data: {
      name: 'Food',
      description: 'Delicious food items',
      type: 'food',
      category_id: 103,
      status: 'active',
    },
  });

  const dessertCategory = await prisma.menuCategory.create({
    data: {
      name: 'Desserts',
      description: 'Sweet treats to satisfy your cravings',
      type: 'food',
      category_id: 104,
      status: 'active',
    },
  });

  console.log('Created categories');

  // Create beverage menu items
  await prisma.beverageMenu.createMany({
    data: [
      {
        name: 'Espresso',
        description: 'Strong Italian coffee',
        price: 2.99,
        hot_price: 2.99,
        category_id: hotDrinksCategory.id,
        status: 'active',
      },
      {
        name: 'Americano',
        description: 'Espresso with hot water',
        price: 3.49,
        hot_price: 3.49,
        ice_price: 3.99,
        category_id: hotDrinksCategory.id,
        status: 'active',
      },
      {
        name: 'Latte',
        description: 'Espresso with steamed milk',
        price: 4.49,
        hot_price: 4.49,
        ice_price: 4.99,
        category_id: hotDrinksCategory.id,
        status: 'active',
      },
      {
        name: 'Thai Iced Tea',
        description: 'Sweet Thai tea with milk',
        price: 3.99,
        ice_price: 3.99,
        category_id: coldDrinksCategory.id,
        status: 'active',
      },
      {
        name: 'Iced Coffee',
        description: 'Cold brewed coffee over ice',
        price: 3.49,
        ice_price: 3.49,
        category_id: coldDrinksCategory.id,
        status: 'active',
      },
    ],
  });

  console.log('Created beverage menu items');

  // Create food menu items
  await prisma.foodMenu.createMany({
    data: [
      {
        name: 'Croissant',
        description: 'Flaky French pastry',
        price: 3.99,
        category_id: foodCategory.id,
        status: 'active',
      },
      {
        name: 'Sandwich',
        description: 'Ham and cheese sandwich',
        price: 5.99,
        category_id: foodCategory.id,
        status: 'active',
      },
      {
        name: 'Cake',
        description: 'Slice of chocolate cake',
        price: 4.99,
        category_id: dessertCategory.id,
        status: 'active',
      },
      {
        name: 'Brownie',
        description: 'Rich chocolate brownie',
        price: 3.49,
        category_id: dessertCategory.id,
        status: 'active',
      },
    ],
  });

  console.log('Created food menu items');

  // Create a table
  await prisma.table.create({
    data: {
      number: 1,
      capacity: 4,
      status: 'available',
      table_id: 1001,
    },
  });

  console.log('Created table');

  // Create employee
  await prisma.employee.create({
    data: {
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@seeu.cafe',
      position: 'Barista',
      salary: 15000,
      Employee_id: 2001,
    },
  });

  console.log('Created employee');

  // Create promotion
  await prisma.promotion.create({
    data: {
      name: 'Welcome Discount',
      code: 'WELCOME10',
      discount_type: 'percentage',
      discount_value: 10,
      start_date: new Date(),
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      status: 'active',
      promotion_id: 3001,
      description: 'Get 10% off your first order',
    },
  });

  console.log('Created promotion');

  // Create system settings
  await prisma.systemSettings.createMany({
    data: [
      {
        key: 'site_name',
        value: 'SeeU Cafe',
      },
      {
        key: 'site_description',
        value: 'Coffee & Bakery - Order Online',
      },
      {
        key: 'contact_email',
        value: 'contact@seeu.cafe',
      },
      {
        key: 'contact_phone',
        value: '+66123456789',
      },
      {
        key: 'address',
        value: '123 Coffee Street, Bangkok, Thailand',
      },
      {
        key: 'business_hours',
        value: 'Mon-Fri: 7:00 AM - 8:00 PM, Sat-Sun: 8:00 AM - 9:00 PM',
      },
    ],
  });

  console.log('Created system settings');

  // Create blog category
  const blogCategory = await prisma.blogCategory.create({
    data: {
      name: 'Coffee Tips',
      description: 'Tips and tricks for making great coffee',
      slug: 'coffee-tips',
    },
  });

  console.log('Created blog category');

  // Create blog post
  await prisma.blog.create({
    data: {
      title: 'How to Make Perfect Coffee at Home',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed consequat justo non mi efficitur, ut vestibulum nisi porttitor.',
      author: 'Coffee Expert',
      status: 'published',
      slug: 'how-to-make-perfect-coffee-at-home',
      categories: {
        connect: [{ id: blogCategory.id }],
      },
    },
  });

  console.log('Created blog post');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
