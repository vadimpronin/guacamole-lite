const Crypto = require('crypto');

class Crypt {

    constructor(cypher, key) {
        this.cypher = cypher;
        this.key = key;
    }

    decrypt(encodedString) {
        let encoded = JSON.parse(this.constructor.base64decode(encodedString));

        encoded.iv = this.constructor.base64decode(encoded.iv);
        encoded.value = this.constructor.base64decode(encoded.value, 'binary');

        const decipher = Crypto.createDecipheriv(this.cypher, this.key, encoded.iv);

        let decrypted = decipher.update(encoded.value, 'binary', 'ascii');
        decrypted += decipher.final('ascii');

        return JSON.parse(decrypted);
    }

    encrypt(jsonData) {
        const iv = Crypto.randomBytes(16);
        const cipher = Crypto.createCipheriv(this.cypher, this.key, iv);

        let encrypted = cipher.update(JSON.stringify(jsonData), 'utf8', 'binary');
        encrypted += cipher.final('binary');

        const data = {
            iv: this.constructor.base64encode(iv),
            value: this.constructor.base64encode(encrypted, 'binary')
        };

        return this.constructor.base64encode(JSON.stringify(data));
    }

    static base64decode(string, mode) {
        return Buffer.from(string, 'base64').toString(mode || 'ascii');
    }

    static base64encode(string, mode) {
        return Buffer.from(string, mode || 'ascii').toString('base64');
    }

}

module.exports = Crypt;