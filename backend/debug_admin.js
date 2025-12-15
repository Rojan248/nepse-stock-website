const admin = require('firebase-admin');

// Hardcoded from user input
const serviceAccount = {
    projectId: "nepse-stock-website",
    clientEmail: "firebase-adminsdk-fbsvc@nepse-stock-website.iam.gserviceaccount.com",
    // Using the string exactly as in the JSON
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCapDPLH+fq4lvI\nYVx1pURiF02SNA0lDoskMZV3F2bvsaB6pogiLzpp70puTWwyIYCb71CRYRnri6zH\nwdVedq9k0jlae1pY+e3/qRhp/XgyyK1aMpg5/qLQPRDO3nMb0IdLhMB2JtkW+DA9\nZgEAVAEK2AvcW7TV6sGxAHBeHlO6ULHnubU7y78zQC+N1ARo/Wi+cFkscdmQJkCa\npsCxMrAIVKIfEBqwFd97C8SckDeF8nY4PcqC/21dcmt0Inpm/1WHtEhF54RvHvkV\ndfACyXZ4LHVDhimok6EClovuBpNFBW/UgJeOjwkUEfemloE6vAL3tAH/MQmwHjKz\nvJOM6ybHAgMBAAECggEAA3rJD5EFjut4/+abm1S/V9Wzu851XULD2Wn5iwHOdyZF\nY30hIw5yVLU7CjBZIZJPaogqr/AXZ+LEsy9RYHFwkObfaNcjDqLRECel56dPGmrE\nO9Cs9uEb7hjxqotRhmwIH1LlYcM4r05LskCmqnM5csevEfjzoLyfjx62Ez1rdOMY\nUuVrmmNoHpkGI2L4FSr5ADFZxBD6lbe9uZ/KDBsyclkQ9dhNmb5kT/yvN8vl/Bvb\ngf6xwxomgc+j1LP7Sg2zDEnqWoQKBFO+yri8se9Il6F2hLD68PRJcNUG9X5FqvWG\nX2tl3UFQuiSTv6mxtl8IhJHgLuFLCs2SBrb5N3K2wQKBgQDNiIKyd93397EHkhr/\nIj/wLto6kILJpDPHxyiO4iub1i2uWuUoGfMMilvdFeHP2s98o3SYGBTW3vWOBOtK\nWqKSO60++Sk/tI6En9oo20mhhWDvrUnfe/nWgTY88OEyxjjjHF/cm3ivJOv6ybPZ\nMqxLWK7VTnsiOaX+bzGBdzIvlQKBgQDAnLaTsgvlcCJ4sXY4LL+j/Vr8zP2lrJXA\nV9v+rFLJoKU4eAcqtWKVMGX5Q/D9MYd/RxgrKW1RSvYZUwJqQW139Q+a0PUIe/6N\nuUcpwePZTaKkdergwN9HEhN/nzBmwzik2+3RDorlmflzGYKXWsvcB7CPKb3nNvEd\nxCNi6JlV6wKBgHHfjjn++3YlP2noYxi0CySxcKs94ZiCZ0Xqa+guGucuVQTiy0/a\ngLST+62UMBYPLyHpFfImdXVO9lGHHC2H5caLVcMsHNR03vlP73jvde4NjdV89w7h\nC1zzHe/JrZuKA36g++OoJ8cx96RtGD3gO2FLcyIvZz1hHzzGsnD+b0m5AoGALQW0\nq6tnmnbup9Wbc6AKH7P+C6+C7rH7wx0GYG45X8X8OMndqv8BDyxj+bMG5rgoGvks\nThJ96g2inuLHYrzucKbIwgBr9lK9erU/TCR1NPsvtE+X2nda+YrhIei88JhbajW6\nTi6fCvJF28CvxN9FXaYygBRavmwaSkHpn5oNFYcCgYAtabopR5OaqnZpBqepnWjS\ntt/V5d3YM0poFALPa6qqAmIRHpkvbNtKl52HxjAuVxfgdfm05DYiGJMY7LOwzhPj\nFrx4lgC0wWaDIwjAw4P3ZOUBc18lai0mCHrQfaJixCjvzC0tORjwTaO4+5b2C4cO\nSO1oYiXaotKxbGS9IsDMxw==\n-----END PRIVATE KEY-----\n"
};

console.log('Project ID:', serviceAccount.projectId);
console.log('Client Email:', serviceAccount.clientEmail);
console.log('Private Key Length (original):', serviceAccount.privateKey.length);

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized');
} catch (e) {
    console.error('Init failed:', e);
}

const db = admin.firestore();

async function testRead() {
    try {
        console.log('Attempting to read marketSummary/current...');
        const docRef = db.collection('marketSummary').doc('current');
        const doc = await docRef.get();

        if (doc.exists) {
            console.log('Document found:', doc.data());
        } else {
            console.log('Document NOT found!');
        }
    } catch (error) {
        console.error('Read failed:', error);
    }
}

testRead();
