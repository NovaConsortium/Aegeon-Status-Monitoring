import { ActionRowBuilder, ButtonBuilder, ComponentType, ContainerBuilder, MessageFlags, ModalBuilder, SectionBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

import userDataSchema from '../schema/userData.js';

// Cooldown tracking - Map of userId to last usage timestamp
const cooldowns = new Map();
const COOLDOWN_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export default {
    name: "set-phone",
    description: "Set your phone number for notifications.",
    options: [
        {
            name: 'phone',
            description: 'Your phone number with country code (e.g., +121234567890)',
            type: 3,
            required: true
        }
    ],
    run: async (client, interaction, args) => {
        const userId = interaction.user.id;
        const now = Date.now();
        
        if (cooldowns.has(userId)) {
            const lastUsage = cooldowns.get(userId);
            const timeLeft = COOLDOWN_DURATION - (now - lastUsage);
            
            if (timeLeft > 0) {
                const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
                return interaction.reply({ 
                    content: `You can only use this command once every 15 minutes. Please wait ${minutesLeft} more minute(s).`, 
                    ephemeral: true 
                });
            }
        }
        
        cooldowns.set(userId, now);
        
        const phoneNumber = interaction.options.getString('phone');

        const checkPhoneNumber = /^\+\d{10,15}$/;
        if (!checkPhoneNumber.test(phoneNumber)) {
            return interaction.reply({ content: "Please provide a valid phone number with country code (e.g., +121234567890).", ephemeral: true });
        }
        //interaction.reply({ content: "Coming Soon!", ephemeral: true });
        const code = Math.floor(10000 + Math.random() * 90000).toString();

        client.twilioClient.messages
            .create({
                body: `${code} is your code to verify your phone number for Aegeon - Validator Status Notifications Discord Bot. Valid for 5 minutes.`,
                to: phoneNumber,
                from: '+15757544013',
            })
            .then((message) => console.log(message.sid));

        const button = new ButtonBuilder() 
            .setCustomId(`enterCode`)
            .setLabel('Enter Code')
            .setStyle('Primary');

        const container = new ContainerBuilder().setAccentColor(0x00ff00);

        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Please enter the one-time verification code that was sent to your phone number. This code is valid for only 5 minutes.**`))
                .setButtonAccessory(button)
        )

        await interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] });

        const modal = new ModalBuilder()
            .setCustomId('otpModal')
            .setTitle('Enter OTP Code')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('otpInput')
                        .setLabel('One Time Code')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(5)
                        .setRequired(true)
                )
            );

        const user = await interaction.user.fetch();
        const dmChannel = user.dmChannel || await user.createDM();

        const collectorButton = dmChannel.createMessageComponentCollector({ time: 5 * 60 * 1000 });
        collectorButton.on('collect', async i => {
            i.showModal(modal);

            const modalInteraction = await i.awaitModalSubmit({ time: 5 * 60 * 1000 });
            const userInput = modalInteraction.fields.getTextInputValue('otpInput');

            if (userInput !== code) return modalInteraction.reply({ content: "Invalid Verification Code Provided. Please try again.", ephemeral: true });

            const userData = await userDataSchema.findOne({ userId: interaction.user.id });
            userData.phoneNumber = phoneNumber;
            await userData.save();

            // Clear cooldown on successful verification
            cooldowns.delete(userId);

            const container2 = new ContainerBuilder().setAccentColor(0x00ff00);

            container2.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:tick:1399117596749598801> Phone number verified successfully! You can now enable SMS and Call notifications in </settings:1416123526150230036>.\n\nNote: Call will only be made if validator goes delinquent`)
            );

            interaction.editReply({ components: [container2], flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] });
            await modalInteraction.deferUpdate();
        });

        collectorButton.on('end', collected => {
            const button = new ButtonBuilder()
                .setCustomId(`enterCode`)
                .setLabel('Enter Code')
                .setDisabled(true)
                .setStyle('Primary');

            const container = new ContainerBuilder().setAccentColor(0x00ff00);

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Please enter the one-time verification code that was sent to your phone number. This code is valid for only 5 minutes.**`))
                    .setButtonAccessory(button)
            )

            interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        });

    },
};