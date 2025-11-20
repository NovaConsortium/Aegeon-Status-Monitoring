import { EmbedBuilder } from 'discord.js';
import { findValidatorInfoByVote } from './validatorListLoader.js';

const COLORS = {
    ALERT: 0xFF4444,      // Red for alerts
    SUCCESS: 0x00FF44,    // Green for resolved/good status
    INFO: 0x4488FF,       // Blue for informational
    WARNING: 0xFF8800     // Orange for warnings
};

/**
 * Creates a Solscan URL for a validator
 * @param {string} validatorVoteAddress - The validator vote address
 * @param {string} network - Network type ('mainnet' or 'testnet')
 * @returns {string} Solscan URL
 */
function getSolscanUrl(validatorVoteAddress, network) {
    const baseUrl = 'https://solscan.io/account/';
    const cluster = network === 'testnet' ? '?cluster=testnet' : '';
    return `${baseUrl}${validatorVoteAddress}${cluster}`;
}

/**
 * Creates Unix timestamp for Discord embeds
 * @returns {number} Current Unix timestamp
 */
function getUnixTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Formats validator address for display
 * @param {string} address - Full validator address
 * @returns {string} Shortened address
 */
function shortenAddress(address, chars = 8) {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Creates Discord embed for balance notifications
 * @param {Object} data - Notification data
 * @returns {EmbedBuilder} Discord embed
 */
function createBalanceDiscordEmbed(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const timestamp = getUnixTimestamp();
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    
    const embed = new EmbedBuilder()
        .setTitle(isLowBalance ? '⚠️ Low Balance Alert' : '✅ Balance Restored')
        .setColor(isLowBalance ? COLORS.ALERT : COLORS.SUCCESS)
        .setTimestamp()
        .addFields(
            {
                name: 'Validator Address',
                value: `[${shortAddress}](${solscanUrl})`,
                inline: true
            },
            {
                name: 'Network',
                value: network.charAt(0).toUpperCase() + network.slice(1),
                inline: true
            },
            {
                name: 'Current Balance',
                value: `${balanceInSOL.toFixed(4)} SOL`,
                inline: true
            },
            {
                name: 'Your Threshold',
                value: `${threshold} SOL`,
                inline: true
            },
            {
                name: 'Status',
                value: isLowBalance ? 'Below Threshold' : 'Above Threshold',
                inline: true
            },
            {
                name: 'Timestamp',
                value: `<t:${timestamp}:F>`,
                inline: true
            }
        );

    if (isLowBalance) {
        embed.setDescription(`Your tracked validator has fallen below your configured threshold of **${threshold} SOL**.`);
    } else {
        embed.setDescription(`Your tracked validator has recovered above your configured threshold of **${threshold} SOL**.`);
    }

    return embed;
}

/**
 * Creates Telegram text for balance notifications
 * @param {Object} data - Notification data
 * @returns {string} Telegram message
 */
function createBalanceTelegramMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toISOString();
    
    const emoji = isLowBalance ? '⚠️' : '✅';
    const status = isLowBalance ? 'LOW BALANCE ALERT' : 'BALANCE RESTORED';
    
    return `${emoji} **${status}**

**Validator:** [${shortAddress}](${solscanUrl})
**Network:** ${network.charAt(0).toUpperCase() + network.slice(1)}
**Current Balance:** ${balanceInSOL.toFixed(4)} SOL
**Your Threshold:** ${threshold} SOL
**Status:** ${isLowBalance ? 'Below Threshold' : 'Above Threshold'}
**Timestamp:** ${timestamp}

${isLowBalance 
    ? `Your tracked validator has fallen below your configured threshold of **${threshold} SOL**.` 
    : `Your tracked validator has recovered above your configured threshold of **${threshold} SOL**.`
}`;
}

/**
 * Creates Discord embed for PDA balance notifications
 * @param {Object} data - Notification data
 * @returns {EmbedBuilder} Discord embed
 */
function createPdaBalanceDiscordEmbed(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network, pdaAddress } = data;
    const timestamp = getUnixTimestamp();
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    
    const embed = new EmbedBuilder()
        .setTitle(isLowBalance ? '⚠️ Low PDA Balance Alert' : '✅ PDA Balance Restored')
        .setColor(isLowBalance ? COLORS.ALERT : COLORS.SUCCESS)
        .setTimestamp()
        .setFooter({ text: `Timestamp: <t:${timestamp}:F>` })
        .addFields(
            {
                name: 'Validator Address',
                value: `[${shortAddress}](${solscanUrl})`,
                inline: true
            },
            {
                name: 'PDA Address',
                value: pdaAddress,
                inline: true
            },
            {
                name: 'Current PDA Balance',
                value: `${balanceInSOL.toFixed(4)} SOL`,
                inline: true
            },
            {
                name: 'Your Threshold',
                value: `${threshold} SOL`,
                inline: true
            },
            {
                name: 'Status',
                value: isLowBalance ? 'Below Threshold' : 'Above Threshold',
                inline: true
            },
            {
                name: 'Timestamp',
                value: `<t:${timestamp}:F>`,
                inline: true
            }
        );

    if (isLowBalance) {
        embed.setDescription(`Your tracked validator's DoubleZero PDA balance has fallen below your configured threshold of **${threshold} SOL**.`);
    } else {
        embed.setDescription(`Your tracked validator's DoubleZero PDA balance has recovered above your configured threshold of **${threshold} SOL**.`);
    }

    return embed;
}

/**
 * Creates Telegram text for PDA balance notifications
 * @param {Object} data - Notification data
 * @returns {string} Telegram message
 */
function createPdaBalanceTelegramMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toISOString();
    
    const emoji = isLowBalance ? '⚠️' : '✅';
    const status = isLowBalance ? 'LOW PDA BALANCE ALERT' : 'PDA BALANCE RESTORED';
    
    return `${emoji} **${status}**

**Validator:** [${shortAddress}](${solscanUrl})
**Network:** ${network.charAt(0).toUpperCase() + network.slice(1)}
**Current PDA Balance:** ${balanceInSOL.toFixed(4)} SOL
**Your Threshold:** ${threshold} SOL
**Status:** ${isLowBalance ? 'Below Threshold' : 'Above Threshold'}
**Timestamp:** ${timestamp}

${isLowBalance 
    ? `Your tracked validator's PDA (Program Derived Address) balance has fallen below your configured threshold of **${threshold} SOL**.` 
    : `Your tracked validator's PDA (Program Derived Address) balance has recovered above your configured threshold of **${threshold} SOL**.`
}`;
}

/**
 * Creates Discord embed for voting status notifications
 * @param {Object} data - Notification data
 * @returns {EmbedBuilder} Discord embed
 */
function createVotingStatusDiscordEmbed(data) {
    const { validatorVoteAddress, status, network, name } = data;
    const timestamp = getUnixTimestamp();
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    
    const isDelinquent = status === 'delinquent';
    
    const embed = new EmbedBuilder()
        .setTitle(isDelinquent ? `⚠️ ${network.charAt(0).toUpperCase() + network.slice(1)} Validator Delinquent` : `✅ ${network.charAt(0).toUpperCase() + network.slice(1)} Validator Voting`)
        .setColor(isDelinquent ? COLORS.ALERT : COLORS.SUCCESS)
        .setTimestamp()
        .addFields(
            {
                name: 'Validator',
                value: `${name} [${shortAddress}](${solscanUrl})`,
                inline: true
            },
            {
                name: 'Network',
                value: network.charAt(0).toUpperCase() + network.slice(1),
                inline: true
            },
            {
                name: 'Status',
                value: isDelinquent ? 'Delinquent (Not Voting)' : 'Current (Voting)',
                inline: true
            },
            {
                name: 'Timestamp',
                value: `<t:${timestamp}:F>`,
                inline: true
            }
        );

    if (isDelinquent) {
        embed.setDescription(`Your tracked validator has stopped voting and is now **delinquent**.`);
    } else {
        embed.setDescription(`Your tracked validator has resumed voting and is now **current**.`);
    }

    return embed;
}

/**
 * Creates Telegram text for voting status notifications
 * @param {Object} data - Notification data
 * @returns {string} Telegram message
 */
function createVotingStatusTelegramMessage(data) {
    const { validatorVoteAddress, status, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toISOString();
    
    const isDelinquent = status === 'delinquent';
    const emoji = isDelinquent ? '⚠️' : '✅';
    const statusText = isDelinquent ? 'DELINQUENT' : 'VOTING';
    
    return `${emoji} **${statusText} STATUS CHANGE**

**Validator:** [${shortAddress}](${solscanUrl})
**Network:** ${network.charAt(0).toUpperCase() + network.slice(1)}
**Status:** ${isDelinquent ? 'Delinquent (Not Voting)' : 'Current (Voting)'}
**Timestamp:** ${timestamp}

${isDelinquent 
    ? `Your tracked validator has stopped voting and is now **delinquent**.` 
    : `Your tracked validator has resumed voting and is now **current**.`
}`;
}

/**
 * Creates Discord embed for skip slot notifications
 * @param {Object} data - Notification data
 * @returns {EmbedBuilder} Discord embed
 */
function createSkipSlotDiscordEmbed(data) {
    const { validatorVoteAddress, skippedSlots, network } = data;
    const timestamp = getUnixTimestamp();
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const slotsText = skippedSlots.map(s => `Slot ${s}`).join(', ');
    
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Skip Slot Alert')
        .setColor(COLORS.WARNING)
        .setTimestamp()
        .addFields(
            {
                name: 'Validator Address',
                value: `[${shortAddress}](${solscanUrl})`,
                inline: true
            },
            {
                name: 'Network',
                value: network.charAt(0).toUpperCase() + network.slice(1),
                inline: true
            },
            {
                name: 'Skipped Slots',
                value: slotsText,
                inline: false
            },
            {
                name: 'Timestamp',
                value: `<t:${timestamp}:F>`,
                inline: true
            }
        )
        .setDescription(`Your tracked validator has skipped ${skippedSlots.length} leader slot(s).`);

    return embed;
}

/**
 * Creates Telegram text for skip slot notifications
 * @param {Object} data - Notification data
 * @returns {string} Telegram message
 */
function createSkipSlotTelegramMessage(data) {
    const { validatorVoteAddress, skippedSlots, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toISOString();
    const slotsText = skippedSlots.map(s => `Slot ${s}`).join(', ');
    
    return `⚠️ **SKIP SLOT ALERT**

**Validator:** [${shortAddress}](${solscanUrl})
**Network:** ${network.charAt(0).toUpperCase() + network.slice(1)}
**Skipped Slots:** ${slotsText}
**Timestamp:** ${timestamp}

Your tracked validator has skipped ${skippedSlots.length} leader slot(s).`;
}

/**
 * Creates Discord embed for vote credit notifications
 * @param {Object} data - Notification data
 * @returns {EmbedBuilder} Discord embed
 */
function createVoteCreditDiscordEmbed(data) {
    const { validatorVoteAddress, hasLowCredit, network } = data;
    const timestamp = getUnixTimestamp();
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    
    const embed = new EmbedBuilder()
        .setTitle(hasLowCredit ? '⚠️ Low Vote Credit Alert' : '✅ Vote Credit Restored')
        .setColor(hasLowCredit ? COLORS.ALERT : COLORS.SUCCESS)
        .setTimestamp()
        .addFields(
            {
                name: 'Validator Address',
                value: `[${shortAddress}](${solscanUrl})`,
                inline: true
            },
            {
                name: 'Network',
                value: network.charAt(0).toUpperCase() + network.slice(1),
                inline: true
            },
            {
                name: 'Status',
                value: hasLowCredit ? 'Low Vote Credit' : 'Normal Vote Credit',
                inline: true
            },
            {
                name: 'Timestamp',
                value: `<t:${timestamp}:F>`,
                inline: true
            }
        );

    if (hasLowCredit) {
        embed.setDescription(`Your tracked validator has low vote credits (all last 200 votes below 16).`);
    } else {
        embed.setDescription(`Your tracked validator has recovered to normal vote credits.`);
    }

    return embed;
}

/**
 * Creates Telegram text for vote credit notifications
 * @param {Object} data - Notification data
 * @returns {string} Telegram message
 */
function createVoteCreditTelegramMessage(data) {
    const { validatorVoteAddress, hasLowCredit, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toISOString();
    
    const emoji = hasLowCredit ? '⚠️' : '✅';
    const status = hasLowCredit ? 'LOW VOTE CREDIT ALERT' : 'VOTE CREDIT RESTORED';
    
    return `${emoji} **${status}**

**Validator:** [${shortAddress}](${solscanUrl})
**Network:** ${network.charAt(0).toUpperCase() + network.slice(1)}
**Status:** ${hasLowCredit ? 'Low Vote Credit' : 'Normal Vote Credit'}
**Timestamp:** ${timestamp}

${hasLowCredit 
    ? `Your tracked validator has low vote credits (all last 200 votes below 16).` 
    : `Your tracked validator has recovered to normal vote credits.`
}`;
}

/**
 * Creates email text for balance notifications
 * @param {Object} data - Notification data
 * @returns {string} Email message
 */
function createBalanceEmailMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toLocaleString();
    
    const status = isLowBalance ? 'LOW BALANCE ALERT' : 'BALANCE RESTORED';
    const emoji = isLowBalance ? '⚠️' : '✅';
    
    return `${emoji} ${status}

Validator: ${shortAddress} (${validatorVoteAddress})
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
Current Balance: ${balanceInSOL.toFixed(4)} SOL
Your Threshold: ${threshold} SOL
Status: ${isLowBalance ? 'Below Threshold' : 'Above Threshold'}
Timestamp: ${timestamp}

Solscan Link: ${solscanUrl}

${isLowBalance 
    ? `Your tracked validator has fallen below your configured threshold of ${threshold} SOL.` 
    : `Your tracked validator has recovered above your configured threshold of ${threshold} SOL.`
}

---
Validator Status Notifications
This is an automated message. Please do not reply to this email.`;
}

/**
 * Creates email text for PDA balance notifications
 * @param {Object} data - Notification data
 * @returns {string} Email message
 */
function createPdaBalanceEmailMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network, pdaAddress } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toLocaleString();
    
    const status = isLowBalance ? 'LOW PDA BALANCE ALERT' : 'PDA BALANCE RESTORED';
    const emoji = isLowBalance ? '⚠️' : '✅';
    
    return `${emoji} ${status}

Validator: ${shortAddress} (${validatorVoteAddress})
PDA Address: ${pdaAddress}
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
Current PDA Balance: ${balanceInSOL.toFixed(4)} SOL
Your Threshold: ${threshold} SOL
Status: ${isLowBalance ? 'Below Threshold' : 'Above Threshold'}
Timestamp: ${timestamp}

Solscan Link: ${solscanUrl}

${isLowBalance 
    ? `Your tracked validator's DoubleZero PDA balance has fallen below your configured threshold of ${threshold} SOL.` 
    : `Your tracked validator's DoubleZero PDA balance has recovered above your configured threshold of ${threshold} SOL.`
}

---
Validator Status Notifications
This is an automated message. Please do not reply to this email.`;
}

/**
 * Creates email text for voting status notifications
 * @param {Object} data - Notification data
 * @returns {string} Email message
 */
function createVotingStatusEmailMessage(data) {
    const { validatorVoteAddress, status, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toLocaleString();
    
    const isDelinquent = status === 'delinquent';
    const emoji = isDelinquent ? '⚠️' : '✅';
    const statusText = isDelinquent ? 'DELINQUENT STATUS' : 'VOTING RESTORED';
    
    return `${emoji} ${statusText}

Validator: ${shortAddress} (${validatorVoteAddress})
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
Status: ${isDelinquent ? 'Delinquent (Not Voting)' : 'Current (Voting)'}
Timestamp: ${timestamp}

Solscan Link: ${solscanUrl}

${isDelinquent 
    ? `Your tracked validator has stopped voting and is now delinquent.` 
    : `Your tracked validator has resumed voting and is now current.`
}

---
Validator Status Notifications
This is an automated message. Please do not reply to this email.`;
}

/**
 * Creates email text for skip slot notifications
 * @param {Object} data - Notification data
 * @returns {string} Email message
 */
function createSkipSlotEmailMessage(data) {
    const { validatorVoteAddress, skippedSlots, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toLocaleString();
    const slotsText = skippedSlots.map(s => `Slot ${s}`).join(', ');
    
    return `⚠️ SKIP SLOT ALERT

Validator: ${shortAddress} (${validatorVoteAddress})
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
Skipped Slots: ${slotsText}
Timestamp: ${timestamp}

Solscan Link: ${solscanUrl}

Your tracked validator has skipped ${skippedSlots.length} leader slot(s).

---
Validator Status Notifications
This is an automated message. Please do not reply to this email.`;
}

/**
 * Creates SMS text for balance notifications
 * @param {Object} data - Notification data
 * @returns {string} SMS message
 */
function createBalanceSmsMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const shortAddress = shortenAddress(validatorVoteAddress, 4);
    
    const status = isLowBalance ? 'LOW BALANCE' : 'BALANCE OK';
    const emoji = isLowBalance ? '⚠️' : '✅';
    
    return `${emoji} ${status}
${shortAddress} ${network.toUpperCase()}
Balance: ${balanceInSOL.toFixed(2)} SOL
Threshold: ${threshold} SOL

${isLowBalance 
    ? `Validator below ${threshold} SOL threshold` 
    : `Validator recovered above ${threshold} SOL threshold`
}`;
}

/**
 * Creates SMS text for PDA balance notifications
 * @param {Object} data - Notification data
 * @returns {string} SMS message
 */
function createPdaBalanceSmsMessage(data) {
    const { validatorVoteAddress, balanceInSOL, threshold, isLowBalance, network } = data;
    const shortAddress = shortenAddress(validatorVoteAddress, 4);
    
    const status = isLowBalance ? 'LOW PDA BALANCE' : 'PDA BALANCE OK';
    const emoji = isLowBalance ? '⚠️' : '✅';
    
    return `${emoji} ${status}
${shortAddress} ${network.toUpperCase()}
PDA Balance: ${balanceInSOL.toFixed(2)} SOL
Threshold: ${threshold} SOL

${isLowBalance 
    ? `PDA below ${threshold} SOL threshold` 
    : `PDA recovered above ${threshold} SOL threshold`
}`;
}

/**
 * Creates SMS text for voting status notifications
 * @param {Object} data - Notification data
 * @returns {string} SMS message
 */
function createVotingStatusSmsMessage(data) {
    const { validatorVoteAddress, status, network } = data;
    const shortAddress = shortenAddress(validatorVoteAddress, 4);
    
    const isDelinquent = status === 'delinquent';
    const emoji = isDelinquent ? '⚠️' : '✅';
    const statusText = isDelinquent ? 'DELINQUENT' : 'VOTING';
    
    return `${emoji} ${statusText}
${shortAddress} ${network.toUpperCase()}

${isDelinquent 
    ? `Validator stopped voting - DELINQUENT` 
    : `Validator resumed voting - CURRENT`
}`;
}

/**
 * Creates SMS text for skip slot notifications
 * @param {Object} data - Notification data
 * @returns {string} SMS message
 */
function createSkipSlotSmsMessage(data) {
    const { validatorVoteAddress, skippedSlots, network } = data;
    const shortAddress = shortenAddress(validatorVoteAddress, 4);
    const slotsText = skippedSlots.length <= 3 
        ? skippedSlots.join(', ') 
        : `${skippedSlots.slice(0, 3).join(', ')} +${skippedSlots.length - 3} more`;
    
    return `⚠️ SKIP SLOTS
${shortAddress} ${network.toUpperCase()}
Skipped: ${slotsText}

Validator missed ${skippedSlots.length} leader slot(s)`;
}

/**
 * Creates email text for vote credit notifications
 * @param {Object} data - Notification data
 * @returns {string} Email message
 */
function createVoteCreditEmailMessage(data) {
    const { validatorVoteAddress, hasLowCredit, network } = data;
    const solscanUrl = getSolscanUrl(validatorVoteAddress, network);
    const shortAddress = shortenAddress(validatorVoteAddress);
    const timestamp = new Date().toLocaleString();
    
    const status = hasLowCredit ? 'LOW VOTE CREDIT ALERT' : 'VOTE CREDIT RESTORED';
    const emoji = hasLowCredit ? '⚠️' : '✅';
    
    return `${emoji} ${status}

Validator: ${shortAddress} (${validatorVoteAddress})
Network: ${network.charAt(0).toUpperCase() + network.slice(1)}
Status: ${hasLowCredit ? 'Low Vote Credit' : 'Normal Vote Credit'}
Timestamp: ${timestamp}

Solscan Link: ${solscanUrl}

${hasLowCredit 
    ? `Your tracked validator has low vote credits (all last 200 votes below 16).` 
    : `Your tracked validator has recovered to normal vote credits.`
}

---
Validator Status Notifications
This is an automated message. Please do not reply to this email.`;
}

/**
 * Creates SMS text for vote credit notifications
 * @param {Object} data - Notification data
 * @returns {string} SMS message
 */
function createVoteCreditSmsMessage(data) {
    const { validatorVoteAddress, hasLowCredit, network } = data;
    const shortAddress = shortenAddress(validatorVoteAddress, 4);
    
    const status = hasLowCredit ? 'LOW VOTE CREDIT' : 'VOTE CREDIT OK';
    const emoji = hasLowCredit ? '⚠️' : '✅';
    
    return `${emoji} ${status}
${shortAddress} ${network.toUpperCase()}

${hasLowCredit 
    ? `Validator has low vote credits (last 200 all < 16)` 
    : `Validator vote credits restored`
}`;
}

/**
 * Main function to format messages for different platforms
 * @param {string} context - Notification context ('balance', 'voting', 'skipSlots', etc.)
 * @param {Object} data - Notification data
 * @param {string} platform - Target platform ('discord', 'telegram', 'email', or 'sms')
 * @returns {EmbedBuilder|string} Formatted message
 */
export function formatMessage(context, data, platform) {
    console.log(context, data, platform);
    switch (context) {
        case 'balance':
            if (platform === 'discord') return createBalanceDiscordEmbed(data);
            if (platform === 'telegram') return createBalanceTelegramMessage(data);
            if (platform === 'email') return createBalanceEmailMessage(data);
            if (platform === 'sms') return createBalanceSmsMessage(data);
            break;
        case 'pdaBalance':
            if (platform === 'discord') return createPdaBalanceDiscordEmbed(data);
            if (platform === 'telegram') return createPdaBalanceTelegramMessage(data);
            if (platform === 'email') return createPdaBalanceEmailMessage(data);
            if (platform === 'sms') return createPdaBalanceSmsMessage(data);
            break;
        case 'delinquent':
        case 'resolved':
            if (platform === 'discord') return createVotingStatusDiscordEmbed(data);
            if (platform === 'telegram') return createVotingStatusTelegramMessage(data);
            if (platform === 'email') return createVotingStatusEmailMessage(data);
            if (platform === 'sms') return createVotingStatusSmsMessage(data);
            break;
        case 'skipSlots':
            if (platform === 'discord') return createSkipSlotDiscordEmbed(data);
            if (platform === 'telegram') return createSkipSlotTelegramMessage(data);
            if (platform === 'email') return createSkipSlotEmailMessage(data);
            if (platform === 'sms') return createSkipSlotSmsMessage(data);
            break;
        case 'voteCredit':
            if (platform === 'discord') return createVoteCreditDiscordEmbed(data);
            if (platform === 'telegram') return createVoteCreditTelegramMessage(data);
            if (platform === 'email') return createVoteCreditEmailMessage(data);
            if (platform === 'sms') return createVoteCreditSmsMessage(data);
            break;
        default:
            const message = data.message || 'Notification received';
            if (platform === 'discord') return new EmbedBuilder().setDescription(message).setColor(COLORS.INFO);
            if (platform === 'email') return `${message}\n\n---\nValidator Status Notifications\nThis is an automated message. Please do not reply to this email.`;
            if (platform === 'sms') return `⚠️ ALERT\n${message}`;
            return message;
    }
}

/**
 * Utility function to get validator info from lists
 * @param {string} validatorVoteAddress - Validator vote address
 * @returns {Object|null} Validator info or null
 */
export function getValidatorInfo(validatorVoteAddress) {
    try {
        return findValidatorInfoByVote(validatorVoteAddress);
    } catch (error) {
        console.error('Error getting validator info:', error);
        return null;
    }
}
