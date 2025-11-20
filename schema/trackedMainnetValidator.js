import mongoose from 'mongoose';

const trackedMainnetValidatorSchema = new mongoose.Schema({
    validatorVoteAddress: { type: String, required: true },
    lastVoteStatus: { type: Boolean, default: false },
    lastStatus: { type: String },
    lastBalanceNotification: { type: mongoose.Schema.Types.Mixed, default: {} }, 
    lastPdaBalanceNotification: { type: mongoose.Schema.Types.Mixed, default: {} },
    tgSubscriptions: { type: Array },
    discordSubscriptions: { type: Array }
});

trackedMainnetValidatorSchema.index({ validatorVoteAddress: 1 }, { unique: true });

const TrackedMainnetValidator = mongoose.model('TrackedMainnetValidator', trackedMainnetValidatorSchema);

export default TrackedMainnetValidator;