import { ContainerBuilder, EmbedBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder } from "discord.js";
import userDataSchema from "../schema/userData.js";

export default {
    name: "set-balance-threshold",
    description: "Set your balance threshold for validator notifications",
    options: [
        {
            name: 'threshold',
            description: 'SOL threshold for balance alerts (0.1 - 100)',
            type: 10, // NUMBER type
            required: true,
            min_value: 0.1,
            max_value: 100
        }
    ],
    run: async (client, interaction) => {
        const threshold = interaction.options.getNumber('threshold');

        // Validate threshold
        if (threshold < 0.1 || threshold > 100) {
            return interaction.reply({
                content: `**Invalid threshold!** Please enter a value between 0.1 and 100 SOL.`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        let userData = await userDataSchema.findOne({ userId: interaction.user.id });
        if (!userData) {
            userData = new userDataSchema({
                userId: interaction.user.id,
                type: "discord"
            });
        }

        const oldThreshold = userData.balanceThreshold;
        userData.balanceThreshold = threshold;
        await userData.save();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ✅ Balance Threshold Updated`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`**Previous Threshold:** ${oldThreshold} SOL\n**New Threshold:** ${threshold} SOL\n\nYou will now receive balance alerts when any of your tracked validators fall below **${threshold} SOL**.`)
            )

        if (interaction.channel.isDMBased()) {
            await interaction.reply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        } else {
            await interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] });
        }
    }
};
