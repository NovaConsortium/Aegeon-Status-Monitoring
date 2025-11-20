import validatorMainnetSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import validatorTestnetSubscriptionSchema from '../schema/trackedTestnetValidator.js';
import { schedulerEmitNotification } from './notificationUtils.js';
import { getMainnetList, getTestnetList } from './validatorListLoader.js';

const SLOT_DURATION_MS = 400;
const NOTIFICATION_BUFFER_MS = 5000;

const scheduledTimers = new Map();
const validatorTimers = new Map();

function groupSlots(slots, chunkSize = 4) {
  const groups = [];
  for (let i = 0; i < slots.length; i += chunkSize) {
    groups.push(slots.slice(i, i + chunkSize));
  }
  return groups;
}

async function estimateSlotTimestamp(connection, baseSlot, baseTimestampMs, targetSlot) {
  const slotDiff = targetSlot - baseSlot;
  return baseTimestampMs + slotDiff * SLOT_DURATION_MS;
}

async function createSkipSlotTimeout(connection, validatorVoteAddress, group, networkLabel, discordSubscriptions, tgSubscriptions) {
  try {
    const currentSlot = await connection.getSlot('confirmed');
    const targetSlot = group[group.length - 1];
    
    if (currentSlot >= targetSlot) {
      const confirmedSlots = await connection.getBlocks(group[0], group[group.length - 1]);
      console.log(confirmedSlots, "confirmedSlots")
      const skippedSlots = group.filter(s => !confirmedSlots.includes(s));
      if (skippedSlots.length > 0) {
        await schedulerEmitNotification(validatorVoteAddress, skippedSlots, networkLabel, discordSubscriptions, tgSubscriptions);
      }
    } else {
      const currentTimeSec = await connection.getBlockTime(currentSlot);
      const currentTimestampMs = currentTimeSec * 1000;
      const newScheduleTime = await estimateSlotTimestamp(connection, currentSlot, currentTimestampMs, targetSlot) + NOTIFICATION_BUFFER_MS;
      const newDelay = Math.max(newScheduleTime - Date.now(), 0);
      
      if (newDelay > 0) {
        const newTimer = setTimeout(() => {
          createSkipSlotTimeout(connection, validatorVoteAddress, group, networkLabel, discordSubscriptions, tgSubscriptions);
        }, newDelay);
        
        if (!scheduledTimers.has(networkLabel)) {
          scheduledTimers.set(networkLabel, []);
        }
        scheduledTimers.get(networkLabel).push(newTimer);
        
        if (!validatorTimers.has(validatorVoteAddress)) {
          validatorTimers.set(validatorVoteAddress, []);
        }
        validatorTimers.get(validatorVoteAddress).push(newTimer);
      }
    }
  } catch (e) {
    console.error(`Error during skip slot check for validator ${validatorVoteAddress}:`, e);
  }
}

export async function scheduleSkipChecks(validators, connection, networkLabel) {
  console.log("Starting checking skips")
  for (const v of validators) {
    await clearScheduledTimersForValidator(v);
  }

  const currentSlot = await connection.getSlot('confirmed');
  const leaderSchedule = await connection.getLeaderSchedule();
  const currentTimeSec = await connection.getBlockTime(currentSlot);
  const currentTimestampMs = currentTimeSec * 1000;

  const trackedSchemas = {
    mainnet: validatorMainnetSubscriptionSchema,
    testnet: validatorTestnetSubscriptionSchema,
  };
  const trackedList = {
    mainnet: getMainnetList(),
    testnet: getTestnetList(),
  }
  console.log(trackedSchemas[networkLabel], networkLabel)
  const trackedData = await trackedSchemas[networkLabel].find({ validatorVoteAddress: { $in: validators } }).lean();
  for (const validatorVoteAddress of validators) {

    const assignedSlots = [];

    const epochInfo = await connection.getEpochInfo()
    const firstSlot = epochInfo.absoluteSlot - epochInfo.slotIndex;
    const validatorData = trackedList[networkLabel].find(v => v.voteId === validatorVoteAddress);
    for (const [voteAddress, slotsArr] of Object.entries(leaderSchedule)) {
      if (voteAddress === validatorData.validatorId) {
        assignedSlots.push(...slotsArr.map(slot => slot + firstSlot));
      }
    }
    assignedSlots.sort((a, b) => a - b);
    const slotGroups = groupSlots(assignedSlots);

    const validatorInfo = trackedData.find(v => v.validatorVoteAddress === validatorVoteAddress);
    const discordSubscriptions = validatorInfo?.discordSubscriptions ?? [];
    const tgSubscriptions = validatorInfo?.tgSubscriptions ?? [];

    for (const group of slotGroups) {
      const lastSlot = group[group.length - 1];
      const scheduleTime = await estimateSlotTimestamp(connection, currentSlot, currentTimestampMs, lastSlot) + NOTIFICATION_BUFFER_MS;
      const delay = Math.max(scheduleTime - Date.now(), 0);
      console.log(delay, group)
      if (delay > 0) {
        const timer = setTimeout(() => {
          createSkipSlotTimeout(connection, validatorVoteAddress, group, networkLabel, discordSubscriptions, tgSubscriptions);
        }, delay);

        if (!scheduledTimers.has(networkLabel)) {
          scheduledTimers.set(networkLabel, []);
        }
        scheduledTimers.get(networkLabel).push(timer);

        if (!validatorTimers.has(validatorVoteAddress)) {
          validatorTimers.set(validatorVoteAddress, []);
        }
        validatorTimers.get(validatorVoteAddress).push(timer);

        //console.log(`Scheduled skip check for validator ${validatorVoteAddress} on ${networkLabel} for slots ${group}`);
      }
    }
  }
}

export async function clearScheduledTimersForValidator(validatorVoteAddress) {
  const timers = validatorTimers.get(validatorVoteAddress) ?? [];
  timers.forEach(timer => clearTimeout(timer));
  validatorTimers.delete(validatorVoteAddress);

  console.log(`Cleared timers for validator ${validatorVoteAddress}`);
}

export async function clearAllScheduledTimers() {
  for (const timers of scheduledTimers.values()) {
    timers.forEach(timer => clearTimeout(timer));
  }
  scheduledTimers.clear();
  validatorTimers.clear();

  console.log('Cleared all scheduled skip check timers');
}
