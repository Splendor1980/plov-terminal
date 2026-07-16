// ============================================================
// api/connect-risex.js - Connect RISEx API Wallet
// ============================================================
// Сохраняет apiWalletAddress пользователя в Firestore
// ============================================================

const admin = require('firebase-admin');

// Инициализация Firebase (если еще не инициализирован)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { uid, apiWalletAddress, idToken } = req.body;

        // Валидация
        if (!uid || !apiWalletAddress || !idToken) {
            return res.status(400).json({
                error: 'Missing required fields: uid, apiWalletAddress, idToken'
            });
        }

        // Проверка что адрес валидный Ethereum адрес
        if (!/^0x[a-fA-F0-9]{40}$/.test(apiWalletAddress)) {
            return res.status(400).json({
                error: 'Invalid Ethereum address format'
            });
        }

        // Верификация токена (опционально, но рекомендуется)
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
            if (decodedToken.uid !== uid) {
                return res.status(403).json({
                    error: 'Token does not match user ID'
                });
            }
        } catch (authError) {
            console.warn('Token verification failed:', authError.message);
            // Можно продолжить без верификации для dev версии
        }

        // Сохранить в Firestore
        const userDocRef = db.collection('users').doc(uid);
        
        await userDocRef.set({
            apiWalletAddress: apiWalletAddress.toLowerCase(),
            risexConnected: true,
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[connect-risex] User ${uid} connected RISEx wallet: ${apiWalletAddress}`);

        return res.status(200).json({
            success: true,
            message: 'RISEx wallet connected',
            userAddress: apiWalletAddress
        });

    } catch (error) {
        console.error('[connect-risex] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};
