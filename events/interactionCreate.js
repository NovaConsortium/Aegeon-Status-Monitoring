import { getMainnetList, getTestnetList } from '../handler/validatorListLoader.js';

import mainnetValidatorSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import testnetvalidatorSubscriptionSchema from '../schema/trackedTestnetValidator.js';
import userDataSchema from '../schema/userData.js';

export default (client) => {
    client.on('interactionCreate', async (interaction) => {
        //SLASH COMMANDS
        if (interaction.isChatInputCommand()) {
            const cmd = client.slashCommands.get(interaction.commandName);
            if (!cmd) return interaction.reply({ content: `**Something went Wrong! Please Report This To A Staff Member**`, ephemeral: true });

            const args = [];

            for (let option of interaction.options.data) {
                if (option.type === "SUB_COMMAND") {
                    if (option.name) args.push(option.name);
                    option.options?.forEach((x) => {
                        if (x.value) args.push(x.value);
                    });
                } else if (option.value) args.push(option.value);
            }
            cmd.run(client, interaction, args)
        }

        const shortenAddress = (address, chars = 6) =>
            `${address.slice(0, chars)}...${address.slice(-chars)}`;

        const getDisplayName = (v) =>
            v.name && v.name.trim().length > 0 ? v.name : shortenAddress(v.voteId);

        if (interaction.isAutocomplete()) {
            switch (interaction.commandName) {
                case "track-validator": {
                    const focusedOption = interaction.options.getFocused(true);

                    if (focusedOption.name === "name") {
                        const network = interaction.options.getString("network");
                        const list = network === "Mainnet" ? getMainnetList() : getTestnetList();

                        const query = (focusedOption.value || "").toLowerCase();
                        const filtered = list
                            .filter(v => {
                                const name = (v.name || "").toLowerCase();
                                return (
                                    name.includes(query) ||
                                    (v.voteId || "").toLowerCase().includes(query) ||
                                    (v.validatorId || "").toLowerCase().includes(query)
                                );
                            })
                            .map(v => ({
                                name: getDisplayName(v),
                                value: v.voteId
                            }));

                        await interaction.respond(filtered.slice(0, 25));
                    }
                    break;
                }
                case "untrack-validator": {
                    const focusedOption = interaction.options.getFocused(true);
                    
                    if (focusedOption.name === "name") {
                        const query = focusedOption.value.toLowerCase();
                        
                        const testnetTracked = await testnetvalidatorSubscriptionSchema.find({ 
                            discordSubscriptions: interaction.user.id 
                        }).lean();
                        
                        const mainnetTracked = await mainnetValidatorSubscriptionSchema.find({ 
                            discordSubscriptions: interaction.user.id 
                        }).lean();

                        let choices = [];
                        
                        const mainnetList = getMainnetList();
                        const testnetList = getTestnetList();

                        testnetTracked.forEach(validator => {

                            const info = testnetList.find((v) => v.voteId === validator.validatorVoteAddress);
                            const displayName = getDisplayName(info);
                            if (displayName.toLowerCase().includes(query) || validator.validatorVoteAddress.toLowerCase().includes(query)) {
                                choices.push({
                                    name: `Testnet - ${displayName}`,
                                    value: `${validator.validatorVoteAddress}_Testnet`
                                });
                            }
                        });
                        
                        mainnetTracked.forEach(validator => {
                            const info = mainnetList.find((v) => v.voteId === validator.validatorVoteAddress);
                            const displayName = getDisplayName(info);
                            if (displayName.toLowerCase().includes(query) || validator.validatorVoteAddress.toLowerCase().includes(query)) {
                                choices.push({
                                    name: `Mainnet - ${displayName}`,
                                    value: `${validator.validatorVoteAddress}_Mainnet`
                                });
                            }
                        });

                        await interaction.respond(choices.slice(0, 25));
                    }
                    break;
                }
                case "settings": {
                    const focusedOption = interaction.options.getFocused(true);
                    
                    if (focusedOption.name === "validator") {
                        const query = focusedOption.value.toLowerCase();
                        
                        const testnetTracked = await testnetvalidatorSubscriptionSchema.find({ 
                            discordSubscriptions: interaction.user.id 
                        }).lean();
                        
                        const mainnetTracked = await mainnetValidatorSubscriptionSchema.find({ 
                            discordSubscriptions: interaction.user.id 
                        }).lean();

                        let choices = [];
                        
                        const mainnetList = getMainnetList();
                        const testnetList = getTestnetList();

                        testnetTracked.forEach(validator => {
                            const info = testnetList.find((v) => v.voteId === validator.validatorVoteAddress);
                            if (!info) return;
                            const displayName = getDisplayName(info);
                            if (displayName.toLowerCase().includes(query) || validator.validatorVoteAddress.toLowerCase().includes(query)) {
                                choices.push({
                                    name: `Testnet - ${displayName}`,
                                    value: `${validator.validatorVoteAddress}_Testnet`
                                });
                            }
                        });
                        
                        mainnetTracked.forEach(validator => {
                            const info = mainnetList.find((v) => v.voteId === validator.validatorVoteAddress);
                            if (!info) return;
                            const displayName = getDisplayName(info);
                            if (displayName.toLowerCase().includes(query) || validator.validatorVoteAddress.toLowerCase().includes(query)) {
                                choices.push({
                                    name: `Mainnet - ${displayName}`,
                                    value: `${validator.validatorVoteAddress}_Mainnet`
                                });
                            }
                        });

                        await interaction.respond(choices.slice(0, 25));
                    }
                    break;
                }
            }
        }

    });
}