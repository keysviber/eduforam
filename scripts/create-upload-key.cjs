// First-release setup only. Never overwrites an existing key or prints passwords.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const dir = path.resolve(__dirname, '../.credentials');
const key = path.join(dir, 'education-forum-upload.jks');
const props = path.join(dir, 'android-upload.properties');
if (fs.existsSync(key) || fs.existsSync(props)) throw new Error('Existing credentials found; refusing to replace them.');
fs.mkdirSync(dir, { recursive: true });
const password = crypto.randomBytes(32).toString('hex');
const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'keytool.exe') : 'keytool';
const result = spawnSync(keytool, ['-genkeypair', '-noprompt', '-keystore', key, '-storetype', 'JKS', '-alias', 'education-forum-upload', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Education Forum Upload', '-storepass:env', 'EDU_KEY_PASSWORD', '-keypass:env', 'EDU_KEY_PASSWORD'], { env: { ...process.env, EDU_KEY_PASSWORD: password }, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Key generation failed');
fs.writeFileSync(props, `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=education-forum-upload\n`, { flag: 'wx', mode: 0o600 });
console.log('Created upload key and password file in .credentials. Back up this folder securely.');
