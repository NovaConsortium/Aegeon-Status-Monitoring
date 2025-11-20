import mongoose from 'mongoose';

const trackedTestnetValidatorSchema = new mongoose.Schema({
    validatorVoteAddress: { type: String, required: true },
    lastStatus: { type: String },
    tgSubscriptions: { type: Array },
    discordSubscriptions: { type: Array }
});

trackedTestnetValidatorSchema.index({ validatorVoteAddress: 1 }, { unique: true });

const TrackedTestnetValidator = mongoose.model('TrackedTestnetValidator', trackedTestnetValidatorSchema);

export default TrackedTestnetValidator;