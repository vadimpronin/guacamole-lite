const Crypt = require('../lib/Crypt');

const cypher = 'AES-256-CBC';
const key = 'MySuperSecretKeyForParamsToken12';
const invalidKey = 'InvalidSecretKeyForTesting12';

const crypt = new Crypt(cypher, key);
const cryptWithInvalidKey = new Crypt(cypher, invalidKey);

const tokenObject = {
    connection: {
        type: 'rdp',
        settings: {
            hostname: '10.10.10.10',
            username: 'Administrator',
            password: 'Password',
            'enable-drive': true,
            'create-drive-path': true,
            security: 'any',
            'ignore-cert': true,
            'enable-wallpaper': false,
        },
    },
};

describe('Encryption/Decryption Tests', () => {
    test('Encryption', () => {
        const encryptedToken = crypt.encrypt(tokenObject);
        expect(encryptedToken).toBeDefined();
        expect(typeof encryptedToken).toBe('string');
    });

    test('Decryption', () => {
        const encryptedToken = crypt.encrypt(tokenObject);
        const decryptedToken = crypt.decrypt(encryptedToken);
        expect(decryptedToken).toEqual(tokenObject);
    });

    test('Decryption with Invalid Key', () => {
        const encryptedToken = crypt.encrypt(tokenObject);
        expect(() => {
            cryptWithInvalidKey.decrypt(encryptedToken);
        }).toThrow();
    });

    test('Decryption with Corrupted Data', () => {
        const encryptedToken = crypt.encrypt(tokenObject);
        // Remove the last 10 characters to corrupt the token
        const corruptedToken = encryptedToken.substring(0, encryptedToken.length - 10);
        expect(() => {
            crypt.decrypt(corruptedToken);
        }).toThrow();
    });

    test('Encryption/Decryption with Special Characters', () => {
        const specialCharObject = {
            connection: {
                type: 'rdp',
                settings: {
                    hostname: '10.10.10.10',
                    username: 'Admin!@#$%^&*()_+',
                    password: 'P@$$w0rd!',
                    'enable-drive': true,
                    'create-drive-path': true,
                    security: 'any',
                    'ignore-cert': true,
                    'enable-wallpaper': false,
                },
            },
        };
        const encryptedToken = crypt.encrypt(specialCharObject);
        const decryptedToken = crypt.decrypt(encryptedToken);
        expect(decryptedToken).toEqual(specialCharObject);
    });
});
