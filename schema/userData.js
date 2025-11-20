import mongoose from 'mongoose';

const userData = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ['discord', 'telegram'], required: true },
    phoneNumber: { type: String },
    email: { type: String },
    whatsappNumber: { type: String },
    balanceThreshold: { type: Number, default: 3, min: 0.1, max: 100 },
    pdaBalanceThreshold: { type: Number, default: 0.5, min: 0.05, max: 100 },
    trackedValidators: [{
        validatorVoteAddress: { type: String, required: true },
        network: { type: String, enum: ['mainnet', 'testnet'], required: true },
        notifications: {
            discordDM: { type: Boolean, default: true },
            whatsappMsg: { type: Boolean, default: false },
            sms: { type: Boolean, default: false },
            email: { type: Boolean, default: false },
            call: { type: Boolean, default: false }
        }
    }]
});

userData.index({ userId: 1 }, { unique: true });

const UserData = mongoose.model('UserData', userData);

export default UserData;