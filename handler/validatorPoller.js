import { validatorEmitter } from './validatorEmitter.js';
import validatorMainnetSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import validatorTestnetSubscriptionSchema from '../schema/trackedTestnetValidator.js';

const scheduledMainnetValidatorsSet = new Set();
const scheduledTestnetValidatorsSet = new Set();
async function initializeValidatorSets() {
  const mainnetValidators = await validatorMainnetSubscriptionSchema.find({}).lean();
  const testnetValidators = await validatorTestnetSubscriptionSchema.find({}).lean();

  mainnetValidators.forEach(v => scheduledMainnetValidatorsSet.add(v.validatorVoteAddress));
  testnetValidators.forEach(v => scheduledTestnetValidatorsSet.add(v.validatorVoteAddress));
}

initializeValidatorSets().catch(console.error);

export async function pollNewValidators(mainnetConnection, testnetConnection) {
  try {
    let validatorsMainnet = (await validatorMainnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);
    let validatorsTestnet = (await validatorTestnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);

    for (const v of validatorsMainnet) {
      if (!scheduledMainnetValidatorsSet.has(v)) {
        scheduledMainnetValidatorsSet.add(v);
        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress: v, network: 'mainnet', action: 'added' });
        console.log(`New mainnet validator detected: ${v}`);
      }
    }
    for (const v of [...scheduledMainnetValidatorsSet]) {
      if (!validatorsMainnet.includes(v)) {
        scheduledMainnetValidatorsSet.delete(v);
        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress: v, network: 'mainnet', action: 'removed' });
        console.log(`Mainnet validator removed: ${v}`);
      }
    }
    for (const v of validatorsTestnet) {
      if (!scheduledTestnetValidatorsSet.has(v)) {
        scheduledTestnetValidatorsSet.add(v);
        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress: v, network: 'testnet', action: 'added' });
        console.log(`New testnet validator detected: ${v}`);
      }
    }
    for (const v of [...scheduledTestnetValidatorsSet]) {
      if (!validatorsTestnet.includes(v)) {
        scheduledTestnetValidatorsSet.delete(v);
        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress: v, network: 'testnet', action: 'removed' });
        console.log(`Testnet validator removed: ${v}`);
      }
    }
  } catch (e) {
    console.error('Error polling validators:', e);
  }
}
