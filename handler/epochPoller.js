import { validatorEmitter } from './validatorEmitter.js';

export let currentEpoch = {
  mainnet: null,
  testnet: null,
};

export async function pollEpochChange(mainnetConnection, testnetConnection) {
  const mainnetEpoch = await mainnetConnection.getEpochInfo().then(info => info.epoch);
  const testnetEpoch = await testnetConnection.getEpochInfo().then(info => info.epoch);
  currentEpoch = { mainnet: mainnetEpoch, testnet: testnetEpoch };

  setInterval(async () => {
    try {
      const mainnetEpoch = await mainnetConnection.getEpochInfo().then(info => info.epoch);
      const testnetEpoch = await testnetConnection.getEpochInfo().then(info => info.epoch);

      if (currentEpoch.mainnet === null || currentEpoch.testnet === null) {
        currentEpoch = { mainnet: mainnetEpoch, testnet: testnetEpoch };
        return;
      }

      if (currentEpoch.mainnet !== mainnetEpoch) {
        currentEpoch.mainnet = mainnetEpoch;
        console.log(`Mainnet epoch changed to ${mainnetEpoch}`);
        validatorEmitter.emit('epochChange');
      }

      if (currentEpoch.testnet !== testnetEpoch) {
        currentEpoch.testnet = testnetEpoch;
        console.log(`Testnet epoch changed to ${testnetEpoch}`);
        validatorEmitter.emit('epochChange');
      }
    } catch (e) {
      console.error('Error polling epoch:', e);
    }
  }, 5 * 60 * 1000); 
}
