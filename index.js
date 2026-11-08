const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = theRequire = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District Bot is alive and running 24/7!');
});

app.listen(port, () => {
    console.log(`Web server is listening on port ${port}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // تسجيل أمر /join مباشرة في السيرفرات التي يتواجد فيها البوت
    const command = new SlashCommandBuilder()
        .setName('join')
        .setDescription('يجعل البوت يدخل القناة الصوتية معك');

    try {
        await client.application.commands.create(command);
        console.log('Successfully registered /join command.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'join') {
        const voiceChannel = interaction.member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply({ content: 'يجب أن تكون في قناة صوتية أولاً لكي أتمكن من الدخول معك!', ephemeral: true });
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            await interaction.reply(`تم الانضمام إلى القناة الصوتية: **${voiceChannel.name}** بنجاح!`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'حدث خطأ أثناء محاولة الانضمام للقناة الصوتية.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
