import { db } from '../server/db';
import { categories, subcategories } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedCategories() {
  console.log('Seeding categories...');

  // Check if categories already exist
  const existingCategories = await db.select().from(categories);
  if (existingCategories.length > 0) {
    console.log('Categories already exist, skipping seed');
    return;
  }

  // Insert main categories
  const mainCategories = [
    {
      name: 'Sarees',
      description: 'Traditional and contemporary sarees for all occasions',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567/sarees.jpg',
      isActive: true
    },
    {
      name: 'Salwar Kameez',
      description: 'Elegant salwar kameez sets for women',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567/salwar.jpg',
      isActive: true
    },
    {
      name: 'Lehenga Choli',
      description: 'Beautiful lehenga choli for weddings and festivals',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567/lehenga.jpg',
      isActive: true
    },
    {
      name: 'Kurtis',
      description: 'Stylish kurtis for casual and formal wear',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567/kurtis.jpg',
      isActive: true
    },
    {
      name: 'Gowns',
      description: 'Designer gowns for special occasions',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567/gowns.jpg',
      isActive: true
    }
  ];

  const insertedCategories = await db.insert(categories).values(mainCategories).returning();
  console.log(`Inserted ${insertedCategories.length} categories`);

  // Insert subcategories for each category
  const subcategoriesData = [
    // Sarees subcategories
    { name: 'Silk Sarees', description: 'Pure silk sarees', categoryId: insertedCategories[0].id, isActive: true },
    { name: 'Cotton Sarees', description: 'Comfortable cotton sarees', categoryId: insertedCategories[0].id, isActive: true },
    { name: 'Banarasi Sarees', description: 'Traditional Banarasi silk sarees', categoryId: insertedCategories[0].id, isActive: true },
    { name: 'Kanchipuram Sarees', description: 'Authentic Kanchipuram silk sarees', categoryId: insertedCategories[0].id, isActive: true },
    
    // Salwar Kameez subcategories
    { name: 'Cotton Salwar', description: 'Daily wear cotton salwar kameez', categoryId: insertedCategories[1].id, isActive: true },
    { name: 'Silk Salwar', description: 'Party wear silk salwar kameez', categoryId: insertedCategories[1].id, isActive: true },
    { name: 'Anarkali', description: 'Designer Anarkali suits', categoryId: insertedCategories[1].id, isActive: true },
    { name: 'Patiala', description: 'Traditional Patiala suits', categoryId: insertedCategories[1].id, isActive: true },
    
    // Lehenga Choli subcategories
    { name: 'Bridal Lehenga', description: 'Heavy bridal lehengas', categoryId: insertedCategories[2].id, isActive: true },
    { name: 'Party Wear Lehenga', description: 'Light party wear lehengas', categoryId: insertedCategories[2].id, isActive: true },
    { name: 'Traditional Lehenga', description: 'Traditional style lehengas', categoryId: insertedCategories[2].id, isActive: true },
    
    // Kurtis subcategories
    { name: 'Cotton Kurtis', description: 'Comfortable cotton kurtis', categoryId: insertedCategories[3].id, isActive: true },
    { name: 'Designer Kurtis', description: 'Designer kurtis for special occasions', categoryId: insertedCategories[3].id, isActive: true },
    { name: 'Long Kurtis', description: 'Elegant long kurtis', categoryId: insertedCategories[3].id, isActive: true },
    
    // Gowns subcategories
    { name: 'Party Gowns', description: 'Stylish party gowns', categoryId: insertedCategories[4].id, isActive: true },
    { name: 'Evening Gowns', description: 'Elegant evening gowns', categoryId: insertedCategories[4].id, isActive: true },
    { name: 'Designer Gowns', description: 'Designer collection gowns', categoryId: insertedCategories[4].id, isActive: true }
  ];

  const insertedSubcategories = await db.insert(subcategories).values(subcategoriesData).returning();
  console.log(`Inserted ${insertedSubcategories.length} subcategories`);

  console.log('Seeding completed successfully!');
}

// Run the seed function
seedCategories().catch(console.error);