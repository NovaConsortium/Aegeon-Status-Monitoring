import fs from 'fs';

let mainnetList = [];
let testnetList = [];

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed reading validator list ${filePath}:`, e);
    return [];
  }
}

export async function loadValidatorLists() {

    const mainnetValidatorList = await fetch(`https://api.thevalidators.io/validators/list?network=mainnet&select=voteId,validatorId,totalStake,iconUrl,name,nodeVersion,details,network`).then(res => res.json());
    const testnetValidatorList = await fetch(`https://api.thevalidators.io/validators/list?network=testnet&select=voteId,validatorId,totalStake,iconUrl,name,nodeVersion,details,network`).then(res => res.json());

    mainnetList = mainnetValidatorList.data;
    testnetList = testnetValidatorList.data;
}

export function getMainnetList() {
  return mainnetList;
}

export function getTestnetList() {
  return testnetList;
}

export function findValidatorInfoByVote(voteId) {
  if (!voteId) return null;
  const m = mainnetList.find(v => v.voteId === voteId);
  if (m) return { ...m, network: 'mainnet' };
  const t = testnetList.find(v => v.voteId === voteId);
  if (t) return { ...t, network: 'testnet' };
  return null;
}

loadValidatorLists();