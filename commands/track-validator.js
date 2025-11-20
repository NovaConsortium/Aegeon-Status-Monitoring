import { ContainerBuilder, EmbedBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";
import validatorTestnetSubscriptionSchema from "../schema/trackedTestnetValidator.js";
import validatorMainnetSubscriptionSchema from "../schema/trackedMainnetValidator.js";
import { getMainnetList, getTestnetList } from "../handler/validatorListLoader.js";
import userDataSchema from "../schema/userData.js";
import { validatorEmitter } from '../handler/validatorEmitter.js';

const shortenAddress = (address, chars = 6) => {
    if (!address) return "Unknown";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};
export default {
    name: "track-validator",
    description: "Add Validator To Track",
    options: [
        {
            name: 'network',
            description: 'The Solana Network',
            type: 3,
            required: true,
            choices: [
                { name: 'Mainnet', value: 'Mainnet' },
                { name: 'Testnet', value: 'Testnet' }
            ]
        },
        {
            name: 'name',
            description: 'The Validator Name OR Vote Address',
            type: 3,
            required: true,
            autocomplete: true
        }
    ],
    run: async (_, interaction) => {
        const network = interaction.options.getString('network');
        const validatorVoteAddress = interaction.options.getString('name');

        const isMainnet = network === 'Mainnet';
        const list = isMainnet ? getMainnetList() : getTestnetList();
        const Schema = isMainnet ? validatorMainnetSubscriptionSchema : validatorTestnetSubscriptionSchema;

        const info = list.find(v => v.voteId === validatorVoteAddress);
        if (!info) return interaction.reply({ content: `**Invalid validator vote address provided.**`, flags: [ MessageFlags.Ephemeral ] });

        const displayName = info.name && info.name.trim().length > 0
            ? info.name
            : shortenAddress(info.voteId);

        const solscanUrl = `https://solscan.io/account/${validatorVoteAddress}${isMainnet ? "" : "?cluster=testnet"}`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:tick:1399117596749598801> Added [${displayName}](${solscanUrl}) to DM subscriptions.`)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(`\`🪪\` **Vote ID:** ${info.voteId}\n\`🔗\` **Validator ID:** ${info.validatorId}\n\`🌐\` **Network:** ${network}\n\`⚙️\` **Version:** ${info.nodeVersion}`)
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(info.iconUrl || "https://media.discordapp.net/attachments/1366369127953989692/1399394706504290555/svgviewer-png-output.png")
                    )
            );

        let subscription = await Schema.findOne({ validatorVoteAddress: info.voteId });
        let userData = await userDataSchema.findOne({ userId: interaction.user.id });
        if(!userData) {
            userData = new userDataSchema({
                userId: interaction.user.id,
                type: "discord"
            });
            await userData.save();
        }
        if (subscription) {
            if (subscription.discordSubscriptions.some(sub => sub === interaction.user.id)) {
                return interaction.reply({ content: `**You Have Already Subscribed To This Validator.**`, flags: [ MessageFlags.Ephemeral ] });
            }
            subscription.discordSubscriptions.push(interaction.user.id);
        } else {
            subscription = new Schema({
                validatorVoteAddress: info.voteId,
                discordSubscriptions: [ interaction.user.id ]
            });

        }
        const dmChannel = await interaction.user.createDM();
        const dmEmbed = new EmbedBuilder()
            .setDescription(`<:tick:1399117596749598801> You have successfully subscribed to the validator [${displayName}](${solscanUrl}).`)
            .setColor("Green");

        dmChannel.send({ embeds: [dmEmbed] }).catch(err => {
            return interaction.reply({ content: `**Unable to send you a DM. Please check your privacy settings.**`, ephemeral: true });
        })

        await subscription.save();
        
        // Add validator to userData.trackedValidators with default notification settings
        const networkLower = network.toLowerCase();
        const existingValidator = userData.trackedValidators.find(
            v => v.validatorVoteAddress === info.voteId && v.network === networkLower
        );
        
        if (!existingValidator) {
            userData.trackedValidators.push({
                validatorVoteAddress: info.voteId,
                network: networkLower,
                notifications: {
                    discordDM: true,
                    whatsappMsg: false,
                    sms: false,
                    email: false,
                    call: false
                }
            });
            await userData.save();
        }
        
        validatorEmitter.emit('validatorStateChanged', { validatorVoteAddress, network, action: "added" });
        if(interaction.inGuild()) interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] })
        else await await interaction.reply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
    }
};