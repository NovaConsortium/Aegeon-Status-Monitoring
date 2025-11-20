import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import mainnetValidatorSchema from '../schema/trackedMainnetValidator.js';
import testnetValidatorSchema from '../schema/trackedTestnetValidator.js';
import userDataSchema from '../schema/userData.js';
import { getMainnetList, getTestnetList } from '../handler/validatorListLoader.js';
const waitingForAddValidator = new Set();
const waitingForRemoveValidator = new Set();
const waitingForSetThreshold = new Set();
if(!process.env.telegramToken) console.error('Telegram token is not set');

const bot = new TelegramBot(process.env.telegramToken, {
    polling: true
});

function isValidValidator(voteId) {
    const mainnetList = getMainnetList();
    const testnetList = getTestnetList();
    if (mainnetList.some(v => v.voteId === voteId)) return {
        type: "Mainnet",
        info: mainnetList.find(v => v.voteId === voteId)
    };
    if (testnetList.some(v => v.voteId === voteId)) return {
        type: "Testnet",
        info: testnetList.find(v => v.voteId === voteId)
    };
    return false;
}
const shortenAddress = (address, chars = 6) => {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const keyboardOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟩 Add Validator', callback_data: 'add_validator' }, { text: '🟥 Remove Validator', callback_data: 'remove_validator' }],
                [{ text: '⚙️ Set Balance Threshold', callback_data: 'set_threshold' }],
            ]
        }
    };

    const mainnetValidators = await mainnetValidatorSchema.find({ 'tgSubscriptions.userId': chatId });
    const testnetValidators = await testnetValidatorSchema.find({ 'tgSubscriptions.userId': chatId });

    let mainnetList = mainnetValidators.map(v => `- ${v.validatorVoteAddress}`).join('\n') || 'No mainnet validators tracked.';
    let testnetList = testnetValidators.map(v => `- ${v.validatorVoteAddress}`).join('\n') || 'No testnet validators tracked.';

    const message = `*Tracked Solana Validators:*\n\n*Mainnet:*\n${mainnetList}\n\n*Testnet:*\n${testnetList}`;

    bot.sendMessage(chatId, message, { ...keyboardOptions, parse_mode: 'Markdown' });
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;

    if (data === 'add_validator') {
        if (waitingForRemoveValidator.has(userId)) waitingForRemoveValidator.delete(userId);
        if (waitingForAddValidator.has(userId)) waitingForAddValidator.delete(userId);
        bot.sendMessage(chatId, 'Please send the validator vote address to add.');
        waitingForAddValidator.add(userId);
    }

    if (data === 'remove_validator') {
        if (waitingForAddValidator.has(userId)) waitingForAddValidator.delete(userId);
        if (waitingForRemoveValidator.has(userId)) waitingForRemoveValidator.delete(userId);
        if (waitingForSetThreshold.has(userId)) waitingForSetThreshold.delete(userId);
        bot.sendMessage(chatId, 'Please send the validator vote address to remove.');
        waitingForRemoveValidator.add(userId);
    }

    if (data === 'set_threshold') {
        if (waitingForAddValidator.has(userId)) waitingForAddValidator.delete(userId);
        if (waitingForRemoveValidator.has(userId)) waitingForRemoveValidator.delete(userId);
        if (waitingForSetThreshold.has(userId)) waitingForSetThreshold.delete(userId);
        bot.sendMessage(chatId, 'Please send your desired balance threshold in SOL (0.1 - 100).\n\nExample: 2.5');
        waitingForSetThreshold.add(userId);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', async (msg) => {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const text = msg.text;

    if (waitingForAddValidator.has(userId)) {
        waitingForAddValidator.delete(userId);
        const check = isValidValidator(text);
        if (!check) return bot.sendMessage(chatId, 'Invalid validator vote address. Please try again with a valid one.');

        const Schema = check.type === "Mainnet" ? mainnetValidatorSchema : testnetValidatorSchema;
        let subscription = await Schema.findOne({ validatorVoteAddress: text });
        if (subscription) {
            if (subscription.tgSubscriptions.some(sub => sub === userId)) {
                return bot.sendMessage(chatId, `*You Have Already Subscribed To This Validator.*`, { parse_mode: 'Markdown' });
            }
            subscription.tgSubscriptions.push(userId);
        } else {
            subscription = new Schema({
                validatorVoteAddress: check.info.voteId,
                tgSubscriptions: [userId]
            });
        }

        await subscription.save();

        const displayName = check.info.name && check.info.name.trim().length > 0
            ? check.info.name
            : shortenAddress(check.info.voteId);
        const solscanUrl = `https://solscan.io/account/${text}${check.type === "Mainnet" ? "" : "?cluster=testnet"}`;

        bot.sendMessage(chatId, `🟢 Now Tracking [${displayName}](${solscanUrl}) on ${check.type}`, { parse_mode: 'Markdown', disable_web_page_preview: true });

    } else if (waitingForSetThreshold.has(userId)) {
        waitingForSetThreshold.delete(userId);
        
        const threshold = parseFloat(text);
        if (isNaN(threshold) || threshold < 0.1 || threshold > 100) {
            return bot.sendMessage(chatId, 'Invalid threshold! Please enter a number between 0.1 and 100 SOL.');
        }

        let userData = await userDataSchema.findOne({ userId });
        if (!userData) {
            userData = new userDataSchema({
                userId,
                type: "telegram"
            });
        }

        const oldThreshold = userData.balanceThreshold;
        userData.balanceThreshold = threshold;
        await userData.save();

        bot.sendMessage(chatId, `✅ Balance threshold updated!\n\nPrevious: ${oldThreshold} SOL\nNew: ${threshold} SOL\n\nYou will now receive balance alerts when any of your tracked validators fall below ${threshold} SOL.`);

    } else if (waitingForRemoveValidator.has(userId)) {
        waitingForRemoveValidator.delete(userId);

        const check = isValidValidator(text);
        if (!check) return bot.sendMessage(chatId, 'Invalid validator vote address. Please try again with a valid one.');

        const displayName = check.info.name && check.info.name.trim().length > 0
            ? check.info.name
            : shortenAddress(check.info.voteId);
        const solscanUrl = `https://solscan.io/account/${text}${check.type === "Mainnet" ? "" : "?cluster=testnet"}`;

        const Schema = check.type === "Mainnet" ? mainnetValidatorSchema : testnetValidatorSchema;
        let subscription = await Schema.findOne({ validatorVoteAddress: text });
        if (subscription) {
            if (!subscription.tgSubscriptions.some(sub => sub === userId)) {
                return bot.sendMessage(chatId, `*You Are Not Subscribed To This Validator.*`, { parse_mode: 'Markdown' });
            }
            subscription.tgSubscriptions = subscription.tgSubscriptions.filter(sub => sub !== userId);
        }

        await subscription.save();

        bot.sendMessage(chatId, `Successfully removed [${displayName}](${solscanUrl}) from your tracked validators.`, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

export default bot;