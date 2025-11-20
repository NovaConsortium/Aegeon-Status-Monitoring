import telegramBot from '../telegram/index.js';
import userDataSchema from '../schema/userData.js';
import { client } from '../index.js';
import { formatMessage, getValidatorInfo } from './messageFormatter.js';
import fs from 'fs';

export async function loadSlashCommands() {
  const arrayOfSlashCommands = [];
  const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
  const loadedCommands = await Promise.all(commandFiles.map(async (value) => {
    try {
      const file = await import("../commands/" + value);
      if (!file.default?.name) return null;
      const properties = { ...file.default };
      client.slashCommands.set(file.default.name, properties);
      if (["MESSAGE", "USER"].includes(file.default.type)) {
        delete file.default.description;
        return file.default;
      }
      return file.default;
    } catch (error) {
      console.error(`Error loading command ${value}:`, error);
      return null;
    }
  }));
  arrayOfSlashCommands.push(...loadedCommands.filter(cmd => cmd !== null));
  return arrayOfSlashCommands;
}

export async function notifyUsers(discordSubscriptions, tgSubscriptions, validatorVoteAddress, context, messageData = {}) {
  const validatorInfo = getValidatorInfo(validatorVoteAddress);
  const network = validatorInfo?.network || 'mainnet';
  
  const enhancedData = {
    ...messageData,
    validatorVoteAddress,
    network,
    name: validatorInfo?.name
  };

  for (const userId of discordSubscriptions || []) {
    try {
      const userData = await userDataSchema.findOne({ userId });
      if (!userData) continue;

      // Find validator-specific notification settings
      const validatorEntry = userData.trackedValidators?.find(
        v => v.validatorVoteAddress === validatorVoteAddress && v.network === network
      );

      // Fallback to default (discordDM: true, others: false) if validator not found
      const notifications = validatorEntry?.notifications || {
        discordDM: true,
        whatsappMsg: false,
        sms: false,
        email: false,
        call: false
      };

      if (notifications.discordDM) {
        const user = await client.users.fetch(userId);
        if (user) {
          const discordMessage = formatMessage(context, enhancedData, 'discord');
          await user.send({ embeds: [discordMessage] });
        }
      }

      if (notifications.email && userData.email) {
        const emailMessage = formatMessage(context, enhancedData, 'email');

        let subject = 'Validator Status Change!';
        if (context === 'balance') {
          subject = enhancedData.isLowBalance ? '⚠️ Low Balance Alert' : '✅ Balance Restored';
        } else if (context === 'pdaBalance') {
          subject = enhancedData.isLowBalance ? '⚠️ Low PDA Balance Alert' : '✅ PDA Balance Restored';
        } else if (context === 'delinquent') {
          subject = '⚠️ Validator Delinquent';
        } else if (context === 'resolved') {
          subject = '✅ Validator Status Restored';
        } else if (context === 'skipSlots') {
          subject = '⚠️ Skip Slot Alert';
        } else if (context === 'voteCredit') {
          subject = enhancedData.hasLowCredit ? '⚠️ Low Vote Credit Alert' : '✅ Vote Credit Restored';
        }

        const mailOptions = {
          from: `"Validator Status Notifications" <${process.env.emailAddress}>`,
          to: userData.email,
          subject: subject,
          text: emailMessage,
        };

        client.emailTransporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
          } else {
            console.log('Email sent for user: ' + userId + ' context: ' + context + ' response: ' + info.response);
          }
        });
      }

      if (notifications.sms && userData.phoneNumber) {
        const smsMessage = formatMessage(context, enhancedData, 'sms');
        client.twilioClient.messages.create({
          body: smsMessage,
          to: userData.phoneNumber,
          from: '+15757544013'
        });
      }

      if (notifications.call && context === "delinquent" && userData.phoneNumber) {
        client.twilioClient.calls.create({
          url: "https://handler.twilio.com/twiml/EH58f0d706dd3e3f28178ddfabc1529261",
          to: userData.phoneNumber,
          from: '+15757544013'
        })
      }

    } catch (e) {
      console.error(`Failed to notify user ${userId} on Discord for ${validatorVoteAddress} context: ${context}`, e);
    }
  }

  for (const userId of tgSubscriptions || []) {
    try {
      const telegramMessage = formatMessage(context, enhancedData, 'telegram');
      await telegramBot.sendMessage(userId, telegramMessage, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(`Failed to notify user ${userId} on Telegram for ${validatorVoteAddress} context: ${context}`, e);
    }
  }
}

export async function schedulerEmitNotification(validatorVoteAddress, skippedSlots, networkLabel, discordSubscriptions, tgSubscriptions) {
  console.log(`Notifying skipped slots for validator: ${validatorVoteAddress}`);

  const messageData = {
    skippedSlots,
    network: networkLabel.toLowerCase()
  };

  await notifyUsers(discordSubscriptions, tgSubscriptions, validatorVoteAddress, 'skipSlots', messageData);
}