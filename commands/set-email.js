import { ActionRowBuilder, ButtonBuilder, ComponentType, ContainerBuilder, MessageFlags, ModalBuilder, SectionBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import userDataSchema from '../schema/userData.js';

export default {
    name: "set-email",
    description: "Set your email address for notifications.",
    options: [
        {
            name: 'email',
            description: 'Your email address',
            type: 3,
            required: true
        }
    ],
    run: async (client, interaction, args) => {
        const email = interaction.options.getString('email');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return interaction.reply({ 
                content: "Please provide a valid email address (e.g., user@example.com).", 
                ephemeral: true 
            });
        }

        const code = Math.floor(10000 + Math.random() * 90000).toString();
        const mailOptions = {
            from: `"Validator Status Notifications" <${process.env.emailAddress}>`,
            to: email,
            subject: 'Validator Status Notifications - Email Verification',
            text: `Here is your one-time verification code to link your email with validator status monitoring:
${code}

This code will expire in 5 minutes.
If you didn’t request this, please ignore this email.
`,
        };

        console.log(code);

        const button = new ButtonBuilder()
            .setCustomId(`enterCode`)
            .setLabel('Enter Code')
            .setStyle('Primary');

        const container = new ContainerBuilder().setAccentColor(0x00ff00);

        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Please enter the one-time verification code that was sent to your email address. This code is valid for only 5 minutes.**`))
                .setButtonAccessory(button)
        )

        const reply = await interaction.reply({ components: [container], flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] });

        client.emailTransporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Email sending error:', error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

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

        const collectorButton = reply.createMessageComponentCollector({ time: 5 * 60 * 1000 });
        collectorButton.on('collect', async i => {
            i.showModal(modal);

            const modalInteraction = await i.awaitModalSubmit({ time: 5 * 60 * 1000 });
            const userInput = modalInteraction.fields.getTextInputValue('otpInput');

            if (userInput !== code) return modalInteraction.reply({ content: "Invalid OTP code. Please try again.", ephemeral: true });

            let userData = await userDataSchema.findOne({ userId: interaction.user.id });
            if (!userData) {
                userData = new userDataSchema({
                    userId: interaction.user.id,
                    type: "discord"
                });
            }
            userData.email = email;
            await userData.save();

            const container2 = new ContainerBuilder().setAccentColor(0x00ff00);

            container2.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### <:tick:1399117596749598801> Email address verified successfully! You can now enable Email notifications in </settings:1413589480304283741>.`)
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
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Please enter the one-time verification code that was sent to your email address. This code is valid for only 5 minutes.**`))
                    .setButtonAccessory(button)
            )

            interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
        });

    },
};