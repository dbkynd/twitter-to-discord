import Discord from 'discord.js'
import logger from '../logger'
import add from './add'
import list from './list'
import remove from './remove'

const commandData: Discord.ApplicationCommandData = {
  name: 'twitter',
  description: 'Manage Discord channels to post Tweets to.',
  options: [
    {
      name: 'list',
      type: 'SUB_COMMAND',
      description: 'List what Twitter channels post to what Discord channels.',
      options: [
        {
          name: 'all',
          type: 'BOOLEAN',
          description:
            'List results from all connected guilds. Bot Owner option only.',
        },
      ],
    },
    {
      name: 'post',
      type: 'SUB_COMMAND',
      description: 'Edit a Twitter post channel.',
      options: [
        {
          name: 'action',
          type: 'STRING',
          description: 'Add or remove a tweet post channel.',
          required: true,
          choices: [
            {
              name: 'add',
              value: 'add',
            },
            {
              name: 'remove',
              value: 'remove',
            },
          ],
        },
        {
          name: 'twitter_channel',
          type: 'STRING',
          description: 'Twitter channel tweets to post.',
          required: true,
        },
        {
          name: 'discord_channel',
          type: 'CHANNEL',
          description:
            'Discord channel to add posts to. If omitted will use this Discord channel.',
        },
      ],
    },
  ],
}

export function register(client: Discord.Client): void {
  if (client.application)
    client.application.commands.create(commandData).catch(logger.error)
}

export async function handler(interaction: Discord.Interaction): Promise<void> {
  if (!interaction.isCommand()) return

  if (!interaction.guild)
    return interaction.reply('This command does not work in a DM channel.')

  if (!interaction.channelID) return

  const perms: Discord.Permissions = interaction.member.permissions
  if (!perms.has('MANAGE_CHANNELS'))
    return interaction.reply('You do not have permission to run this command.')

  const cmd = interaction.options[0].name as 'list' | 'post'
  if (cmd === 'list') {
    await interaction.defer(true)
    const all = interaction.options[0].options
      ? (interaction.options[0].options[0].value as boolean)
      : false
    const owner = interaction.user.id === process.env.DISCORD_BOT_OWNER_ID
    if (all && !owner)
      return await interaction.editReply(
        'Only the bot owner can use the list all option.',
      )
    return await interaction.editReply(await list(interaction.guild, all))
  }

  const options = interaction.options[0].options
  if (!options) return

  const action = options[0].value as 'add' | 'remove'
  const name = options[1].value as string
  const channel = options[2]
    ? (options[2].value as string)
    : interaction.channelID

  if (action === 'add')
    return await interaction.reply(await add(name, channel, interaction.guild))
  if (action === 'remove')
    return await interaction.reply(
      await remove(name, channel, interaction.guild),
    )
}
