import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const testMongoUri = process.env.MONGODB_TEST_URI;
if (!testMongoUri) {
  console.error('[TEST SAFETY] Set MONGODB_TEST_URI to a separate disposable database (for example securegate_test_db).');
  process.exit(1);
}

let testDatabaseName = '';
try {
  testDatabaseName = new URL(testMongoUri).pathname.replace(/^\//, '');
} catch {
  console.error('[TEST SAFETY] MONGODB_TEST_URI must be a valid MongoDB URI.');
  process.exit(1);
}
if (!/(^|[_-])test([_-]|$)/i.test(testDatabaseName)) {
  console.error('[TEST SAFETY] Refusing to run destructive tests: database name must clearly contain the word "test".');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.ALLOW_DESTRUCTIVE_SEED = 'true';

const mongoose = (await import('mongoose')).default;
const jwt = (await import('jsonwebtoken')).default;
const app = (await import('./src/server.js')).default;
const User = (await import('./src/models/User.js')).default;
const Role = (await import('./src/models/Role.js')).default;
const AuditLog = (await import('./src/models/AuditLog.js')).default;
const RevokedToken = (await import('./src/models/RevokedToken.js')).default;
const { seedDatabase } = await import('./src/utils/seedData.js');

async function runSecurityTests() {
  console.log('\n======================================================');
  console.log(' SECUREGATE SECURITY AUDIT & REMEDIATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  const baseUrl = 'http://127.0.0.1:5010/api';

  async function api(path, options = {}) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, data, headers: res.headers };
    } catch (err) {
      return { status: 500, ok: false, error: err.message };
    }
  }

  // Always start an isolated test server on port 5010; never reuse the development server.
  let localServer;
  try {
    await mongoose.connection.asPromise();
    localServer = app.listen(5010);
  } catch (error) {
    console.error('[TEST SETUP] MongoDB test database connection failed:', error.message);
    process.exit(1);
  }

  try {
    const check = await fetch('http://localhost:5000/api/health').catch(() => null);
    if (!check || !check.ok) {
      localServer = app.listen(5000);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    localServer = app.listen(5000);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  try {
    // 0. Ensure fresh database state
    await seedDatabase();

    const roles = await Role.find({});
    const superAdminRole = roles.find((r) => r.name === 'Super Admin');
    const itAdminRole = roles.find((r) => r.name === 'IT Administrator');
    const hrRole = roles.find((r) => r.name === 'HR Manager');
    const empRole = roles.find((r) => r.name === 'Employee');

    // TEST 1: Super Admin Authentication
    console.log('\n--- 1. Super Admin Authentication ---');
    const superLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@securegate.io', password: 'Admin@123' }),
    });
    assert(
      superLogin.status === 200 && !!superLogin.data.token && superLogin.data.user.role.name === 'Super Admin',
      'Super Admin logs in with valid credentials and receives JWT token with populated role'
    );
    const superToken = superLogin.data.token;

    // TEST 2: IT Administrator Permissions
    console.log('\n--- 2. IT Administrator Permissions ---');
    const itLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'it@securegate.io', password: 'It@123' }),
    });
    assert(itLogin.status === 200 && !!itLogin.data.token, 'IT Administrator logs in successfully');
    const itToken = itLogin.data.token;

    const itAuditAccess = await api('/audit-logs', {
      headers: { Authorization: `Bearer ${itToken}` },
    });
    assert(itAuditAccess.status === 200, 'IT Administrator can read audit logs (permission: audit:read)');

    const itRoleList = await api('/roles', {
      headers: { Authorization: `Bearer ${itToken}` },
    });
    assert(itRoleList.status === 200, 'IT Administrator can manage roles (permission: roles:manage)');

    // IT Admin lacks users:delete
    const itDeleteUser = await api('/users/507f1f77bcf86cd799439011', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${itToken}` },
    });
    assert(
      itDeleteUser.status === 403,
      'IT Administrator is blocked from deleting users (lacks users:delete permission: 403 Forbidden)'
    );

    // TEST 3: HR Manager Permissions
    console.log('\n--- 3. HR Manager Permissions ---');
    const hrLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hr@securegate.io', password: 'Hr@123' }),
    });
    assert(hrLogin.status === 200 && !!hrLogin.data.token, 'HR Manager logs in successfully');
    const hrToken = hrLogin.data.token;

    const hrUsersAccess = await api('/users', {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    assert(hrUsersAccess.status === 200, 'HR Manager can read employee directory (permission: users:read)');

    // HR Manager lacks roles:manage
    const hrCreateRole = await api('/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({ name: 'Unauthorized Role', permissions: [] }),
    });
    assert(
      hrCreateRole.status === 403,
      'HR Manager is blocked from creating roles (lacks roles:manage permission: 403 Forbidden)'
    );

    // TEST 4: Employee Permissions
    console.log('\n--- 4. Employee Permissions ---');
    const empLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarah.dev@securegate.io', password: 'Employee@123' }),
    });
    assert(empLogin.status === 200 && !!empLogin.data.token, 'Employee logs in successfully');
    const empToken = empLogin.data.token;

    const empMe = await api('/auth/me', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert(empMe.status === 200, 'Employee can view their own profile (/auth/me)');

    const empUserList = await api('/users', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert(empUserList.status === 403, 'Employee is blocked from user directory (/users: 403 Forbidden)');

    const empAuditLogs = await api('/audit-logs', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert(empAuditLogs.status === 403, 'Employee is blocked from audit logs (/audit-logs: 403 Forbidden)');

    // TEST 5: Suspended User Authentication
    console.log('\n--- 5. Suspended User Authentication ---');
    const suspendedLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'david.ops@securegate.io', password: 'Employee@123' }),
    });
    assert(
      suspendedLogin.status === 403 && suspendedLogin.data.message.toLowerCase().includes('suspended'),
      'Suspended user login attempt is blocked with 403 Forbidden'
    );

    // TEST 6: Unauthorized Role Escalation
    console.log('\n--- 6. Unauthorized Role Escalation ---');
    // HR Manager attempts to promote Sarah to IT Administrator or Super Admin
    const sarahUser = await User.findOne({ email: 'sarah.dev@securegate.io' });

    const hrEscalateToSuper = await api(`/users/${sarahUser._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({ roleId: superAdminRole._id.toString() }),
    });
    assert(
      hrEscalateToSuper.status === 403 && hrEscalateToSuper.data.message.includes('Privilege Escalation Blocked'),
      'HR Manager cannot escalate user to Super Admin (Blocked with 403 Forbidden)'
    );

    const hrEscalateToIT = await api(`/users/${sarahUser._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({ roleId: itAdminRole._id.toString() }),
    });
    assert(
      hrEscalateToIT.status === 403 && hrEscalateToIT.data.message.includes('Privilege Escalation Blocked'),
      'HR Manager cannot escalate user to IT Administrator (Blocked with 403 Forbidden)'
    );

    // TEST 7: Unauthorized Super Admin Creation
    console.log('\n--- 7. Unauthorized Super Admin Creation ---');
    // HR Manager attempts to provision a brand-new Super Admin account
    const hrCreateAdmin = await api('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        firstName: 'Malicious',
        lastName: 'Admin',
        email: 'malicious.admin@securegate.io',
        roleId: superAdminRole._id.toString(),
      }),
    });
    assert(
      hrCreateAdmin.status === 403 && hrCreateAdmin.data.message.includes('Privilege Escalation Blocked'),
      'HR Manager cannot create a new Super Admin account (Blocked with 403 Forbidden)'
    );

    // HR Manager attempts to provision an IT Administrator account
    const hrCreateIT = await api('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        firstName: 'Malicious',
        lastName: 'IT',
        email: 'malicious.it@securegate.io',
        roleId: itAdminRole._id.toString(),
      }),
    });
    assert(
      hrCreateIT.status === 403 && hrCreateIT.data.message.includes('Privilege Escalation Blocked'),
      'HR Manager cannot create an IT Administrator account (Blocked with 403 Forbidden)'
    );

    // TEST 8: Database Seeding Protection
    console.log('\n--- 8. Database Seeding Protection ---');
    const publicSeedAttempt = await api('/seed', { method: 'POST' });
    assert(
      publicSeedAttempt.status === 404,
      'Public POST /api/seed route has been removed from HTTP router (Returns 404 Not Found)'
    );

    // Test safety check in seedDatabase: In production mode without explicit override, it must throw!
    const originalEnv = process.env.NODE_ENV;
    const originalSeedFlag = process.env.ALLOW_DESTRUCTIVE_SEED;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DESTRUCTIVE_SEED;
    let seedBlockedInProd = false;
    try {
      await seedDatabase();
    } catch (err) {
      if (err.message.includes('SECURITY HALT')) {
        seedBlockedInProd = true;
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.ALLOW_DESTRUCTIVE_SEED = originalSeedFlag;
    }
    assert(seedBlockedInProd, 'seedDatabase() explicitly halts destructive operations in production mode without override');

    // TEST 9: Invalid and Expired JWTs
    console.log('\n--- 9. Invalid and Expired JWTs ---');
    const forgedToken = jwt.sign(
      { id: sarahUser._id, email: sarahUser.email },
      'forged_wrong_secret_123456789012345678901234567890',
      { expiresIn: '1h' }
    );
    const forgedAuth = await api('/auth/me', {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    assert(forgedAuth.status === 401, 'Forged JWT with incorrect signature is rejected (401 Unauthorized)');

    const expiredToken = jwt.sign(
      { id: sarahUser._id, email: sarahUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expiredAuth = await api('/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(
      expiredAuth.status === 401 && expiredAuth.data.message.toLowerCase().includes('expired'),
      'Expired JWT is rejected with token expired notice (401 Unauthorized)'
    );

    // TEST 10: Session Revocation
    console.log('\n--- 10. Session Revocation ---');
    // 10A: Revocation on Logout
    const sessionUserLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@securegate.io', password: 'Admin@123' }),
    });
    const sessionTokenA = sessionUserLogin.data.token;

    const logoutRes = await api('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    assert(logoutRes.status === 200, 'User logs out and server initiates session blacklist');

    const reuseLoggedOutToken = await api('/auth/me', {
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    assert(
      reuseLoggedOutToken.status === 401 && reuseLoggedOutToken.data.message.includes('revoked'),
      'Previously logged out token is rejected by server blacklist (401 Unauthorized)'
    );

    // 10B: Session Invalidation on Password Change
    const userForPass = await User.findOne({ email: 'sarah.dev@securegate.io' });
    const userLoginBeforePass = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarah.dev@securegate.io', password: 'Employee@123' }),
    });
    const tokenBeforePass = userLoginBeforePass.data.token;

    const changePassRes = await api('/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenBeforePass}` },
      body: JSON.stringify({
        currentPassword: 'Employee@123',
        newPassword: 'NewEmployeePass@2026',
      }),
    });
    assert(changePassRes.status === 200, 'Password rotated successfully to new complex password');

    // Attempting to reuse old token must now be rejected because tokenVersion changed!
    const reuseOldPassToken = await api('/auth/me', {
      headers: { Authorization: `Bearer ${tokenBeforePass}` },
    });
    assert(
      reuseOldPassToken.status === 401,
      'Old session token is invalidated across all devices after password change (401 Unauthorized)'
    );

    // Reset password back for consistency
    const resetLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarah.dev@securegate.io', password: 'NewEmployeePass@2026' }),
    });
    await api('/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${resetLogin.data.token}` },
      body: JSON.stringify({
        currentPassword: 'NewEmployeePass@2026',
        newPassword: 'Employee@123',
      }),
    });

    // TEST 11: Brute-Force Protection
    console.log('\n--- 11. Brute-Force Protection ---');
    // Create dedicated user for lockout testing
    const testEmail = 'brute.target@securegate.io';
    await User.deleteOne({ email: testEmail });
    const targetUser = new User({
      firstName: 'Brute',
      lastName: 'Target',
      email: testEmail,
      password: 'TargetPassword@123',
      role: empRole._id,
      status: 'Active',
    });
    await targetUser.save();

    let fifthAttemptStatus = 0;
    for (let i = 1; i <= 4; i++) {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword@123' }),
      });
    }

    const fifthAttempt = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword@123' }),
    });
    fifthAttemptStatus = fifthAttempt.status;
    assert(
      fifthAttemptStatus === 423 && fifthAttempt.data.message.includes('locked'),
      '5th consecutive failed login locks the account for 15 minutes (Status 423 Locked)'
    );

    const sixthAttempt = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: 'TargetPassword@123' }), // even with correct password!
    });
    assert(
      sixthAttempt.status === 423 && sixthAttempt.data.message.includes('temporarily locked'),
      'Subsequent login attempts while locked are rejected even with correct credentials (423 Locked)'
    );

    // TEST 12: Audit Logging Security
    console.log('\n--- 12. Audit Logging Security ---');
    const recentAuditLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);
    assert(recentAuditLogs.length > 0, 'Security audit events are captured in MongoDB AuditLog collection');

    // Verify sensitive data scrubbing
    let hasLeak = false;
    for (const log of recentAuditLogs) {
      const detailsStr = JSON.stringify(log.details || {});
      if (
        detailsStr.includes('TargetPassword@123') ||
        detailsStr.includes('WrongPassword@123') ||
        detailsStr.includes('Admin@123')
      ) {
        hasLeak = true;
      }
    }
    assert(!hasLeak, 'Audit log details scrub sensitive passwords, tokens, and credentials (zero credential leakage)');

    // Verify lockout audit log
    const lockoutLog = await AuditLog.findOne({ action: 'ACCOUNT_LOCKED', targetName: testEmail });
    assert(!!lockoutLog, 'ACCOUNT_LOCKED security event successfully logged with actor metadata and timestamp');

    // Verify privilege escalation attempt log
    const escalationLog = await AuditLog.findOne({ action: 'PRIVILEGE_ESCALATION_BLOCKED' });
    assert(!!escalationLog, 'PRIVILEGE_ESCALATION_BLOCKED security event successfully logged in audit trail');

    // Summary
    console.log('\n======================================================');
    console.log(` AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test execution uncaught exception:', error);
    failed++;
  } finally {
    if (localServer) {
      await new Promise((resolve) => localServer.close(resolve));
    }
    await mongoose.disconnect().catch(() => {});
    process.exitCode = failed === 0 ? 0 : 1;
  }
}

runSecurityTests();
