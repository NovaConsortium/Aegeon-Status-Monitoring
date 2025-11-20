import {
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder
} from "discord.js";
import validatorTestnetSubscriptionSchema from "../schema/trackedTestnetValidator.js";
import validatorMainnetSubscriptionSchema from "../schema/trackedMainnetValidator.js";
import { getMainnetList, getTestnetList } from "../handler/validatorListLoader.js";
import { validatorEmitter } from '../handler/validatorEmitter.js';
import userDataSchema from "../schema/userData.js";

const shortenAddress = (address, chars = 6) => {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const getDisplayName = (validator) =>
    validator.name && validator.name.trim().length > 0
        ? validator.name
        : shortenAddress(validator.voteId);

export default {
    name: "untrack-validator",
    description: "Remove Validator From Tracking",
    options: [
        {
            name: "name",
            description: "The Validator Name OR Vote Address with network autocomplete",
            type: 3,
            required: true,
            autocomplete: true
        }
    ],
    run: async (_, interaction) => {
        const input = interaction.options.getString("name");
        const [validatorAddress, network] = input.split("_");
        if (!validatorAddress || !network) return interaction.reply({ content: "**Invalid input format.**", ephemeral: true });

        const isMainnet = network === "Mainnet";

        const list = isMainnet ? getMainnetList() : getTestnetList();
        const Schema = isMainnet ? validatorMainnetSubscriptionSchema : validatorTestnetSubscriptionSchema;

        const info = list.find((v) => v.voteId === validatorAddress);
        if (!info)
            return interaction.reply({
                content: `**Validator not found on ${network}.**`,
                ephemeral: true
            });

        const displayName = getDisplayName(info);
        const solscanUrl = `https://solscan.io/account/${validatorAddress}${isMainnet ? "" : "?cluster=testnet"}`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### <:cross:1399399676696068127> Removed [${displayName}](${solscanUrl}) from your subscriptions.`
                )
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `\`🪪\` **Vote ID:** ${info.voteId}\n\`🔗\` **Validator ID:** ${info.validatorId}\n\`🌐\` **Network:** ${network}\n\`⚙️\` **Version:** ${info.nodeVersion}`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(
                            info.iconUrl || "https://media.discordapp.net/attachments/1366369127953989692/1399394706504290555/svgviewer-png-output.png"
                        )
                    )
            );

        const subscription = await Schema.findOne({ validatorVoteAddress: info.voteId });
        if (!subscription)
            return interaction.reply({
                content: `**You are not subscribed to this validator.**`,
                ephemeral: true
            });

        const beforeCount = subscription.discordSubscriptions.length;
        subscription.discordSubscriptions = subscription.discordSubscriptions.filter(
            (sub) => sub !== interaction.user.id
        );
        
        if (subscription.discordSubscriptions.length === beforeCount) {
            return interaction.reply({
                content: `**You are not subscribed to this validator in this server.**`,
                ephemeral: true
            });
        }

        if (subscription.discordSubscriptions.length === 0 && subscription.tgSubscriptions.length === 0 ) {
            await Schema.deleteOne({ validatorVoteAddress: info.voteId });
        } else {
            await subscription.save();
        }

        // Remove validator from userData.trackedValidators
        const networkLower = network.toLowerCase();
        const userData = await userDataSchema.findOne({ userId: interaction.user.id });
        if (userData) {
            userData.trackedValidators = userData.trackedValidators.filter(
                v => !(v.validatorVoteAddress === info.voteId && v.network === networkLower)
            );
            await userData.save();
        }

        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress: info.voteId, network, action: "removed" });
        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        
    }
};
