import { PublicKey } from '@solana/web3.js';
import { getMainnetList } from './validatorListLoader.js';
import validatorMainnetSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import userDataSchema from '../schema/userData.js';
import { notifyUsers } from './notificationUtils.js';

const PROGRAM_ID = new PublicKey('dzrevZC94tBLwuHw1dyynZxaXTWyp7yocsinyEVPtt4');
const SEED = Buffer.from('solana_validator_deposit');

export async function checkPdaBalance(mainnetConnection) {
    try {
        console.log('Starting PDA balance check...');
        
        const validators = await validatorMainnetSubscriptionSchema.find().lean();
        if (validators.length === 0) {
            console.log('No validators found for PDA balance tracking.');
            return;
        }

        console.log(`Checking PDA balances for ${validators.length} validators...`);

        for (const validator of validators) {
            try {
                const { validatorVoteAddress, lastPdaBalanceNotification, discordSubscriptions, tgSubscriptions } = validator;
                const validatorInfo = getMainnetList().find(v => v.voteId === validatorVoteAddress);
                
                let isDZCheck = await fetch(`https://www.validators.app/api/v1/validators/mainnet/${validatorInfo.validatorId}.json`)
                isDZCheck = await isDZCheck.json()
                isDZCheck = isDZCheckData.is_dz;
                
                if(!isDZCheck) return;
                
                const validatorPubKey = new PublicKey(validatorInfo.validatorId);
                const [pda] = PublicKey.findProgramAddressSync(
                    [SEED, validatorPubKey.toBuffer()],
                    PROGRAM_ID
                );
                const pdaAddress = pda.toBase58();  

                const balance = await mainnetConnection.getBalance(new PublicKey(pdaAddress));
                const balanceInSOL = balance / 1e9;
                
                console.log(`Validator ${validatorVoteAddress} PDA: ${balanceInSOL.toFixed(4)} SOL`);

            const allSubscribers = [...discordSubscriptions, ...tgSubscriptions];
            const userDataPromises = allSubscribers.map(userId =>
                userDataSchema.findOne({ userId }).lean()
            );
            const userDataList = await Promise.all(userDataPromises);

            const userThresholds = {};
            userDataList.forEach(userData => {
                if (userData) {
                    userThresholds[userData.userId] = userData.pdaBalanceThreshold || 0.5; 
                }
            });


            const discordNotifications = [];
            const tgNotifications = [];

            for (const userId of discordSubscriptions) {
                const threshold = userThresholds[userId] || 0.5;
                const isLowBalance = balanceInSOL < threshold;

                const currentNotificationState = lastPdaBalanceNotification[userId] || false;
                if (isLowBalance !== currentNotificationState) {
                    discordNotifications.push({
                        userId,
                        threshold,
                        isLowBalance
                    });
                }
            }

            for (const userId of tgSubscriptions) {
                const threshold = userThresholds[userId] || 0.5;
                const isLowBalance = balanceInSOL < threshold;

                const currentNotificationState = lastPdaBalanceNotification[userId] || false;
                if (isLowBalance !== currentNotificationState) {
                    tgNotifications.push({
                        userId,
                        threshold,
                        isLowBalance
                    });
                }
            }

            if (discordNotifications.length > 0 || tgNotifications.length > 0) {
                console.log(`Sending ${discordNotifications.length + tgNotifications.length} pda balance notifications for ${validatorVoteAddress}`);

                if (discordNotifications.length > 0) {
                    const discordSubs = discordNotifications.map(n => n.userId);
                    const tgSubs = [];

                    const firstNotification = discordNotifications[0];
                    const messageData = {
                        balanceInSOL,
                        threshold: firstNotification.threshold,
                        isLowBalance: firstNotification.isLowBalance,
                        pdaAddress: pdaAddress
                    };

                    await notifyUsers(
                        discordSubs,
                        tgSubs,
                        validatorVoteAddress,
                        'pdaBalance',
                        messageData
                    );
                }

                if (tgNotifications.length > 0) {
                    const discordSubs = [];
                    const tgSubs = tgNotifications.map(n => n.userId);

                    const firstNotification = tgNotifications[0];
                    const messageData = {
                        balanceInSOL,
                        threshold: firstNotification.threshold,
                        isLowBalance: firstNotification.isLowBalance,
                        pdaAddress: pdaAddress
                    };

                    await notifyUsers(
                        discordSubs,
                        tgSubs,
                        validatorVoteAddress,
                        'pdaBalance',
                        messageData
                    );
                }

                const updatedNotificationStates = { ...lastPdaBalanceNotification };
                [...discordNotifications, ...tgNotifications].forEach(notification => {
                    updatedNotificationStates[notification.userId] = notification.isLowBalance;
                });

                await validatorMainnetSubscriptionSchema.updateOne(
                    { validatorVoteAddress },
                    { $set: { lastPdaBalanceNotification: updatedNotificationStates } }
                );

                console.log(`Updated pda balance notification states for ${validatorVoteAddress}`);
            } else {
                console.log(`No pda balance status changes for ${validatorVoteAddress} (${balanceInSOL.toFixed(4)} SOL)`);
            }

            } catch (error) {
                console.error(`Error checking PDA balance for validator ${validator.validatorVoteAddress}:`, error);
            }
        }
        
        console.log('PDA balance check completed.');
        
    } catch (error) {
        console.error('Error in checkPdaBalance:', error);
    }
}