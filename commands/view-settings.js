import { ContainerBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder } from "discord.js";
import userDataSchema from "../schema/userData.js";
import { getMainnetList, getTestnetList } from "../handler/validatorListLoader.js";

const shortenAddress = (address, chars = 6) => {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const getDisplayName = (validator) =>
    validator && validator.name && validator.name.trim().length > 0
        ? validator.name
        : validator ? shortenAddress(validator.voteId) : "Unknown";

const getNotificationStatus = (notifications) => {
    const enabled = [];
    if (notifications.discordDM) enabled.push("Discord DM");
    if (notifications.whatsappMsg) enabled.push("WhatsApp");
    if (notifications.sms) enabled.push("SMS");
    if (notifications.email) enabled.push("Email");
    if (notifications.call) enabled.push("Call");
    return enabled.length > 0 ? enabled.join(", ") : "None";
};

export default {
    name: "view-settings",
    description: "View notification settings for all tracked validators.",
    run: async (client, interaction, args) => {
        const userData = await userDataSchema.findOne({ userId: interaction.user.id });
        
        if (!userData || !userData.trackedValidators || userData.trackedValidators.length === 0) {
            return interaction.reply({
                content: `**You are not tracking any validators. Use /track-validator to start tracking.**`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const mainnetList = getMainnetList();
        const testnetList = getTestnetList();
        
        const container = new ContainerBuilder();
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### \`📋\` Notification Settings Overview`)
        );

        // Group validators by network
        const mainnetValidators = [];
        const testnetValidators = [];

        for (const trackedValidator of userData.trackedValidators) {
            const list = trackedValidator.network === 'mainnet' ? mainnetList : testnetList;
            const validatorInfo = list.find(v => v.voteId === trackedValidator.validatorVoteAddress);
            
            const displayName = getDisplayName(validatorInfo);
            const solscanUrl = `https://solscan.io/account/${trackedValidator.validatorVoteAddress}${trackedValidator.network === 'mainnet' ? "" : "?cluster=testnet"}`;
            const notificationStatus = getNotificationStatus(trackedValidator.notifications);
            
            const validatorData = {
                displayName,
                solscanUrl,
                voteAddress: trackedValidator.validatorVoteAddress,
                network: trackedValidator.network,
                notificationStatus
            };

            if (trackedValidator.network === 'mainnet') {
                mainnetValidators.push(validatorData);
            } else {
                testnetValidators.push(validatorData);
            }
        }

        // Display Mainnet validators
        if (mainnetValidators.length > 0) {
            let mainnetContent = `**🌐 Mainnet Validators:**\n\n`;
            mainnetValidators.forEach((v, index) => {
                mainnetContent += `${index + 1}. **[${v.displayName}](${v.solscanUrl})**\n`;
                mainnetContent += `   \`${shortenAddress(v.voteAddress)}\`\n`;
                mainnetContent += `   📢 Notifications: ${v.notificationStatus}\n\n`;
            });

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(mainnetContent.trim())
                    )
            );
        }

        // Display Testnet validators
        if (testnetValidators.length > 0) {
            let testnetContent = `**🧪 Testnet Validators:**\n\n`;
            testnetValidators.forEach((v, index) => {
                testnetContent += `${index + 1}. **[${v.displayName}](${v.solscanUrl})**\n`;
                testnetContent += `   \`${shortenAddress(v.voteAddress)}\`\n`;
                testnetContent += `   📢 Notifications: ${v.notificationStatus}\n\n`;
            });

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(testnetContent.trim())
                    )
            );
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\n💡 Use \`/settings\` to modify notification settings for a specific validator.`)
        );

        if (!interaction.channel) {
            return interaction.reply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        } else {
            return interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] });
        }
    }
};

