import { PublicKey } from '@solana/web3.js';
import validatorMainnetSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import userDataSchema from '../schema/userData.js';
import { notifyUsers } from './notificationUtils.js';
import { getMainnetList } from './validatorListLoader.js';

export async function trackValidatorBalances(mainnetConnection) {
    try {
        console.log('Starting validator balance check...');
        
        const validators = await validatorMainnetSubscriptionSchema.find().lean();
        if (validators.length === 0) {
            console.log('No validators found for balance tracking.');
            return;
        }

        console.log(`Checking balances for ${validators.length} validators...`);

        for (const validator of validators) {
            try {
                const { validatorVoteAddress, lastBalanceNotification, discordSubscriptions, tgSubscriptions } = validator;
                const validatorInfo = getMainnetList().find(v => v.voteId === validatorVoteAddress);
                
                const pubKey = new PublicKey(validatorInfo.validatorId);
                const balanceInfo = await mainnetConnection.getBalance(pubKey);
                const balanceInSOL = balanceInfo / 1e9; 
                
                console.log(`Validator ${validatorVoteAddress}: ${balanceInSOL.toFixed(4)} SOL`);
                
                const allSubscribers = [...discordSubscriptions, ...tgSubscriptions];
                const userDataPromises = allSubscribers.map(userId => 
                    userDataSchema.findOne({ userId }).lean()
                );
                const userDataList = await Promise.all(userDataPromises);
                
                const userThresholds = {};
                userDataList.forEach(userData => {
                    if (userData) {
                        userThresholds[userData.userId] = userData.balanceThreshold || 3;
                    }
                });
                               
                const discordNotifications = [];
                const tgNotifications = [];
                
                for (const userId of discordSubscriptions) {
                    const threshold = userThresholds[userId] || 3;
                    const isLowBalance = balanceInSOL < threshold;
                    
                    const currentNotificationState = lastBalanceNotification[userId] || false;
                    if (isLowBalance !== currentNotificationState) {
                        discordNotifications.push({
                            userId,
                            threshold,
                            isLowBalance
                        });
                    }
                }
                
                for (const userId of tgSubscriptions) {
                    const threshold = userThresholds[userId] || 3;
                    const isLowBalance = balanceInSOL < threshold;
                    
                    const currentNotificationState = lastBalanceNotification[userId] || false;
                    if (isLowBalance !== currentNotificationState) {
                        tgNotifications.push({
                            userId,
                            threshold,
                            isLowBalance
                        });
                    }
                }
                
                if (discordNotifications.length > 0 || tgNotifications.length > 0) {
                    console.log(`Sending ${discordNotifications.length + tgNotifications.length} balance notifications for ${validatorVoteAddress}`);
                    
                    if (discordNotifications.length > 0) {
                        const discordSubs = discordNotifications.map(n => n.userId);
                        const tgSubs = [];
                        
                        const firstNotification = discordNotifications[0];
                        const messageData = {
                            balanceInSOL,
                            threshold: firstNotification.threshold,
                            isLowBalance: firstNotification.isLowBalance
                        };
                        
                        await notifyUsers(
                            discordSubs,
                            tgSubs,
                            validatorVoteAddress,
                            'balance',
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
                            isLowBalance: firstNotification.isLowBalance
                        };
                        
                        await notifyUsers(
                            discordSubs,
                            tgSubs,
                            validatorVoteAddress,
                            'balance',
                            messageData
                        );
                    }
                    
                    const updatedNotificationStates = { ...lastBalanceNotification };
                    [...discordNotifications, ...tgNotifications].forEach(notification => {
                        updatedNotificationStates[notification.userId] = notification.isLowBalance;
                    });
                    
                    await validatorMainnetSubscriptionSchema.updateOne(
                        { validatorVoteAddress },
                        { $set: { lastBalanceNotification: updatedNotificationStates } }
                    );
                    
                    console.log(`Updated balance notification states for ${validatorVoteAddress}`);
                } else {
                    console.log(`No balance status changes for ${validatorVoteAddress} (${balanceInSOL.toFixed(4)} SOL)`);
                }
                
            } catch (error) {
                console.error(`Error checking balance for validator ${validator.validatorVoteAddress}:`, error);
            }
        }
        
        console.log('Validator balance check completed.');
        
    } catch (error) {
        console.error('Error in trackValidatorBalances:', error);
    }
}
