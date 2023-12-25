const crypto = require('crypto');

const CIPHER = 'aes-256-cbc';
const SECRET_KEY = 'MySuperSecretKeyForParamsToken12';

const tokenObject = {
    connection: {
        type: "rdp",
        settings: {
            "hostname": "10.0.0.12",
            "username": "Administrator",
            "password": "pAsSwOrD",
            "enable-drive": true,
            "create-drive-path": true,
            "security": "any",
            "ignore-cert": true,
            "enable-wallpaper": false
        }
    }
};

function encryptToken(value) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);

    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const data = {
        iv: iv.toString('base64'),
        value: encrypted
    };

    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64');
}

const originalToken = JSON.stringify(tokenObject, null, 2);
const token = encryptToken(tokenObject);
const urlencodedToken = encodeURIComponent(token);

console.log("Parameters:");
console.log(originalToken);

console.log("\n");

console.log("Encrypted token:");
console.log(token);

console.log("\n");

console.log("Use this token in the URL:");
console.log(`ws://localhost:8080/?token=${urlencodedToken}`);
