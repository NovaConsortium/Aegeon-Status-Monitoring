import { ButtonBuilder, ContainerBuilder, EmbedBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";
import userDataSchema from "../schema/userData.js";
import { getMainnetList, getTestnetList } from "../handler/validatorListLoader.js";

const shortenAddress = (address, chars = 6) => {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const getDisplayName = (validator) =>
    validator.name && validator.name.trim().length > 0
        ? validator.name
        : shortenAddress(validator.voteId);

export default {
    name: "settings",
    description: "Specify where you want to receive notifications.",
    options: [
        {
            name: 'validator',
            description: 'The Validator Name OR Vote Address with network autocomplete',
            type: 3,
            required: true,
            autocomplete: true
        }
    ],
    run: async (client, interaction, args) => {
        const notificationTypes = [
            { key: 'discordDM', label: 'Discord DM', status: true },
            { key: 'whatsappMsg', label: 'Whatsapp Message', status: false },
            { key: 'sms', label: 'SMS', status: true },
            { key: 'email', label: 'Email', status: true },
            { key: 'call', label: 'Call', status: true }
        ];

        const input = interaction.options.getString('validator');
        const [validatorVoteAddress, network] = input.split('_');
        
        if (!validatorVoteAddress || !network) {
            return interaction.reply({ 
                content: `**Invalid validator format.**`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const isMainnet = network === 'Mainnet';
        const networkLower = network.toLowerCase();
        const list = isMainnet ? getMainnetList() : getTestnetList();
        const validatorInfo = list.find(v => v.voteId === validatorVoteAddress);

        if (!validatorInfo) {
            return interaction.reply({ 
                content: `**Validator not found on ${network}.**`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const displayName = getDisplayName(validatorInfo);
        const solscanUrl = `https://solscan.io/account/${validatorVoteAddress}${isMainnet ? "" : "?cluster=testnet"}`;

        const userData = await userDataSchema.findOne({ userId: interaction.user.id });
        if (!userData) {
            return interaction.reply({ 
                content: `**You are not tracking any validators. Use /track-validator to start tracking.**`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Find or create validator entry in trackedValidators
        let validatorEntry = userData.trackedValidators.find(
            v => v.validatorVoteAddress === validatorVoteAddress && v.network === networkLower
        );

        if (!validatorEntry) {
            // Create default entry if not found
            validatorEntry = {
                validatorVoteAddress,
                network: networkLower,
                notifications: {
                    discordDM: true,
                    whatsappMsg: false,
                    sms: false,
                    email: false,
                    call: false
                }
            };
            userData.trackedValidators.push(validatorEntry);
            await userData.save();
        }

        function createContainer(validatorNotifications) {
            const container = new ContainerBuilder();

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### \`🔔\` Notification Settings for [${displayName}](${solscanUrl})`)
            );

            notificationTypes.forEach(({ key, label, status }) => {
                const button = new ButtonBuilder()
                    .setLabel(validatorNotifications[key] ? 'Enabled' : 'Disabled')
                    .setStyle(validatorNotifications[key] ? "Success" : "Danger")
                    .setCustomId(`toggle-${key}`);

                    if(!status) {
                        button.setDisabled(true);
                    }

                const section = new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${label}:**`))
                    .setButtonAccessory(button);

                container.addSectionComponents(section);
            });

            return container;
        }

        const container = createContainer(validatorEntry.notifications);

        let sentMsg;
        if (!interaction.channel) sentMsg = await interaction.reply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        else sentMsg = await interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] });

        const filter = (interaction) => {
            return interaction.isButton() && interaction.customId.startsWith('toggle-');
        };

        const collector = sentMsg.createMessageComponentCollector({
            filter,
            time: 5 * 60 * 1000 
        });

        collector.on('collect', async (buttonInteraction) => {
            const customId = buttonInteraction.customId;
            const [, key] = customId.split('-');

            const userData = await userDataSchema.findOne({ userId: buttonInteraction.user.id });
            if (!userData) return;

            // Find the validator entry
            const validatorEntry = userData.trackedValidators.find(
                v => v.validatorVoteAddress === validatorVoteAddress && v.network === networkLower
            );

            if (!validatorEntry) {
                return await buttonInteraction.reply({ 
                    content: `**Validator entry not found.**`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            if (["sms", "call"].includes(key) && !userData.phoneNumber) {
                return await buttonInteraction.reply({ content: `**Please set your phone number first to enable ${key === "sms" ? "SMS" : "Call"} notifications.**\n\nThis can be done by running \`/set-phone\` command`, flags: [MessageFlags.Ephemeral] });
            }
            if (key === "email" && !userData.email) {
                return await buttonInteraction.reply({ content: `**Please set your email first to enable Email notifications.**\n\nThis can be done by running \`/set-email\` command`, flags: [MessageFlags.Ephemeral] });
            }

            validatorEntry.notifications[key] = !validatorEntry.notifications[key];
            await userData.save();

            await buttonInteraction.deferUpdate();

            const updatedContainer = createContainer(validatorEntry.notifications);

            interaction.editReply({ components: [updatedContainer], flags: [MessageFlags.IsComponentsV2] });
        });

        collector.on('end', collected => {
            console.log(`Collected ${collected.size} interactions.`);
        });

    }
};
