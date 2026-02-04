/**
 * Auto-login script to refresh Phabricator session cookies
 * 
 * Usage: npx ts-node scripts/refresh-session.ts
 * Or: npm run refresh-session
 * 
 * This script will:
 * 1. Login to Phabricator using LDAP credentials
 * 2. Extract the new session cookies (phusr, phsid)
 * 3. Update .env.local with the new values
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  CookieJar,
  parseCookies,
  mergeCookies,
  cookieString,
  extractCsrfToken,
} from '../lib/session/cookies';

dotenv.config({ path: '.env.local' });

async function refreshSession() {
  const host = process.env.PHA_HOST;
  const username = process.env.PHA_LOGIN_USER;
  const password = process.env.PHA_LOGIN_PASS;

  if (!host) {
    console.error('Error: PHA_HOST not set in .env.local');
    process.exit(1);
  }

  if (!username || !password) {
    console.error('Error: PHA_LOGIN_USER or PHA_LOGIN_PASS not set in .env.local');
    console.error('Please add:');
    console.error('  PHA_LOGIN_USER=your_email@tp-link.com.cn');
    console.error('  PHA_LOGIN_PASS=your_password');
    process.exit(1);
  }

  console.log(`Logging in to ${host} as ${username}...`);

  let cookies: CookieJar = {};

  try {
    // Step 1: Directly access LDAP login form (skip CAS redirect)
    console.log('Step 1: Accessing LDAP login form...');
    const ldapFormUrl = `${host}/auth/login/ldap:self/`;
    const ldapFormRes = await fetch(ldapFormUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookieString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'manual',
    });

    const setCookies1 = ldapFormRes.headers.getSetCookie?.() || [];
    cookies = mergeCookies(cookies, parseCookies(setCookies1));
    
    const ldapFormHtml = await ldapFormRes.text();
    
    console.log('  LDAP form HTML length:', ldapFormHtml.length);
    console.log('  LDAP form preview (first 1500 chars):');
    console.log(ldapFormHtml.substring(0, 1500));
    
    const ldapCsrfToken = extractCsrfToken(ldapFormHtml);
    if (!ldapCsrfToken) {
      console.error('Could not find CSRF token on LDAP login form');
      process.exit(1);
    }

    console.log('  CSRF token obtained:', ldapCsrfToken.substring(0, 20) + '...');

    // Step 2: Submit LDAP login
    console.log('Step 2: Submitting LDAP credentials...');
    const loginFormData = new URLSearchParams();
    loginFormData.append('__csrf__', ldapCsrfToken);
    loginFormData.append('__form__', '1');
    loginFormData.append('__dialog__', '1');
    loginFormData.append('ldap_username', username);
    loginFormData.append('ldap_password', password);

    const loginRes = await fetch(ldapFormUrl, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': host,
      },
      body: loginFormData.toString(),
      redirect: 'manual',
    });

    const setCookies2 = loginRes.headers.getSetCookie?.() || [];
    cookies = mergeCookies(cookies, parseCookies(setCookies2));

    console.log('  Login response status:', loginRes.status);
    console.log('  Cookies after login:', Object.keys(cookies));

    // Check for redirect to validate
    const location1 = loginRes.headers.get('location');
    console.log('  Redirect location:', location1);
    
    if (!location1) {
      const loginResHtml = await loginRes.text();
      console.log('  No redirect, response preview:', loginResHtml.substring(0, 500));
      if (loginResHtml.includes('Invalid') || loginResHtml.includes('error') || loginResHtml.includes('incorrect')) {
        console.error('Login failed - invalid credentials or error');
        process.exit(1);
      }
    }

    // Step 3: Follow redirect to validate
    if (location1) {
      console.log('Step 3: Validating session...');
      const validateUrl = location1.startsWith('http') ? location1 : `${host}${location1}`;
      const validateRes = await fetch(validateUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookieString(cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'manual',
      });

      const setCookies3 = validateRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies3));

      // Step 4: Follow redirect to finish
      const location2 = validateRes.headers.get('location');
      if (location2) {
        console.log('Step 4: Finishing login...');
        const finishUrl = location2.startsWith('http') ? location2 : `${host}${location2}`;
        const finishRes = await fetch(finishUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieString(cookies),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'manual',
        });

        const setCookies4 = finishRes.headers.getSetCookie?.() || [];
        cookies = mergeCookies(cookies, parseCookies(setCookies4));

        // Follow any more redirects
        const location3 = finishRes.headers.get('location');
        if (location3) {
          const finalUrl = location3.startsWith('http') ? location3 : `${host}${location3}`;
          const finalRes = await fetch(finalUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Cookie': cookieString(cookies),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'manual',
          });

          const setCookies5 = finalRes.headers.getSetCookie?.() || [];
          cookies = mergeCookies(cookies, parseCookies(setCookies5));
        }
      }
    }

    // Verify we got the session cookies
    if (!cookies.phusr || !cookies.phsid) {
      console.error('Failed to obtain session cookies');
      console.error('Cookies received:', cookies);
      process.exit(1);
    }

    console.log('\nLogin successful!');
    console.log(`  phusr: ${cookies.phusr}`);
    console.log(`  phsid: ${cookies.phsid}`);

    // Update .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add PHA_USER
    if (envContent.includes('PHA_USER=')) {
      envContent = envContent.replace(/PHA_USER=.*/, `PHA_USER=${cookies.phusr}`);
    } else {
      envContent += `\nPHA_USER=${cookies.phusr}`;
    }

    // Update or add PHA_SESSION
    if (envContent.includes('PHA_SESSION=')) {
      envContent = envContent.replace(/PHA_SESSION=.*/, `PHA_SESSION=${cookies.phsid}`);
    } else {
      envContent += `\nPHA_SESSION=${cookies.phsid}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('\n.env.local updated successfully!');
    console.log('Please restart the dev server to use the new session.');

  } catch (error: any) {
    console.error('Error during login:', error.message);
    process.exit(1);
  }
}

refreshSession();
