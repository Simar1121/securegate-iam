import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import RevokedToken from '../models/RevokedToken.js';

dotenv.config();

const permissionsData = [
  {
    name: 'View Users',
    code: 'users:read',
    category: 'User Management',
    description: 'Can view employee directory, profiles, and basic statistics',
    isSystem: true,
  },
  {
    name: 'Create Users',
    code: 'users:create',
    category: 'User Management',
    description: 'Can create and onboard new employees into the organization',
    isSystem: true,
  },
  {
    name: 'Edit Users',
    code: 'users:update',
    category: 'User Management',
    description: 'Can update employee profiles, departments, assigned roles, and status',
    isSystem: true,
  },
  {
    name: 'Delete Users',
    code: 'users:delete',
    category: 'User Management',
    description: 'Can permanently remove or deactivate employee records',
    isSystem: true,
  },
  {
    name: 'Manage Roles',
    code: 'roles:manage',
    category: 'Role Management',
    description: 'Can create, configure, update, and delete access roles',
    isSystem: true,
  },
  {
    name: 'Manage Permissions',
    code: 'permissions:manage',
    category: 'Role Management',
    description: 'Can configure system permissions and grant security privileges',
    isSystem: true,
  },
  {
    name: 'View Audit Logs',
    code: 'audit:read',
    category: 'Audit & Compliance',
    description: 'Can inspect immutable security audit trails and administrative actions',
    isSystem: true,
  },
  {
    name: 'Manage System Settings',
    code: 'settings:manage',
    category: 'System Administration',
    description: 'Can manage organization security policies, session timeouts, and IAM controls',
    isSystem: true,
  },
];

export const seedDatabase = async () => {
  // Seeding deletes and recreates IAM data. Require explicit opt-in in every environment.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY HALT: Destructive database seeding is disabled in production.');
  }
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error(
      'SECURITY HALT: Seeding is destructive. Set ALLOW_DESTRUCTIVE_SEED=true explicitly for a disposable development/test database.'
    );
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('SECURITY HALT: MONGODB_URI must explicitly target a disposable test database.');
  let seedDatabaseName = '';
  try { seedDatabaseName = new URL(mongoUri).pathname.replace(/^\//, ''); } catch {
    throw new Error('SECURITY HALT: MONGODB_URI is not a valid MongoDB URI.');
  }
  if (!/(^|[_-])test([_-]|$)/i.test(seedDatabaseName)) {
    throw new Error('SECURITY HALT: Destructive seed is restricted to database names containing "test".');
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(`[Seed] Connected to MongoDB for seeding: ${mongoose.connection.host}/${mongoose.connection.name}`);

    // 1. Seed Permissions
    console.log('[Seed] Seeding Permissions...');
    await Permission.deleteMany({});
    const createdPermissions = await Permission.insertMany(permissionsData);
    console.log(`[Seed] Seeded ${createdPermissions.length} permissions.`);

    // Helper map of permissions by code
    const permMap = {};
    createdPermissions.forEach((p) => {
      permMap[p.code] = p._id;
    });

    // 2. Seed Roles
    console.log('[Seed] Seeding Roles...');
    await Role.deleteMany({});

    const superAdminRole = await Role.create({
      name: 'Super Admin',
      description: 'Full unrestricted system access, IAM governance, and security controls.',
      permissions: createdPermissions.map((p) => p._id),
      isDefault: false,
      isCustom: false,
      status: 'Active',
    });

    const itAdminRole = await Role.create({
      name: 'IT Administrator',
      description: 'Manages system identity, directory services, custom roles, and security audit logs.',
      permissions: [
        permMap['users:read'],
        permMap['users:update'],
        permMap['roles:manage'],
        permMap['permissions:manage'],
        permMap['settings:manage'],
        permMap['audit:read'],
      ],
      isDefault: false,
      isCustom: false,
      status: 'Active',
    });

    const hrManagerRole = await Role.create({
      name: 'HR Manager',
      description: 'Manages employee directory, onboarding new staff, and monitoring staff records.',
      permissions: [
        permMap['users:read'],
        permMap['users:create'],
        permMap['users:update'],
        permMap['audit:read'],
      ],
      isDefault: false,
      isCustom: false,
      status: 'Active',
    });

    const employeeRole = await Role.create({
      name: 'Employee',
      description: 'Standard employee with self-service profile and password management.',
      permissions: [],
      isDefault: true,
      isCustom: false,
      status: 'Active',
    });

    // Custom Security Analyst Role (demonstrating custom roles)
    const securityAuditorRole = await Role.create({
      name: 'Security Auditor',
      description: 'Compliance reviewer with read-only access to users and audit trails.',
      permissions: [permMap['users:read'], permMap['audit:read']],
      isDefault: false,
      isCustom: true,
      status: 'Active',
    });

    console.log('[Seed] Seeded 5 standard and custom roles.');

    // 3. Seed Users
    console.log('[Seed] Seeding Users...');
    await User.deleteMany({});

    const usersData = [
      {
        firstName: 'Alexander',
        lastName: 'Vance',
        email: 'admin@securegate.io',
        password: 'Admin@123',
        employeeId: 'SEC-0001',
        department: 'Information Technology',
        jobTitle: 'Chief Information Security Officer',
        role: superAdminRole._id,
        status: 'Active',
        phone: '+1 (555) 234-5678',
        location: 'San Francisco, CA',
        bio: 'Oversees enterprise IAM architecture, zero-trust protocols, and cybersecurity posture.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      },
      {
        firstName: 'Marcus',
        lastName: 'Chen',
        email: 'it@securegate.io',
        password: 'It@123',
        employeeId: 'SEC-0088',
        department: 'Information Technology',
        jobTitle: 'Lead Cloud Infrastructure Architect',
        role: itAdminRole._id,
        status: 'Active',
        phone: '+1 (555) 456-7890',
        location: 'Seattle, WA',
        bio: 'Managing hybrid identity connectors, directory synch, and role management.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hrs ago
      },
      {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'hr@securegate.io',
        password: 'Hr@123',
        employeeId: 'SEC-0042',
        department: 'Human Resources',
        jobTitle: 'VP of Global People Operations',
        role: hrManagerRole._id,
        status: 'Active',
        phone: '+1 (555) 345-6789',
        location: 'New York, NY',
        bio: 'Overseeing global talent onboarding, organizational structure, and employee lifecycle.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hrs ago
      },
      {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.dev@securegate.io',
        password: 'Employee@123',
        employeeId: 'SEC-0112',
        department: 'Engineering',
        jobTitle: 'Senior Frontend Engineer',
        role: employeeRole._id,
        status: 'Active',
        phone: '+1 (555) 567-8901',
        location: 'Austin, TX',
        bio: 'Building enterprise interfaces with modern React, Tailwind, and high-performance UX.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.ops@securegate.io',
        password: 'Employee@123',
        employeeId: 'SEC-0145',
        department: 'Operations',
        jobTitle: 'Site Reliability Engineer',
        role: employeeRole._id,
        status: 'Suspended',
        phone: '+1 (555) 678-9012',
        location: 'Chicago, IL',
        bio: 'Account temporarily suspended during routine credential rotation security audit.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 72),
      },
      {
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya.pm@securegate.io',
        password: 'Employee@123',
        employeeId: 'SEC-0199',
        department: 'Product',
        jobTitle: 'Principal IAM Product Specialist',
        role: securityAuditorRole._id,
        status: 'Active',
        phone: '+1 (555) 789-0123',
        location: 'Boston, MA',
        bio: 'Leading product security compliance, FedRAMP alignment, and access transparency.',
        lastLogin: new Date(Date.now() - 1000 * 60 * 45),
      },
    ];

    const createdUsers = [];
    for (const u of usersData) {
      const user = new User(u);
      await user.save();
      createdUsers.push(user);
    }
    console.log(`[Seed] Seeded ${createdUsers.length} initial employees.`);

    // 4. Seed Audit Logs
    console.log('[Seed] Seeding Audit Logs...');
    await AuditLog.deleteMany({});
    await RevokedToken.deleteMany({});

    const adminUser = createdUsers[0];
    const hrUser = createdUsers[2];

    const auditLogsData = [
      {
        action: 'SYSTEM_BOOTSTRAP',
        category: 'SYSTEM',
        actor: adminUser._id,
        actorEmail: adminUser.email,
        actorName: adminUser.fullName,
        actorRole: 'Super Admin',
        targetType: 'System',
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'SecureGate Bootstrapper/1.0',
        details: { message: 'Initialized 8 core security permissions and default enterprise roles.' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
      {
        action: 'USER_CREATED',
        category: 'USER_MGMT',
        actor: hrUser._id,
        actorEmail: hrUser.email,
        actorName: hrUser.fullName,
        actorRole: 'HR Manager',
        targetType: 'User',
        targetId: createdUsers[3]._id.toString(),
        targetName: createdUsers[3].fullName,
        status: 'SUCCESS',
        ipAddress: '192.168.1.45',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
        details: { email: 'sarah.dev@securegate.io', role: 'Employee', department: 'Engineering' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
      },
      {
        action: 'ROLE_CREATED',
        category: 'RBAC',
        actor: adminUser._id,
        actorEmail: adminUser.email,
        actorName: adminUser.fullName,
        actorRole: 'Super Admin',
        targetType: 'Role',
        targetId: securityAuditorRole._id.toString(),
        targetName: securityAuditorRole.name,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        details: { roleName: 'Security Auditor', permissionsCount: 2 },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        action: 'LOGIN_FAILED',
        category: 'AUTH',
        actor: null,
        actorEmail: 'admin@securegate.io',
        actorName: 'Anonymous / Unknown',
        actorRole: 'None',
        targetType: 'Auth',
        targetName: 'admin@securegate.io',
        status: 'FAILED',
        ipAddress: '198.51.100.23',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        details: { reason: 'Incorrect password attempt flagged by brute-force shield.' },
        createdAt: new Date(Date.now() - 1000 * 60 * 120),
      },
      {
        action: 'LOGIN_SUCCESS',
        category: 'AUTH',
        actor: adminUser._id,
        actorEmail: adminUser.email,
        actorName: adminUser.fullName,
        actorRole: 'Super Admin',
        targetType: 'Auth',
        targetName: adminUser.email,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
        details: { employeeId: 'SEC-0001', role: 'Super Admin' },
        createdAt: new Date(Date.now() - 1000 * 60 * 15),
      },
      {
        action: 'USER_STATUS_CHANGE',
        category: 'USER_MGMT',
        actor: adminUser._id,
        actorEmail: adminUser.email,
        actorName: adminUser.fullName,
        actorRole: 'Super Admin',
        targetType: 'User',
        targetId: createdUsers[4]._id.toString(),
        targetName: createdUsers[4].fullName,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: { from: 'Active', to: 'Suspended', reason: 'Routine credential rotation check' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
    ];

    await AuditLog.insertMany(auditLogsData);
    console.log('[Seed] Seeded realistic audit log events.');

    console.log('\n=============================================');
    console.log(' SECUREGATE DATABASE SEED COMPLETED SUCCESSFULLY');
    console.log('=============================================');
    console.log('=============================================\n');

    return true;
  } catch (error) {
    console.error('[Seed Error]:', error);
    throw error;
  }
};