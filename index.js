import 'dotenv/config';
import { Connection } from '@solana/web3.js';
import { Client, GatewayIntentBits } from 'discord.js';
import mongoose from 'mongoose';

import validatorMainnetSubscriptionSchema from './schema/trackedMainnetValidator.js';
import validatorTestnetSubscriptionSchema from './schema/trackedTestnetValidator.js';

import { validatorEmitter } from './handler/validatorEmitter.js';
import { loadSlashCommands, notifyUsers } from './handler/notificationUtils.js';
import { scheduleSkipChecks, clearScheduledTimersForValidator, clearAllScheduledTimers } from './handler/skipSlotScheduler.js';
import { pollEpochChange } from './handler/epochPoller.js';
import { pollNewValidators } from './handler/validatorPoller.js';
import { trackValidatorsVoteCredits } from './handler/voteCreditTracker.js';
import { trackValidatorBalances } from './handler/validatorBalanceTracker.js';
import { checkPdaBalance } from './handler/pdaBalanceChecker.js';
import { loadValidatorLists } from './handler/validatorListLoader.js';
import interactionCreateHandler from './events/interactionCreate.js';
import nodemailer from 'nodemailer';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
client.slashCommands = new Map();

const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com', //namecheap
  port: 587,
  secure: false,
  auth: {
    user: process.env.emailAddress,
    pass: process.env.emailPassword,
  },
});
import twilio from 'twilio';
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

client.emailTransporter = transporter;
client.twilioClient = twilioClient;
const mainnetConnection = new Connection(process.env.mainnetRpcUrl, 'confirmed');
const testnetConnection = new Connection(process.env.testnetRpcUrl, 'confirmed');

// Delinquent check

async function processStatusChangeNotify(schema, allAccounts, currentList, networkLabel) {
  const validators = await schema.find({}).lean();

  for (const entry of validators) {
    const { validatorVoteAddress, tgSubscriptions, discordSubscriptions, lastStatus } = entry;

    const validatorAccount = allAccounts.find(acc => acc.votePubkey === validatorVoteAddress);
    if (!validatorAccount) continue;

    const currentStatus = currentList.some(acc => acc.votePubkey === validatorVoteAddress)
      ? 'current'
      : 'delinquent';

    if (lastStatus === 'current' && currentStatus === 'delinquent') {
      const messageData = {
        status: 'delinquent',
        network: networkLabel.toLowerCase()
      };
      await notifyUsers(discordSubscriptions, tgSubscriptions, validatorVoteAddress, 'delinquent', messageData);
    } else if (lastStatus === 'delinquent' && currentStatus === 'current') {
      const messageData = {
        status: 'current',
        network: networkLabel.toLowerCase()
      };
      await notifyUsers(discordSubscriptions, tgSubscriptions, validatorVoteAddress, 'resolved', messageData);
    }

    if (lastStatus !== currentStatus) {
      await schema.updateOne({ validatorVoteAddress }, { $set: { lastStatus: currentStatus } });
    }
  }
}

async function monitorDelinquency() {
  try {
    const mainStatus = await mainnetConnection.getVoteAccounts();
    const testStatus = await testnetConnection.getVoteAccounts();

    await processStatusChangeNotify(
      validatorMainnetSubscriptionSchema,
      [...mainStatus.current, ...mainStatus.delinquent], mainStatus.current, 'mainnet',
    );
    await processStatusChangeNotify(
      validatorTestnetSubscriptionSchema,
      [...testStatus.current, ...testStatus.delinquent], testStatus.current, 'testnet',
    );
  } catch (e) {
    console.error('Error monitoring delinquency:', e);
  }
}

async function main() {

  mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
  });
  await client.login(process.env.discordToken);

  client.on('clientReady', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    await mongoose.connect(process.env.MONGO_URI);

    const slashCommands = await loadSlashCommands();
    await client.application.commands.set(slashCommands);
    client.guilds.cache.get("1322679317787971625").commands.set([]);
    interactionCreateHandler(client);

    client.user.setPresence({ activities: [{ name: 'with Validators' }], status: 'idle' });

    pollEpochChange(mainnetConnection, testnetConnection);

    validatorEmitter.on('epochChange', async () => {
      console.log('Epoch changed - resetting skip schedule.');

      await loadValidatorLists();
      await clearAllScheduledTimers();
      const mainnetValidators = (await validatorMainnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);
      const testnetValidators = (await validatorTestnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);
      await scheduleSkipChecks(mainnetValidators, mainnetConnection, 'mainnet');
      await scheduleSkipChecks(testnetValidators, testnetConnection, 'testnet');
    });

    validatorEmitter.on('validatorStateChanged', async ({ validatorVoteAddress, network, action }) => {
      console.log(`Validator ${validatorVoteAddress} ${action} on ${network}`);
      if (action === 'removed') {
        await clearScheduledTimersForValidator(validatorVoteAddress);
      } else if (action === 'added') {
        const connection = network === 'Mainnet' ? mainnetConnection : testnetConnection;
        await clearScheduledTimersForValidator(validatorVoteAddress);
        await scheduleSkipChecks([validatorVoteAddress], connection, network.toLowerCase());
      }
    });

    const mainnetValidators = (await validatorMainnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);
    const testnetValidators = (await validatorTestnetSubscriptionSchema.find({}).lean()).map(v => v.validatorVoteAddress);
    await scheduleSkipChecks(mainnetValidators, mainnetConnection, 'mainnet');
    await scheduleSkipChecks(testnetValidators, testnetConnection, 'testnet');

    setInterval(pollNewValidators.bind(null, mainnetConnection, testnetConnection), 5 * 60 * 1000);
    setInterval(trackValidatorsVoteCredits, 2 * 60 * 1000);
    setInterval(monitorDelinquency, 10 * 1000);
    setInterval(trackValidatorBalances.bind(null, mainnetConnection), 10 * 60 * 1000);
    setInterval(checkPdaBalance.bind(null, mainnetConnection), 30 * 60 * 1000);
  });

  client.on('error', console.error);
  client.on('shardError', error => console.error('WebSocket shard error:', error));
}

main().catch(console.error);