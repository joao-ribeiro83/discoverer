import { db, pool } from './index.js';
import {
  users,
  dataSources,
  businessAreas,
  userBusinessAreaGrants,
} from './schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clean slate (respect FK order)
  await db.delete(userBusinessAreaGrants);
  await db.delete(businessAreas);
  await db.delete(dataSources);
  await db.delete(users);

  // 1. Admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@discoverer.local',
      passwordHash,
      name: 'Discoverer Admin',
      role: 'ADMIN',
    })
    .returning();
  if (!admin) throw new Error('Failed to create admin user');
  console.log(`  ✓ admin user: ${admin.email}`);

  // 2. Sample data source (placeholder connection info)
  const [ds] = await db
    .insert(dataSources)
    .values({
      name: 'Sample Oracle DB',
      description: 'Placeholder Oracle data source for development',
      connectionType: 'oracle',
      host: 'oracle-db.example.com',
      port: 1521,
      serviceName: 'ORCL',
      sid: 'ORCL',
      username: 'discoverer_readonly',
      passwordEnc: 'PLACEHOLDER_ENCRYPTED_PASSWORD',
      connectionString: '//oracle-db.example.com:1521/ORCL',
      isActive: true,
    })
    .returning();
  if (!ds) throw new Error('Failed to create data source');
  console.log(`  ✓ data source: ${ds.name}`);

  // 3. Sample business area
  const [ba] = await db
    .insert(businessAreas)
    .values({
      name: 'Sales Analytics',
      description: 'Sample business area for sales reporting and analysis',
      createdBy: admin.id,
      updatedBy: admin.id,
      isActive: true,
    })
    .returning();
  if (!ba) throw new Error('Failed to create business area');
  console.log(`  ✓ business area: ${ba.name}`);

  // 4. Grant admin full access to the business area
  await db.insert(userBusinessAreaGrants).values([
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'CREATE',
      grantedBy: admin.id,
    },
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'EDIT',
      grantedBy: admin.id,
    },
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'DELETE',
      grantedBy: admin.id,
    },
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'EXPORT',
      grantedBy: admin.id,
    },
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'SCHEDULE',
      grantedBy: admin.id,
    },
    {
      userId: admin.id,
      businessAreaId: ba.id,
      permissionLevel: 'VIEW',
      grantedBy: admin.id,
    },
  ]);
  console.log(`  ✓ granted admin all permissions on ${ba.name}`);

  console.log('\n✅ Seed complete.');
  console.log('');
  console.log('Login credentials:');
  console.log('  email:    admin@discoverer.local');
  console.log('  password: admin123');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
